import { afterEach, beforeEach, expect, test } from "@jest/globals";
import { createWeatherApi, WeatherApiError } from "../src/server/weatherApi.js";
import { getCachedWeather, saveCachedWeather } from "../src/services/weatherCache.js";

function response(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe('tests for completing worksheet', () => {
    let api;

    // arrange
    beforeEach(() => {
        api = createWeatherApi({
            apiKey: "test-key",
            fetchImpl: async (url) => {
              if (url.includes("/geo/")) {
                if (url.includes("zip=63780")) {
                    return response({ lat: 37, lon: -89.5, name: "Scott County", state: "Missouri", country: "US" });
                }
                else {
                    return response({ lat: 37, lon: -90, name: "Cape Girardeau", state: "Missouri", country: "US" });
                }
              }
              if (url.includes("/weather?")) {
                let name;
                if (url.includes("lat=37&lon=-89.5")) {
                    name = "Scott County"
                } else {
                    name = "Cape Girardeau"
                }
                return response({
                  name: name,
                  main: { temp: 20.2, humidity: 51 },
                  wind: { speed: 4, deg: 90 },
                  weather: [{ description: "clear sky", icon: "01d" }],
                });
              }
              return response({ list: [{ pop: 0.42 }] });
            },
        });
    });

    afterEach(() => {
        api = null;
    });

    //tests
    test("Weather is updated after a new location is entered (TC-03)", async () => {
        let weather;

        weather = await api.getWeather("63780", "metric");      // act
        expect(weather.location.name).toBe("Scott County");     // assert
        // change the location
        weather = await api.getWeather("63701", "metric");      // act
        expect(weather.location.name).toBe("Cape Girardeau");   // assert
    });

    test("retries unavailable provider requests up to three times (TC-11)", async () => {
        // arrange
        let attempts = 0;
        api = createWeatherApi({
          apiKey: "test-key",
          fetchImpl: async () => {
            attempts += 1;
            throw new Error("network unavailable");
          },
        });
        await expect(api.getWeather("63701")).rejects.toThrow(/after three attempts/); // act + assert
        expect(attempts).toBe(3);                                                      // assert
        });

    test("NFR-1: cached weather and forecast load within the performance limits (TC-12)", () => {
        // arrange
        const storage = createStorage();
        const now = 1_800_000_000_000;
        const weather = {
          location: { zip: "63701", name: "Cape Girardeau" },
          current: { temperature: 20.2 },
          forecast: { list: [{ pop: 0.42 }] },
        };
        // act
        saveCachedWeather("63701", "metric", weather, now, storage);

        const currentStart = process.hrtime.bigint();
        const current = getCachedWeather("63701", "metric", now, storage);
        const currentElapsedMs = Number(process.hrtime.bigint() - currentStart) / 1_000_000;

        const forecastStart = process.hrtime.bigint();
        const forecast = getCachedWeather("63701", "metric", now, storage)?.data.forecast;
        const forecastElapsedMs = Number(process.hrtime.bigint() - forecastStart) / 1_000_000;

        // assert
        expect(current.data).toEqual(weather);
        expect(forecast.list).toHaveLength(1);
        expect(currentElapsedMs).toBeLessThan(2_000);
        expect(forecastElapsedMs).toBeLessThan(3_000);
    });

    test("NFR-5: data loads successfully at least 93 out of 100 times (TC-13)", async () => {
        // act
        let successfulAttempts = 0;
        let weather;
        for (let i = 0; i < 100; i++) {
            weather = await api.getWeather("63701", "metric")
            if (weather.location.name === "Cape Girardeau") {
            successfulAttempts += 1;
            }
        }

        // assert
        await expect(successfulAttempts).toBeGreaterThan(93);
    });

    test.each([
        ['zip is too short (TC-04)',   '1234', false],
        ['zip is five digits (TC-05)', '12345', "Cape Girardeau"],
        ['zip is too long (TC-06)',    '123456', false],
    ])('%s', async (label, zip, expected) => {
        if (zip.length === 5) {
            let weather = await api.getWeather("63701", "metric");  // act
            expect(weather.location.name).toBe(expected)            // assert
        } else {
            // assert
            await expect(api.getWeather(zip)).rejects.toBeInstanceOf(WeatherApiError);
        }
        
    });
});