// OpenWeather's five-day endpoint returns three-hour samples; group them into daily summaries.
export function summarizeFiveDays(samples = []) {
  const days = new Map();

  for (const sample of samples) {
    const date = sample.dt_txt?.slice(0, 10)
      || new Date(sample.dt * 1000).toISOString().slice(0, 10);
    if (!days.has(date)) {
      days.set(date, {
        date,
        min: Number.POSITIVE_INFINITY,
        max: Number.NEGATIVE_INFINITY,
        windSpeedTotal: 0,
        windSamples: 0,
        windX: 0,
        windY: 0,
        precipitationChance: 0,
        condition: sample.weather?.[0]?.description || "Conditions unavailable",
        icon: sample.weather?.[0]?.icon || "01d",
      });
    }

    const day = days.get(date);
    const temperature = sample.main?.temp;
    day.min = Math.min(day.min, sample.main?.temp_min ?? temperature);
    day.max = Math.max(day.max, sample.main?.temp_max ?? temperature);
    day.precipitationChance = Math.max(day.precipitationChance, Math.round((sample.pop || 0) * 100));
    if (Number.isFinite(sample.wind?.speed)) {
      const radians = (sample.wind.deg || 0) * Math.PI / 180;
      day.windSpeedTotal += sample.wind.speed;
      day.windSamples += 1;
      day.windX += Math.sin(radians);
      day.windY += Math.cos(radians);
    }
  }

  return [...days.values()].slice(0, 5).map((day) => ({
    ...day,
    min: Number.isFinite(day.min) ? day.min : null,
    max: Number.isFinite(day.max) ? day.max : null,
    windSpeed: day.windSamples ? day.windSpeedTotal / day.windSamples : null,
    windDirection: day.windSamples ? directionFromVector(day.windX, day.windY) : "—",
  }));
}

function directionFromVector(x, y) {
  const degrees = (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(degrees / 45) % 8];
}
