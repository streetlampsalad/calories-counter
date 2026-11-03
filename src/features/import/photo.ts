import type { ImportRow } from "./parse";

// Notes are readable well below a phone camera's full size, and a smaller upload is faster.
export const MAX_PHOTO_SIDE = 1600;
const JPEG_QUALITY = 0.85;

// The size a photo is scaled to so its longest side is at most `max`, keeping its shape.
export function fitWithin(width: number, height: number, max: number) {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export type Decoded = { width: number; height: number; close: () => void };
export type Imaging = {
  decode: (file: Blob) => Promise<Decoded>;
  encode: (picture: Decoded, width: number, height: number) => Promise<Blob>;
};

// The browser's own decoder and canvas. `imageOrientation` applies the camera's rotation, so a
// photo taken upright is read upright.
const browserImaging: Imaging = {
  decode: (file) => createImageBitmap(file, { imageOrientation: "from-image" }),
  encode: async (picture, width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no canvas");
    context.drawImage(picture as ImageBitmap, 0, 0, width, height);
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("no image"))),
        "image/jpeg",
        JPEG_QUALITY,
      ),
    );
  },
};

// Shrinks a photo on the device and re-encodes it as JPEG before anything is uploaded.
export async function resizePhoto(
  file: Blob,
  imaging: Imaging = browserImaging,
): Promise<Blob> {
  let picture: Decoded;
  try {
    picture = await imaging.decode(file);
  } catch {
    throw new Error("Couldn't read that photo. Try taking it again.");
  }
  try {
    const { width, height } = fitWithin(
      picture.width,
      picture.height,
      MAX_PHOTO_SIDE,
    );
    return await imaging.encode(picture, width, height);
  } finally {
    picture.close();
  }
}

export type PhotoResult =
  | { kind: "rows"; rows: ImportRow[] }
  | { kind: "empty" }
  | { kind: "unavailable" }
  | { kind: "failed" };

// Sends the resized photo to the server, which reads it and forgets it.
export async function readPhoto(photo: Blob): Promise<PhotoResult> {
  try {
    const response = await fetch("/api/import/photo", {
      method: "POST",
      headers: { "content-type": "image/jpeg" },
      body: photo,
    });
    // Out of quota, the service being down, or this User's daily limit: all "use an AI app".
    if (response.status === 503 || response.status === 429) {
      return { kind: "unavailable" };
    }
    if (!response.ok) return { kind: "failed" };
    const { rows } = (await response.json()) as { rows: ImportRow[] };
    return rows.length > 0 ? { kind: "rows", rows } : { kind: "empty" };
  } catch {
    return { kind: "failed" };
  }
}
