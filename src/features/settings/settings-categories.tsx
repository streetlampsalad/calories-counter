"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { useToggles } from "@/features/toggles/queries";
import { AppearanceSection } from "./appearance-section";
import { BurnedSection } from "./burned-section";
import {
  SETTINGS_CATEGORIES,
  SETTINGS_CATEGORIES_TOGGLE,
  type SettingsCategory,
  type SettingsCategoryId,
  visibleCategories,
} from "./categories";
import { FeatureRequestsRow } from "./feature-requests-row";
import { GoalSection } from "./goal-section";
import { ReminderSection } from "./reminder-section";
import { TryFeaturesSection } from "./try-features-section";
import { VibrationSection } from "./vibration-section";
import { WeekStartSection } from "./week-start-section";

const SECTIONS: Record<SettingsCategoryId, () => ReactNode> = {
  tracking: () => (
    <>
      <GoalSection />
      <BurnedSection />
      <WeekStartSection />
    </>
  ),
  preferences: () => (
    <>
      <ReminderSection />
      <VibrationSection />
      <AppearanceSection />
    </>
  ),
  features: () => (
    <>
      <TryFeaturesSection />
      <FeatureRequestsRow />
    </>
  ),
};

// Whether the Toggle is on, off, or not known yet (loading or failed to load).
function useCategoriesToggle() {
  const { data, isPending } = useToggles();
  const on = data?.find((t) => t.key === SETTINGS_CATEGORIES_TOGGLE)?.isOn;
  return { toggles: data ?? [], on: on === true, loaded: !isPending && !!data };
}

// /settings: category rows where the Toggle is on, today's single list otherwise (including
// while Toggles load or after they fail, so the page is never empty).
export function SettingsHome({
  categories = SETTINGS_CATEGORIES,
  children,
}: {
  categories?: readonly SettingsCategory[];
  // About and Account, which are server components and show in both layouts.
  children: ReactNode;
}) {
  const { toggles, on } = useCategoriesToggle();

  return (
    <main className="flex flex-1 flex-col gap-6">
      <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
      {on ? (
        <nav aria-label="Settings categories">
          <ul className="flex flex-col">
            {visibleCategories(toggles, categories).map((category) => (
              <li key={category.id}>
                <Link
                  href={`/settings/${category.id}`}
                  className="flex min-h-14 items-center justify-between gap-4 py-2"
                >
                  <span className="flex flex-col">
                    <span className="font-medium text-lg">
                      {category.title}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {category.description}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-5 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <>
          {SECTIONS.tracking()}
          {SECTIONS.preferences()}
          {SECTIONS.features()}
        </>
      )}
      {children}
    </main>
  );
}

// /settings/<category>: the category's sections with a way back. Where the Toggle is off (or
// cannot be read) the route does not exist for the User, so it sends them to /settings.
export function SettingsCategoryPage({ id }: { id: SettingsCategoryId }) {
  const router = useRouter();
  const { on, loaded } = useCategoriesToggle();
  const { isPending } = useToggles();
  const settled = !isPending;

  useEffect(() => {
    if (settled && !(loaded && on)) router.replace("/settings");
  }, [settled, loaded, on, router]);

  if (!(settled && loaded && on)) return <div className="h-32" />;

  const category = SETTINGS_CATEGORIES.find((c) => c.id === id);

  return (
    <main className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/settings"
          className="-ml-1 flex min-h-11 items-center gap-1 text-muted-foreground text-sm"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
          Settings
        </Link>
        <h1 className="font-semibold text-2xl tracking-tight">
          {category?.title}
        </h1>
      </div>
      {SECTIONS[id]()}
    </main>
  );
}
