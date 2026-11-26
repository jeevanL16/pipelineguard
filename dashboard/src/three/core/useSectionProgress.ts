import { useEffect, useMemo, useRef, type RefObject } from "react";
import { clamp01 } from "./motion3d";
import type { Scene3DMode } from "./useScene3DMode";

export function computeSectionProgress(
  rectTop: number,
  rectHeight: number,
  viewportHeight: number
): number {
  if (viewportHeight <= 0) return 0;
  const denom = 0.5 * viewportHeight + rectHeight;
  if (denom <= 0) return 0;
  return clamp01((0.85 * viewportHeight - rectTop) / denom);
}

export interface SectionProgressStore {
  getProgress: () => number;
  subscribe: (fn: () => void) => () => void;
}

/**
 * Passive scroll + resize observer that tracks 0..1 progress without React per-frame state churn.
 * Sets --gate-progress and data-scene3d="on" so DOM badges and Three.js share one clock.
 */
export function useSectionProgress(
  sectionRef: RefObject<HTMLElement | null>,
  mode: Scene3DMode
): SectionProgressStore {
  const progressRef = useRef<number>(mode === "static" ? 1 : 0);
  const subsRef = useRef(new Set<() => void>());

  const store = useMemo<SectionProgressStore>(
    () => ({
      getProgress: () => progressRef.current,
      subscribe: (fn: () => void) => {
        subsRef.current.add(fn);
        return () => {
          subsRef.current.delete(fn);
        };
      },
    }),
    []
  );

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const notify = () => {
      subsRef.current.forEach((fn) => fn());
    };

    if (mode === "static") {
      el.setAttribute("data-scene3d", "on");
      el.style.setProperty("--gate-progress", "1");
      progressRef.current = 1;
      notify();
      return () => {
        el.removeAttribute("data-scene3d");
        el.style.removeProperty("--gate-progress");
      };
    }

    if (mode === "fallback") {
      el.removeAttribute("data-scene3d");
      el.style.removeProperty("--gate-progress");
      return;
    }

    el.setAttribute("data-scene3d", "on");

    let rafId = 0;
    const measure = () => {
      rafId = 0;
      const node = sectionRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const next = computeSectionProgress(rect.top, rect.height, window.innerHeight);
      if (Math.abs(next - progressRef.current) > 0.0005 || next === 0 || next === 1) {
        progressRef.current = next;
        node.style.setProperty("--gate-progress", next.toFixed(4));
        notify();
      }
    };

    const schedule = () => {
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      el.removeAttribute("data-scene3d");
      el.style.removeProperty("--gate-progress");
    };
  }, [sectionRef, mode]);

  return store;
}
