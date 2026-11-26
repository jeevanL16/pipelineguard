import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Scene3DMode } from "./useScene3DMode";

/**
 * Runs `step(dt, isStatic)` per R3F frame under frameloop="demand".
 * Calls `invalidate()` ONLY while `step` returns `true` (values still settling).
 * Stops completely once settled so idle GPU usage stays at zero.
 */
export function useInvalidateWhile(
  mode: Scene3DMode,
  step: (dt: number, isStatic: boolean) => boolean,
  deps: readonly unknown[] = []
): void {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, invalidate, ...deps]);

  useFrame((state, dt) => {
    const clampedDt = Math.min(dt, 0.05);
    const keepGoing = step(clampedDt, mode === "static");
    if (keepGoing && mode !== "static") {
      state.invalidate();
    }
  });
}
