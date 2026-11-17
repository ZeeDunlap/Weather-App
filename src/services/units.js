export const UNIT_OPTIONS = [
  { value: "standard", label: "SI (Kelvin, m/s)", temperature: "K", wind: "m/s" },
  { value: "metric", label: "Metric (Celsius, m/s)", temperature: "C", wind: "m/s" },
  { value: "imperial", label: "Imperial (Fahrenheit, mph)", temperature: "F", wind: "mph" },
];

export function getUnitDetails(units) {
  return UNIT_OPTIONS.find((option) => option.value === units) || UNIT_OPTIONS[1];
}
