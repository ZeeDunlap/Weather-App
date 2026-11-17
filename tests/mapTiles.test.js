import test from "node:test";
import assert from "node:assert/strict";
import { createWeatherApi, WeatherApiError } from "../src/server/weatherApi.js";

test("proxies supported weather map tiles while keeping the API key server-side", async () => {
  let requestedUrl;
  const api = createWeatherApi({
    apiKey: "private-test-key",
    fetchImpl: async (url) => {
      requestedUrl = new URL(url);
      return {
        ok: true,
        headers: { get: () => "image/png" },
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      };
    },
  });

  const tile = await api.getMapTile("precipitation_new", 4, 3, 5);

  assert.equal(requestedUrl.hostname, "tile.openweathermap.org");
  assert.equal(requestedUrl.pathname, "/map/precipitation_new/4/3/5.png");
  assert.equal(requestedUrl.searchParams.get("appid"), "private-test-key");
  assert.equal(tile.contentType, "image/png");
  assert.deepEqual([...tile.body], [1, 2, 3]);
});

test("rejects unsupported layers and out-of-range map coordinates", async () => {
  const api = createWeatherApi({ apiKey: "test-key" });

  await assert.rejects(api.getMapTile("unknown", 2, 1, 1), WeatherApiError);
  await assert.rejects(api.getMapTile("temp_new", 2, 4, 0), /invalid/);
});
