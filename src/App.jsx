import { useEffect, useState } from "react";
import {
  CACHE_LIFETIME_MS,
  getCachedAirQuality,
  getCachedWeather,
  removeCachedAirQuality,
  removeCachedWeather,
  saveCachedAirQuality,
  saveCachedWeather,
} from "./services/weatherCache.js";
import { summarizeFiveDays } from "./services/forecast.js";
import MapView from "./MapView.jsx";
import { getUnitDetails, UNIT_OPTIONS } from "./services/units.js";
import { addSavedLocation, readSavedLocations, removeSavedLocation } from "./services/savedLocations.js";

const LAST_ZIP_KEY = "atmosai-last-zip";
const SAVED_UNITS_KEY = "atmosai-units";

function App() {
  const [units, setUnits] = useState(() => localStorage.getItem(SAVED_UNITS_KEY) || "metric");
  const [zip, setZip] = useState(() => localStorage.getItem(LAST_ZIP_KEY) || "");
  const [zipDraft, setZipDraft] = useState(() => localStorage.getItem(LAST_ZIP_KEY) || "");
  const [weather, setWeather] = useState(null);
  const [airQuality, setAirQuality] = useState(null);
  const [airQualityError, setAirQualityError] = useState("");
  const [savedLocations, setSavedLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [weatherRefreshKey, setWeatherRefreshKey] = useState(0);
  const [airQualityRefreshKey, setAirQualityRefreshKey] = useState(0);

  useEffect(() => {
    try {
      setSavedLocations(readSavedLocations());
    } catch (storageReadError) {
      setStorageError(`Saved locations could not be loaded: ${storageReadError.message}`);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCurrentWeather() {
      setLoading(true);
      setError("");
      try {
        const cached = getCachedWeather(zip, units);
        if (cached) {
          if (active) {
            setWeather(cached.data);
            setZipDraft(cached.data.location.zip);
          }
          return;
        }
        if (!navigator.onLine) {
          if (active) setError("You appear to be offline. Connect to the internet to load weather.");
          return;
        }

        const query = new URLSearchParams({ units });
        if (zip) query.set("zip", zip);
        const response = await fetch(`/api/weather?${query}`);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Weather data could not be loaded.");
        }
        if (active) {
          setWeather(payload);
          setZipDraft(payload.location.zip);
          setZip(payload.location.zip);
          localStorage.setItem(LAST_ZIP_KEY, payload.location.zip);
          saveCachedWeather(payload.location.zip, units, payload);
        }
      } catch (requestError) {
        if (active) {
          try {
            const cached = getCachedWeather(zip, units);
            if (cached) {
              setWeather(cached.data);
              setError(`Showing saved weather from ${new Date(cached.savedAt).toLocaleString()}.`);
            } else {
              setError(requestError.message);
            }
          } catch (cacheError) {
            setError(`Weather could not be loaded and the local cache is unavailable: ${cacheError.message}`);
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCurrentWeather();
    return () => {
      active = false;
    };
  }, [units, zip, weatherRefreshKey]);

  useEffect(() => {
    let active = true;
    const airQualityZip = zip || weather?.location.zip;
    if (!airQualityZip) return undefined;

    async function loadAirQuality() {
      setAirQuality(null);
      setAirQualityError("");
      try {
        const cached = getCachedAirQuality(airQualityZip);
        if (cached) {
          if (active) setAirQuality(cached.data);
          return;
        }
        if (!navigator.onLine) {
          if (active) setAirQualityError("Air quality is unavailable while offline.");
          return;
        }

        const response = await fetch(`/api/air-quality?zip=${encodeURIComponent(airQualityZip)}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Air quality data could not be loaded.");
        if (active) {
          setAirQuality(payload);
          saveCachedAirQuality(airQualityZip, payload);
        }
      } catch (requestError) {
        if (active) setAirQualityError(requestError.message);
      }
    }

    loadAirQuality();
    return () => {
      active = false;
    };
  }, [zip, weather?.location.zip, airQualityRefreshKey]);

  useEffect(() => {
    if (!weather) return undefined;
    const cached = getCachedWeather(weather.location.zip, units);
    if (!cached) return undefined;

    const remaining = Math.max(CACHE_LIFETIME_MS - (Date.now() - cached.savedAt), 0);
    const timer = setTimeout(() => {
      removeCachedWeather(weather.location.zip, units);
      setWeather(null);
      setWeatherRefreshKey((key) => key + 1);
    }, remaining);
    return () => clearTimeout(timer);
  }, [weather, units]);

  useEffect(() => {
    const airQualityZip = zip || weather?.location.zip;
    if (!airQuality || !airQualityZip) return undefined;

    const cached = getCachedAirQuality(airQualityZip);
    if (!cached) return undefined;
    const remaining = Math.max(CACHE_LIFETIME_MS - (Date.now() - cached.savedAt), 0);
    const timer = setTimeout(() => {
      removeCachedAirQuality(airQualityZip);
      setAirQuality(null);
      setAirQualityRefreshKey((key) => key + 1);
    }, remaining);
    return () => clearTimeout(timer);
  }, [airQuality, zip, weather?.location.zip]);

  function searchZip(event) {
    event.preventDefault();
    if (!/^\d{5}$/.test(zipDraft)) {
      setError("Enter a ZIP code with exactly five digits.");
      return;
    }
    if (zipDraft !== zip) {
      setWeather(null);
      setZip(zipDraft);
    } else {
      setWeather(null);
      setWeatherRefreshKey((key) => key + 1);
    }
  }

  function changeUnits(event) {
    const nextUnits = event.target.value;
    if (nextUnits !== units) {
      localStorage.setItem(SAVED_UNITS_KEY, nextUnits);
      setWeather(null);
      setUnits(nextUnits);
    }
  }

  function saveLocation() {
    if (!weather) return;
    try {
      const result = addSavedLocation(weather.location, savedLocations);
      setSavedLocations(result.locations);
      setError(result.limitReached
        ? "You can save up to five locations. Remove one before saving another."
        : result.saved ? "" : "This location is already saved.");
    } catch (storageWriteError) {
      setStorageError(`Saved locations could not be stored: ${storageWriteError.message}`);
    }
  }

  function deleteLocation(zipToRemove) {
    try {
      setSavedLocations(removeSavedLocation(zipToRemove, savedLocations));
      setError("");
    } catch (storageWriteError) {
      setStorageError(`Saved locations could not be updated: ${storageWriteError.message}`);
    }
  }

  function selectLocation(location) {
    setZipDraft(location.zip);
    setError("");
    if (location.zip !== zip) {
      setWeather(null);
      setZip(location.zip);
    }
  }

  const unitDetails = getUnitDetails(units);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="AtmosAI home">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span>Atmos<span className="brand-accent">AI</span></span>
        </a>
        <label className="unit-control">
          <span>Units</span>
          <select value={units} onChange={changeUnits} aria-label="Measurement units">
            {UNIT_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </header>

      <section className="weather-page" aria-live="polite">
        <p className="eyebrow">YOUR WEATHER</p>
        <form className="search-form" onSubmit={searchZip} noValidate>
          <label className="visually-hidden" htmlFor="zip-code">US ZIP code</label>
          <input
            id="zip-code"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            pattern="[0-9]{5}"
            placeholder="Enter a US ZIP code"
            value={zipDraft}
            onChange={(event) => setZipDraft(event.target.value.replace(/\D/g, "").slice(0, 5))}
          />
          <button type="submit" disabled={loading}>Search</button>
        </form>
        {loading && <p className="status-message">Loading current conditions…</p>}
        {error && <p className="notice" role="alert">{error}</p>}
        {storageError && <p className="notice" role="alert">{storageError}</p>}

        <section className="saved-section" aria-label="Saved locations">
          <div className="saved-heading">
            <p className="eyebrow">SAVED LOCATIONS</p>
            <span>{savedLocations.length}/5</span>
          </div>
          {savedLocations.length > 0 && (
            <div className="saved-list">
              {savedLocations.map((location) => (
                <div className="saved-location" key={location.zip}>
                  <button
                    className="saved-select"
                    type="button"
                    onClick={() => selectLocation(location)}
                    aria-current={weather?.location.zip === location.zip ? "location" : undefined}
                  >
                    {location.name}
                    <span>{location.zip}</span>
                  </button>
                  <button
                    className="saved-remove"
                    type="button"
                    aria-label={`Remove ${location.name}`}
                    onClick={() => deleteLocation(location.zip)}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </section>

        {!loading && !weather && !error && (
          <p className="notice" role="alert">No weather data is available yet.</p>
        )}

        {weather && (
          <article className="current-card">
            <div className="current-heading">
              <div>
                <p className="location-label">{weather.location.name}</p>
                <p className="location-detail">{weather.location.region}, {weather.location.country}</p>
              </div>
              <span className="condition-pill">{weather.current.description}</span>
            </div>
            <button className="save-location-button" type="button" onClick={saveLocation}>
              Save location
            </button>
            <div className="temperature-row">
              <img
                className="weather-icon"
                src={`https://openweathermap.org/img/wn/${weather.current.icon}@2x.png`}
                alt=""
              />
              <p className="temperature">{Math.round(weather.current.temperature)}°</p>
              <p className="temperature-unit">{unitDetails.temperature}</p>
            </div>
            <p className="condition-description">{weather.current.description}</p>
            <div className="conditions-grid">
              <Condition label="Humidity" value={`${weather.current.humidity}%`} />
              <Condition label="Wind" value={`${weather.current.windSpeed} ${unitDetails.wind}`} />
              <Condition label="Wind direction" value={weather.current.windDirection} />
              <Condition
                label="Chance of rain"
                value={weather.current.precipitationChance == null ? "—" : `${weather.current.precipitationChance}%`}
              />
              <Condition
                label="Air quality"
                value={airQuality ? `${airQuality.index} · ${airQuality.category}` : airQualityError ? "Unavailable" : "Loading…"}
              />
            </div>
            {airQualityError && <p className="aqi-error" role="status">{airQualityError}</p>}
            <p className="retrieved-at">
              Updated {new Date(weather.retrievedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </p>
          </article>
        )}

        {weather && (
          <section className="forecast-section" aria-labelledby="forecast-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">PLAN AHEAD</p>
                <h2 id="forecast-title">5-day forecast</h2>
              </div>
              <span className="section-caption">Daily outlook</span>
            </div>
            <div className="forecast-list">
              {summarizeFiveDays(weather.forecast?.list).map((day) => (
                <article className="forecast-card" key={day.date}>
                  <p className="forecast-day">
                    {new Date(`${day.date}T12:00:00`).toLocaleDateString([], { weekday: "short" })}
                  </p>
                  <img
                    className="forecast-icon"
                    src={`https://openweathermap.org/img/wn/${day.icon}.png`}
                    alt=""
                  />
                  <p className="forecast-description">{day.condition}</p>
                  <p className="forecast-temperature">
                    <strong>{Math.round(day.max ?? 0)}°</strong>
                    <span>{Math.round(day.min ?? 0)}°</span>
                  </p>
                  <p className="forecast-detail">Wind {day.windSpeed == null ? "—" : `${day.windSpeed.toFixed(1)} ${unitDetails.wind}`} {day.windDirection}</p>
                  <p className="forecast-detail">Rain {day.precipitationChance}%</p>
                </article>
              ))}
            </div>
          </section>
        )}
        {weather && <MapView location={weather.location} />}
      </section>
    </main>
  );
}

function Condition({ label, value }) {
  return (
    <div className="condition-item">
      <span className="condition-label">{label}</span>
      <span className="condition-value">{value}</span>
    </div>
  );
}

export default App;
