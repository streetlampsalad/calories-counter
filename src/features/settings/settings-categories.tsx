"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useToggles } from "@/features/toggles/queries";
import { AppearanceSection } from "./appearance-section";
import { BurnedSection } from "./burned-section";
import {
  SETTINGS_CATEGORIES,
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

// /settings: the category rows, then About and Account.
export function SettingsHome({
  categories = SETTINGS_CATEGORIES,
  children,
}: {
  categories?: readonly SettingsCategory[];
  // About and Account, which are server components and show in both layouts.
  children: ReactNode;
}) {
  const { data } = useToggles();
  const toggles = data ?? [];

  return (
    <main className="flex flex-1 flex-col gap-6">
      <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
      <nav aria-label="Settings categories">
        <ul className="flex flex-col">
          {visibleCategories(toggles, categories).map((category) => (
            <li key={category.id}>
              <Link
                href={`/settings/${category.id}`}
                className="flex min-h-14 items-center justify-between gap-4 py-2"
              >
                <span className="flex flex-col">
                  <span className="font-medium text-lg">{category.title}</span>
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
      {children}
    </main>
  );
}

// /settings/<category>: the category's sections with a way back.
export function SettingsCategoryPage({ id }: { id: SettingsCategoryId }) {
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
