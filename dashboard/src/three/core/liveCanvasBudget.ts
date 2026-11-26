export const MAX_LIVE_CANVASES = 3;

const live = new Set<string>();
const played = new Set<string>();

export function acquireCanvas(id: string): boolean {
  if (live.has(id)) return true;
  if (live.size >= MAX_LIVE_CANVASES) return false;
  live.add(id);
  return true;
}

export function releaseCanvas(id: string): void {
  live.delete(id);
}

export function hasPlayed(id: string): boolean {
  return played.has(id);
}

export function markPlayed(id: string): void {
  played.add(id);
}

export function clearPlayed(id: string): void {
  played.delete(id);
}

export function getLiveCanvasCount(): number {
  return live.size;
}

export function resetCanvasBudgetForTests(): void {
  live.clear();
  played.clear();
}
