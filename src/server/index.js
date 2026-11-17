import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createWeatherApi, WeatherApiError } from "./weatherApi.js";

export function createApiServer(weatherApi = createWeatherApi({ apiKey: process.env.OPENWEATHER_API_KEY })) {
  return createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const mapMatch = url.pathname.match(/^\/api\/map\/([^/]+)\/(\d+)\/(\d+)\/(\d+)\.png$/);
    if (request.method === "GET" && mapMatch) {
      try {
        const [, layer, zoom, x, y] = mapMatch;
        const tile = await weatherApi.getMapTile(layer, Number(zoom), Number(x), Number(y));
        response.writeHead(200, {
          "content-type": tile.contentType,
          "cache-control": "public, max-age=3600",
        });
        response.end(tile.body);
      } catch (error) {
        if (error instanceof WeatherApiError) {
          sendJson(response, error.status, { error: error.message });
          return;
        }
        console.error("Map tile request failed:", error.message);
        sendJson(response, 502, { error: "Weather map tiles could not be loaded." });
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/air-quality") {
      try {
        const zip = url.searchParams.get("zip") || process.env.DEFAULT_ZIP || "";
        const airQuality = await weatherApi.getAirQuality(zip);
        sendJson(response, 200, airQuality);
      } catch (error) {
        if (error instanceof WeatherApiError) {
          sendJson(response, error.status, { error: error.message });
          return;
        }
        console.error("Air quality request failed:", error.message);
        sendJson(response, 500, { error: "An unexpected error occurred while loading air quality." });
      }
      return;
    }

    if (request.method !== "GET" || url.pathname !== "/api/weather") {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    try {
      const zip = url.searchParams.get("zip") || process.env.DEFAULT_ZIP || "";
      const units = url.searchParams.get("units") || "metric";
      const weather = await weatherApi.getWeather(zip, units);
      sendJson(response, 200, weather);
    } catch (error) {
      if (error instanceof WeatherApiError) {
        sendJson(response, error.status, { error: error.message });
        return;
      }
      console.error("Weather request failed:", error.message);
      sendJson(response, 500, { error: "An unexpected error occurred while loading weather." });
    }
  });
}

const isMainModule = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMainModule) {
  createApiServer().listen(3001, "127.0.0.1", () => {
    console.log("AtmosAI API server listening at http://127.0.0.1:3001");
  });
}

function sendJson(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}
