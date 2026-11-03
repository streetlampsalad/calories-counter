// A photo chosen in the Add food sheet is passed to the import screen, which is a different page,
// so it waits here (in memory, never stored anywhere) until that screen picks it up.
let pending: File | null = null;

export function setPendingPhoto(file: File) {
  pending = file;
}

// Hands over the waiting photo, once.
export function takePendingPhoto(): File | null {
  const file = pending;
  pending = null;
  return file;
}
