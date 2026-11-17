import test from "node:test";
import assert from "node:assert/strict";
import { summarizeFiveDays } from "../src/services/forecast.js";

test("groups forecast samples into five days with daily temperature, wind, and rain", () => {
  const samples = [];
  for (let day = 1; day <= 6; day += 1) {
    samples.push({
      dt_txt: `2026-11-${String(day).padStart(2, "0")} 12:00:00`,
      main: { temp: 12, temp_min: 8, temp_max: 16 },
      wind: { speed: 4, deg: 90 },
      pop: 0.3,
      weather: [{ description: "light rain", icon: "10d" }],
    });
  }

  const daily = summarizeFiveDays(samples);

  assert.equal(daily.length, 5);
  assert.equal(daily[0].min, 8);
  assert.equal(daily[0].max, 16);
  assert.equal(daily[0].windDirection, "E");
  assert.equal(daily[0].precipitationChance, 30);
});
