import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const WEATHER_LAYERS = [
  ["precipitation_new", "Precipitation"],
  ["temp_new", "Temperature"],
  ["clouds_new", "Cloud cover"],
  ["pressure_new", "Pressure"],
  ["wind_new", "Wind"],
];

function MapView({ location }) {
  const elementRef = useRef(null);
  const mapRef = useRef(null);
  const [layer, setLayer] = useState(WEATHER_LAYERS[0][0]);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    if (!elementRef.current) return undefined;

    const map = L.map(elementRef.current).setView([location.latitude, location.longitude], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [location.latitude, location.longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    setMapError("");
    const overlay = L.tileLayer(`/api/map/${layer}/{z}/{x}/{y}.png`, {
      opacity: 0.68,
      maxZoom: 18,
      attribution: "Weather tiles &copy; OpenWeather",
    });
    overlay.on("tileerror", () => setMapError("Weather map tiles could not be loaded."));
    overlay.addTo(map);
    return () => map.removeLayer(overlay);
  }, [layer, location.latitude, location.longitude]);

  return (
    <section className="map-section" aria-labelledby="map-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">WEATHER MAP</p>
          <h2 id="map-title">Explore the area</h2>
        </div>
        <label className="map-layer-control">
          <span className="visually-hidden">Map layer</span>
          <select value={layer} onChange={(event) => setLayer(event.target.value)}>
            {WEATHER_LAYERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      {mapError && <p className="notice" role="alert">{mapError}</p>}
      <div className="map-frame" ref={elementRef} aria-label="Interactive weather map" />
    </section>
  );
}

export default MapView;
