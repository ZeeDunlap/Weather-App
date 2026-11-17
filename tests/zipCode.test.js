import test from "node:test";
import assert from "node:assert/strict";
import { createWeatherApi, WeatherApiError } from "../src/server/weatherApi.js";

test("reports an invalid ZIP code returned by the geocoding service", async () => {
  const api = createWeatherApi({
    apiKey: "test-key",
    fetchImpl: async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    }),
  });

  await assert.rejects(
    api.getWeather("99999"),
    (error) => error instanceof WeatherApiError
      && error.status === 400
      && /Check the ZIP code/.test(error.message),
  );
});
