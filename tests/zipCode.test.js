import { expect, test } from "@jest/globals";
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

  const error = await api.getWeather("99999").catch((rejection) => rejection);

  expect(error).toBeInstanceOf(WeatherApiError);
  expect(error).toMatchObject({
    status: 400,
    message: expect.stringMatching(/Check the ZIP code/),
  });
});
