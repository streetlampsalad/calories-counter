import type { Toggle } from "@/features/toggles/queries";

export type SettingsCategoryId = "tracking" | "preferences" | "features";

export type SettingsCategory = {
  id: SettingsCategoryId;
  title: string;
  description: string;
  // Whether any section of this category shows to the User; a category with none is not listed.
  hasVisibleSection: (toggles: readonly Toggle[]) => boolean;
};

// Daily goal, Calories burned and Week start always show; Reminder and Vibration always show;
// Feature requests always shows, and Try new features only for a User who can switch a Toggle.
export const SETTINGS_CATEGORIES: readonly SettingsCategory[] = [
  {
    id: "tracking",
    title: "Tracking",
    description: "Daily goal, calories burned and week start",
    hasVisibleSection: () => true,
  },
  {
    id: "preferences",
    title: "Preferences",
    description: "Reminder, vibration and appearance",
    hasVisibleSection: () => true,
  },
  {
    id: "features",
    title: "Features",
    description: "Try new features, request your own and report bugs",
    hasVisibleSection: () => true,
  },
];

export function visibleCategories(
  toggles: readonly Toggle[],
  categories: readonly SettingsCategory[] = SETTINGS_CATEGORIES,
) {
  return categories.filter((category) => category.hasVisibleSection(toggles));
}
