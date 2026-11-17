const CACHE_PREFIX = "atmosai-weather:";
const AIR_QUALITY_CACHE_PREFIX = "atmosai-air-quality:";
export const CACHE_LIFETIME_MS = 2 * 60 * 60 * 1000;

// Fresh entries are returned as-is so the UI can avoid an unnecessary API request.
export function getCachedWeather(zip, units, now = Date.now(), storage = localStorage) {
  return readFreshEntry(cacheKey(zip, units), now, storage);
}

export function saveCachedWeather(zip, units, data, now = Date.now(), storage = localStorage) {
  storage.setItem(cacheKey(zip, units), JSON.stringify({ data, savedAt: now }));
}

export function getCachedAirQuality(zip, now = Date.now(), storage = localStorage) {
  return readFreshEntry(`${AIR_QUALITY_CACHE_PREFIX}${zip || "default"}`, now, storage);
}

export function saveCachedAirQuality(zip, data, now = Date.now(), storage = localStorage) {
  storage.setItem(`${AIR_QUALITY_CACHE_PREFIX}${zip || "default"}`, JSON.stringify({ data, savedAt: now }));
}

export function removeCachedWeather(zip, units, storage = localStorage) {
  storage.removeItem(cacheKey(zip, units));
}

export function removeCachedAirQuality(zip, storage = localStorage) {
  storage.removeItem(`${AIR_QUALITY_CACHE_PREFIX}${zip || "default"}`);
}

function readFreshEntry(key, now, storage) {
  const stored = storage.getItem(key);
  if (!stored) return null;

  let entry;
  try {
    entry = JSON.parse(stored);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    storage.removeItem(key);
    return null;
  }

  if (!entry || !Number.isFinite(entry.savedAt) || !entry.data || now < entry.savedAt) {
    storage.removeItem(key);
    return null;
  }
  if (now - entry.savedAt >= CACHE_LIFETIME_MS) {
    storage.removeItem(key);
    return null;
  }
  return entry;
}

function cacheKey(zip, units) {
  return `${CACHE_PREFIX}${zip || "default"}:${units}`;
}
