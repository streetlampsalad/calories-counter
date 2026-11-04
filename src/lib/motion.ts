// True when the device asks apps to keep movement to a minimum. Animations that only decorate
// (counting, sliding) skip straight to where they end up.
export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
