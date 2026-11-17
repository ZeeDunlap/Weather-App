const STORAGE_KEY = "atmosai-saved-locations";
const MAX_SAVED_LOCATIONS = 5;

export function readSavedLocations(storage = localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return [];

  const locations = JSON.parse(raw);
  if (!Array.isArray(locations) || locations.some((location) => !location.zip || !location.name)) {
    throw new Error("Saved locations have an invalid format.");
  }
  return locations;
}

export function addSavedLocation(location, locations, storage = localStorage) {
  if (locations.some((saved) => saved.zip === location.zip)) {
    return { locations, saved: false, limitReached: false };
  }
  if (locations.length >= MAX_SAVED_LOCATIONS) {
    return { locations, saved: false, limitReached: true };
  }

  const updated = [...locations, location];
  storage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return { locations: updated, saved: true, limitReached: false };
}

export function removeSavedLocation(zip, locations, storage = localStorage) {
  const updated = locations.filter((location) => location.zip !== zip);
  storage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
