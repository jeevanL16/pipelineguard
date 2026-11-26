import { useSyncExternalStore } from "react";
import type { WorkflowFinding } from "../../rules/schemas";

export type HeroScanPhase = "idle" | "scanning" | "done" | "rescanning" | "fixed";

export interface HeroScanSnapshot {
  phase: HeroScanPhase;
  scanLine: number | null;
  totalLines: number;
  findings: readonly WorkflowFinding[];
  revealedCount: number;
  fixedCount: number;
  digest: string | null;
}

const INITIAL_STATE: HeroScanSnapshot = {
  phase: "idle",
  scanLine: null,
  totalLines: 15,
  findings: [],
  revealedCount: 0,
  fixedCount: 0,
  digest: null,
};

let state: HeroScanSnapshot = INITIAL_STATE;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

export function setHeroScanState(patch: Partial<HeroScanSnapshot>): void {
  const next: HeroScanSnapshot = { ...state, ...patch };
  if (
    next.phase === state.phase &&
    next.scanLine === state.scanLine &&
    next.totalLines === state.totalLines &&
    next.findings === state.findings &&
    next.revealedCount === state.revealedCount &&
    next.fixedCount === state.fixedCount &&
    next.digest === state.digest
  ) {
    return;
  }
  state = next;
  emit();
}

export function getHeroScanState(): HeroScanSnapshot {
  return state;
}

export function subscribeHeroScan(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetHeroScanStoreForTests(): void {
  state = INITIAL_STATE;
  emit();
}

export function useHeroScanStore(): HeroScanSnapshot {
  return useSyncExternalStore(subscribeHeroScan, getHeroScanState, getHeroScanState);
}
