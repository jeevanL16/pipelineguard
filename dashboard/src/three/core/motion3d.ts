import { MathUtils } from "three";
import { MOTION } from "../../motion/motion";

export function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * Computes an exponential damping lambda so THREE.MathUtils.damp settles (~98%) in `ms`.
 */
export function lambdaFor(ms: number): number {
  return 4000 / Math.max(1, ms);
}

export const STAGE_AT = [0.12, 0.37, 0.62, 0.87] as const;

export function stageLit(progress: number, index: number): number {
  const target = STAGE_AT[index] ?? 0;
  return MathUtils.smoothstep(progress, target - 0.06, target + 0.06);
}

export const L = {
  enter: lambdaFor(MOTION.surfaceEnter.duration * 1000),
  state: lambdaFor(MOTION.stateChange.duration * 1000),
  swap: lambdaFor(MOTION.diffSwapMs),
  seal: lambdaFor(MOTION.sealStamp.duration * 1000),
} as const;

export const SCAN_LINE_MS = MOTION.scanLineMs;
export const DIFF_SWAP_MS = MOTION.diffSwapMs;
