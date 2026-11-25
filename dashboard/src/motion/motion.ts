/**
 * Motion timing and easing tokens mirrored directly from DESIGN.md.
 * Never hard-code motion durations inside individual components.
 */
export const MOTION = {
  stateChange: { duration: 0.12, ease: [0, 0, 0.2, 1] as const },
  surfaceEnter: { duration: 0.24, ease: [0.2, 0, 0, 1] as const },
  surfaceExit: { duration: 0.16, ease: [0.3, 0, 1, 1] as const },
  rowFlashMs: 600,
  scanLineMs: 70,
  diffSwapMs: 200,
  sealStamp: { duration: 0.24, ease: [0.2, 0, 0, 1] as const },
  viewChange: { duration: 0.2, ease: [0.42, 0, 0.58, 1] as const },
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Progressive-enhancement wrapper around document.startViewTransition.
 * Falls back synchronously when unsupported or when reduced motion is preferred.
 */
export function runViewTransition(update: () => void): void {
  if (
    typeof document !== "undefined" &&
    "startViewTransition" in document &&
    typeof document.startViewTransition === "function" &&
    !prefersReducedMotion()
  ) {
    document.startViewTransition(update);
  } else {
    update();
  }
}
