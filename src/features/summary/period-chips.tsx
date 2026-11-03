import Link from "next/link";
import { cn } from "@/lib/utils";
import { PERIODS } from "./period";

type Option = { id: string; label: string };

type Props = {
  selected: string;
  /** The choices; the five Summary Periods unless given. */
  options?: ReadonlyArray<Option>;
  /** Where each choice goes; the Summary's own address unless given. */
  hrefFor?: (id: string) => string;
};

// The chosen range is kept in the URL, so it can be linked to and the back button works.
export function PeriodChips({
  selected,
  options = PERIODS,
  hrefFor = (id) => `/summary?period=${id}`,
}: Props) {
  return (
    <nav aria-label="Period">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {options.map(({ id, label }) => {
          const current = id === selected;
          return (
            <li key={id} className="shrink-0">
              <Link
                href={hrefFor(id)}
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
