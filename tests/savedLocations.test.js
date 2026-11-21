import { expect, test } from "@jest/globals";
import { addSavedLocation, readSavedLocations, removeSavedLocation } from "../src/services/savedLocations.js";

function storageWith(initial = null) {
  const values = new Map(initial === null ? [] : [["atmosai-saved-locations", initial]]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("saves unique locations and enforces the five-location limit", () => {
  const storage = storageWith();
  let locations = [];
  for (let index = 0; index < 5; index += 1) {
    const result = addSavedLocation({ zip: `0000${index}`, name: `Town ${index}` }, locations, storage);
    locations = result.locations;
    expect(result.saved).toBe(true);
  }

  expect(addSavedLocation({ zip: "00000", name: "Town 0" }, locations, storage).saved).toBe(false);
  expect(addSavedLocation({ zip: "00005", name: "Town 5" }, locations, storage).limitReached).toBe(true);
  expect(readSavedLocations(storage)).toHaveLength(5);
  expect(removeSavedLocation("00000", locations, storage)).toHaveLength(4);
});
