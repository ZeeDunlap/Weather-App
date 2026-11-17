const WEATHER_API = "https://api.openweathermap.org";
const WEATHER_TILE_API = "https://tile.openweathermap.org";
const ZIP_PATTERN = /^\d{5}$/;
const MAP_LAYERS = new Set(["precipitation_new", "temp_new", "clouds_new", "wind_new", "pressure_new"]);

export class WeatherApiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "WeatherApiError";
    this.status = status;
  }
}

// Keep provider requests and credentials on the server instead of exposing them in React.
export function createWeatherApi({
  apiKey,
  fetchImpl = fetch,
  attempts = 3,
  timeoutMs = 6000,
}) {
  async function getWeather(zip, units = "metric") {
    if (!ZIP_PATTERN.test(zip || "")) {
      throw new WeatherApiError("Enter a valid five-digit ZIP code.", 400);
    }
    if (!["standard", "metric", "imperial"].includes(units)) {
      throw new WeatherApiError("Select standard, metric, or imperial units.", 400);
    }
    if (!apiKey) {
      throw new WeatherApiError("Weather service is not configured. Set OPENWEATHER_API_KEY on the server.", 503);
    }

    const location = await resolveLocation(zip);

    const coordinates = `lat=${location.lat}&lon=${location.lon}`;
    const [current, forecast] = await Promise.all([
      requestJson(
        `${WEATHER_API}/data/2.5/weather?${coordinates}&units=${units}&appid=${encodeURIComponent(apiKey)}`,
        "Current weather could not be loaded.",
      ),
      requestJson(
        `${WEATHER_API}/data/2.5/forecast?${coordinates}&units=${units}&appid=${encodeURIComponent(apiKey)}`,
        "Forecast data could not be loaded.",
      ),
    ]);

    if (!Number.isFinite(current.main?.temp) || !Number.isFinite(current.main?.humidity)
      || !Number.isFinite(current.wind?.speed) || !Array.isArray(forecast.list)) {
      throw new WeatherApiError("The weather service returned incomplete current conditions or forecast data.");
    }

    const nextForecast = forecast.list?.[0];
    return {
      location: {
        zip,
        name: location.name || current.name || zip,
        region: location.state || "",
        country: location.country || "US",
        latitude: location.lat,
        longitude: location.lon,
      },
      current: {
        temperature: current.main?.temp,
        humidity: current.main?.humidity,
        windSpeed: current.wind?.speed,
        windDirection: degreesToDirection(current.wind?.deg),
        precipitationChance: nextForecast?.pop == null ? null : Math.round(nextForecast.pop * 100),
        description: current.weather?.[0]?.description || "Conditions unavailable",
        icon: current.weather?.[0]?.icon || "01d",
      },
      forecast,
      units,
      retrievedAt: new Date().toISOString(),
    };
  }

  async function getAirQuality(zip) {
    if (!ZIP_PATTERN.test(zip || "")) {
      throw new WeatherApiError("Enter a valid five-digit ZIP code.", 400);
    }
    if (!apiKey) {
      throw new WeatherApiError("Weather service is not configured. Set OPENWEATHER_API_KEY on the server.", 503);
    }

    const location = await resolveLocation(zip);
    const pollution = await requestJson(
      `${WEATHER_API}/data/2.5/air_pollution?lat=${location.lat}&lon=${location.lon}&appid=${encodeURIComponent(apiKey)}`,
      "Air quality data could not be loaded.",
    );
    const reading = pollution.list?.[0];
    if (!Number.isInteger(reading?.main?.aqi) || reading.main.aqi < 1 || reading.main.aqi > 5) {
      throw new WeatherApiError("The weather service returned no air quality reading.");
    }

    return {
      index: reading.main?.aqi,
      category: ["Unknown", "Good", "Fair", "Moderate", "Poor", "Very poor"][reading.main?.aqi] || "Unknown",
      pollutants: reading.components || {},
      retrievedAt: new Date().toISOString(),
    };
  }

  async function resolveLocation(zip) {
    const location = await requestJson(
      `${WEATHER_API}/geo/1.0/zip?zip=${encodeURIComponent(zip)},US&appid=${encodeURIComponent(apiKey)}`,
      "Location could not be found.",
    );
    if (!Number.isFinite(location.lat) || !Number.isFinite(location.lon)) {
      throw new WeatherApiError("The weather service returned an invalid location.");
    }
    return location;
  }

  async function getMapTile(layer, zoom, x, y) {
    const tileLimit = 2 ** zoom;
    if (!MAP_LAYERS.has(layer) || !Number.isInteger(zoom) || zoom < 0 || zoom > 18
      || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0
      || x >= tileLimit || y >= tileLimit) {
      throw new WeatherApiError("The requested map tile is invalid.", 400);
    }
    if (!apiKey) {
      throw new WeatherApiError("Weather service is not configured. Set OPENWEATHER_API_KEY on the server.", 503);
    }

    let lastError;
    let attemptCount = 0;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      attemptCount += 1;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const url = `${WEATHER_TILE_API}/map/${layer}/${zoom}/${x}/${y}.png?appid=${encodeURIComponent(apiKey)}`;
        const response = await fetchImpl(url, { signal: controller.signal });
        if (response.ok) {
          return {
            contentType: response.headers.get("content-type") || "image/png",
            body: Buffer.from(await response.arrayBuffer()),
          };
        }
        lastError = new Error(`Map service returned ${response.status}.`);
        if (response.status < 500 && response.status !== 429) break;
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new WeatherApiError(
      `Map tiles could not be loaded after ${attemptCount} attempt${attemptCount === 1 ? "" : "s"}. ${lastError?.message || ""}`.trim(),
    );
  }

  async function requestJson(url, failureMessage) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, { signal: controller.signal });
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          if (retryable) continue;
          throw new WeatherApiError(
            `${failureMessage} ${response.status === 404 ? "Check the ZIP code." : "Check the weather service configuration."}`,
            response.status === 404 ? 400 : 502,
          );
        }
        return await response.json();
      } catch (error) {
        if (error instanceof WeatherApiError) {
          throw error;
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new WeatherApiError(`${failureMessage} The server did not respond after three attempts.`);
  }

  return { getWeather, getAirQuality, getMapTile };
}

function degreesToDirection(degrees) {
  if (!Number.isFinite(degrees)) return "—";
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(degrees / 45) % 8];
}
