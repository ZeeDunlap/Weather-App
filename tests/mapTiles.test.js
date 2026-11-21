import { expect, test } from "@jest/globals";
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

  expect(requestedUrl.hostname).toBe("tile.openweathermap.org");
  expect(requestedUrl.pathname).toBe("/map/precipitation_new/4/3/5.png");
  expect(requestedUrl.searchParams.get("appid")).toBe("private-test-key");
  expect(tile.contentType).toBe("image/png");
  expect([...tile.body]).toEqual([1, 2, 3]);
});

test("rejects unsupported layers and out-of-range map coordinates", async () => {
  const api = createWeatherApi({ apiKey: "test-key" });

  await expect(api.getMapTile("unknown", 2, 1, 1)).rejects.toBeInstanceOf(WeatherApiError);
  await expect(api.getMapTile("temp_new", 2, 4, 0)).rejects.toThrow(/invalid/);
});
