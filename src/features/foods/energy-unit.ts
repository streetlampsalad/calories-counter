export type EnergyUnit = "kcal" | "kj";

const STORAGE_KEY = "calories-counter:energy-unit";

// Per device, and only a convenience: storage can be blocked (private windows), so failures are ignored.
export function readEnergyUnit(): EnergyUnit {
  try {
    return localStorage.getItem(STORAGE_KEY) === "kj" ? "kj" : "kcal";
  } catch {
    return "kcal";
  }
}

export function saveEnergyUnit(unit: EnergyUnit) {
  try {
    localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    // Not remembered; the form still works.
  }
}
