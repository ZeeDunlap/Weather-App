import { expect, test } from "@jest/globals";
import { createWeatherApi } from "../src/server/weatherApi.js";

test("retrieves and categorizes air quality for the selected ZIP code", async () => {
  const api = createWeatherApi({
    apiKey: "test-key",
    fetchImpl: async (url) => {
      if (url.includes("/geo/")) {
        return { ok: true, json: async () => ({ lat: 37, lon: -90, name: "Cape Girardeau" }) };
      }
      return {
        ok: true,
        json: async () => ({
          list: [{ main: { aqi: 3 }, components: { pm2_5: 12.4 } }],
        }),
      };
    },
  });

  const result = await api.getAirQuality("63701");

  expect(result.index).toBe(3);
  expect(result.category).toBe("Moderate");
  expect(result.pollutants.pm2_5).toBe(12.4);
});
