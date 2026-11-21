import { expect, test } from "@jest/globals";
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

  expect(daily).toHaveLength(5);
  expect(daily[0].min).toBe(8);
  expect(daily[0].max).toBe(16);
  expect(daily[0].windDirection).toBe("E");
  expect(daily[0].precipitationChance).toBe(30);
});
