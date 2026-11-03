"use client";

import { useState } from "react";
import type { ImportRow } from "./parse";
import { readPhoto, resizePhoto } from "./photo";

export type ScanStatus =
  | "idle"
  | "reading"
  | "empty"
  | "unavailable"
  | "failed";

// Reads one photo at a time: shrink it on the device, send it, and hand any rows found to Import Review.
export function usePhotoScan(onRows: (rows: ImportRow[]) => void) {
  const [status, setStatus] = useState<ScanStatus>("idle");

  async function scan(file: Blob) {
    setStatus("reading");
    let photo: Blob;
    try {
      photo = await resizePhoto(file);
    } catch {
      setStatus("failed");
      return;
    }
    const result = await readPhoto(photo);
    if (result.kind === "rows") {
      onRows(result.rows);
      setStatus("idle");
    } else {
      setStatus(result.kind);
    }
  }

  return { status, scan, dismiss: () => setStatus("idle") };
}
