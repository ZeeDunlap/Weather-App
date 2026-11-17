import test from "node:test";
import assert from "node:assert/strict";
import { getUnitDetails, UNIT_OPTIONS } from "../src/services/units.js";

test("supports SI, metric, and imperial display units", () => {
  assert.deepEqual(UNIT_OPTIONS.map(({ value }) => value), ["standard", "metric", "imperial"]);
  assert.equal(getUnitDetails("standard").temperature, "K");
  assert.equal(getUnitDetails("standard").wind, "m/s");
  assert.equal(getUnitDetails("metric").temperature, "C");
  assert.equal(getUnitDetails("imperial").temperature, "F");
  assert.equal(getUnitDetails("imperial").wind, "mph");
});
