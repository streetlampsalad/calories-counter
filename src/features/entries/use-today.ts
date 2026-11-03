"use client";

import { useEffect, useState } from "react";
import { localDateString } from "./days";

// Today on this device. Null until mounted, because the server doesn't know the User's time zone.
export function useToday(): string | null {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setToday(localDateString(new Date()));
    update();
    // A phone left open past midnight moves to the new Day when it is looked at again.
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return today;
}
