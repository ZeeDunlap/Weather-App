import test from "node:test";
import assert from "node:assert/strict";
import {
  getCachedAirQuality,
  getCachedWeather,
  saveCachedAirQuality,
  saveCachedWeather,
} from "../src/services/weatherCache.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("reuses weather and air-quality cache entries younger than two hours", () => {
  const storage = createStorage();
  const now = 1_800_000_000_000;
  const weather = { location: { zip: "63701" }, current: { temperature: 20 } };
  const airQuality = { index: 2, category: "Fair" };
  saveCachedWeather("63701", "metric", weather, now - 7_200_000 + 1, storage);
  saveCachedAirQuality("63701", airQuality, now - 7_200_000 + 1, storage);

  assert.deepEqual(getCachedWeather("63701", "metric", now, storage).data, weather);
  assert.deepEqual(getCachedAirQuality("63701", now, storage).data, airQuality);
});

test("expires cache entries at two hours and removes them from storage", () => {
  const storage = createStorage();
  const now = 1_800_000_000_000;
  saveCachedWeather("63701", "metric", { current: {} }, now - 7_200_000, storage);
  saveCachedAirQuality("63701", { index: 1 }, now - 7_200_000, storage);

  assert.equal(getCachedWeather("63701", "metric", now, storage), null);
  assert.equal(getCachedAirQuality("63701", now, storage), null);
  assert.equal(storage.getItem("atmosai-weather:63701:metric"), null);
  assert.equal(storage.getItem("atmosai-air-quality:63701"), null);
});

test("clears malformed cached JSON instead of treating it as valid weather", () => {
  const storage = createStorage();
  storage.setItem("atmosai-weather:63701:metric", "{");

  assert.equal(getCachedWeather("63701", "metric", Date.now(), storage), null);
  assert.equal(storage.getItem("atmosai-weather:63701:metric"), null);
});
