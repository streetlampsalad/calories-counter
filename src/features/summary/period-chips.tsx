import Link from "next/link";
import { cn } from "@/lib/utils";
import { PERIODS, type PeriodId } from "./period";

// The Period is kept in the URL, so a Period can be linked to and the back button works.
export function PeriodChips({ selected }: { selected: PeriodId }) {
  return (
    <nav aria-label="Period">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {PERIODS.map(({ id, label }) => {
          const current = id === selected;
          return (
            <li key={id} className="shrink-0">
              <Link
                href={`/summary?period=${id}`}
                replace
                scroll={false}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-full border px-4 text-sm",
                  current
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-foreground",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
