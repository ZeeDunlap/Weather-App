import { expect, test } from "@jest/globals";
import { getUnitDetails, UNIT_OPTIONS } from "../src/services/units.js";

test("supports SI, metric, and imperial display units", () => {
  expect(UNIT_OPTIONS.map(({ value }) => value)).toEqual(["standard", "metric", "imperial"]);
  expect(getUnitDetails("standard").temperature).toBe("K");
  expect(getUnitDetails("standard").wind).toBe("m/s");
  expect(getUnitDetails("metric").temperature).toBe("C");
  expect(getUnitDetails("imperial").temperature).toBe("F");
  expect(getUnitDetails("imperial").wind).toBe("mph");
});
