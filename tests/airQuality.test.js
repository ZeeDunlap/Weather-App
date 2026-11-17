import test from "node:test";
import assert from "node:assert/strict";
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

  assert.equal(result.index, 3);
  assert.equal(result.category, "Moderate");
  assert.equal(result.pollutants.pm2_5, 12.4);
});
