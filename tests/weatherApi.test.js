import { expect, test } from "@jest/globals";
import { createWeatherApi, WeatherApiError } from "../src/server/weatherApi.js";

function response(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

test("loads current conditions and derives precipitation chance from the next forecast", async () => {
  const requestedUrls = [];
  const api = createWeatherApi({
    apiKey: "test-key",
    fetchImpl: async (url) => {
      requestedUrls.push(new URL(url));
      if (url.includes("/geo/")) {
        return response({ lat: 37, lon: -90, name: "Cape Girardeau", state: "Missouri", country: "US" });
      }
      if (url.includes("/weather?")) {
        return response({
          name: "Cape Girardeau",
          main: { temp: 20.2, humidity: 51 },
          wind: { speed: 4, deg: 90 },
          weather: [{ description: "clear sky", icon: "01d" }],
        });
      }
      return response({ list: [{ pop: 0.42 }] });
    },
  });

  const weather = await api.getWeather("63701", "metric");

  expect(weather.location.name).toBe("Cape Girardeau");
  expect(weather.current.temperature).toBe(20.2);
  expect(weather.current.windDirection).toBe("E");
  expect(weather.current.precipitationChance).toBe(42);
  expect(requestedUrls).toHaveLength(3);
  expect(requestedUrls.every((url) => url.searchParams.get("appid") === "test-key")).toBe(true);
});

test("rejects malformed ZIP codes without calling the provider", async () => {
  let called = false;
  const api = createWeatherApi({
    apiKey: "test-key",
    fetchImpl: async () => { called = true; },
  });

  await expect(api.getWeather("1234")).rejects.toBeInstanceOf(WeatherApiError);
  expect(called).toBe(false);
});

test("retries unavailable provider requests up to three times", async () => {
  let attempts = 0;
  const api = createWeatherApi({
    apiKey: "test-key",
    fetchImpl: async () => {
      attempts += 1;
      throw new Error("network unavailable");
    },
  });

  await expect(api.getWeather("63701")).rejects.toThrow(/after three attempts/);
  expect(attempts).toBe(3);
});

test("does not retry a non-retryable API credential response", async () => {
  let attempts = 0;
  const api = createWeatherApi({
    apiKey: "invalid-test-key",
    fetchImpl: async () => {
      attempts += 1;
      return response({}, 401);
    },
  });

  await expect(api.getWeather("63701")).rejects.toThrow(/Check the weather service configuration/);
  expect(attempts).toBe(1);
});
