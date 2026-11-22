import { afterEach, beforeEach, expect, test } from "@jest/globals";
import { createWeatherApi, WeatherApiError } from "../src/server/weatherApi.js";

function response(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

describe('tests for completing worksheet', () => {
    let api;

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

        weather = await api.getWeather("63780", "metric");
        expect(weather.location.name).toBe("Scott County");
        // change the location
        weather = await api.getWeather("63701", "metric");
        expect(weather.location.name).toBe("Cape Girardeau");
    });

    test("retries unavailable provider requests up to three times (TC-11)", async () => {
        let attempts = 0;
        api = createWeatherApi({
          apiKey: "test-key",
          fetchImpl: async () => {
            attempts += 1;
            throw new Error("network unavailable");
          },
        });
        await expect(api.getWeather("63701")).rejects.toThrow(/after three attempts/);
        expect(attempts).toBe(3);
        });

    test.each([
        ['zip is too short (TC-04)',   '1234', false],
        ['zip is five digits (TC-05)', '12345', "Cape Girardeau"],
        ['zip is too long (TC-06)',    '123456', false],
    ])('%s', async (label, zip, expected) => {
        if (zip.length === 5) {
            let weather = await api.getWeather("63701", "metric");
            expect(weather.location.name).toBe(expected)
        } else {
            await expect(api.getWeather(zip)).rejects.toBeInstanceOf(WeatherApiError);
        }
        
    });
});