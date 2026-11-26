import { describe, expect, it, beforeEach } from "vitest";
import { Color } from "three";
import {
  MAX_LIVE_CANVASES,
  STAGE_AT,
  acquireCanvas,
  clamp01,
  computeSectionProgress,
  deriveFaceShades,
  getLiveCanvasCount,
  hasPlayed,
  lambdaFor,
  markPlayed,
  releaseCanvas,
  resetCanvasBudgetForTests,
  stageLit,
} from "../index";

describe("three/core primitives", () => {
  beforeEach(() => {
    resetCanvasBudgetForTests();
  });

  it("caps simultaneous live WebGL canvases at MAX_LIVE_CANVASES (3)", () => {
    expect(MAX_LIVE_CANVASES).toBe(3);
    expect(acquireCanvas("s1")).toBe(true);
    expect(acquireCanvas("s2")).toBe(true);
    expect(acquireCanvas("s3")).toBe(true);
    expect(acquireCanvas("s4")).toBe(false);
    expect(getLiveCanvasCount()).toBe(3);

    // Re-acquiring already active id is idempotent
    expect(acquireCanvas("s2")).toBe(true);

    releaseCanvas("s2");
    expect(acquireCanvas("s4")).toBe(true);
    expect(getLiveCanvasCount()).toBe(3);
  });

  it("records played-once scenes independently of release", () => {
    expect(hasPlayed("hero-gate")).toBe(false);
    markPlayed("hero-gate");
    releaseCanvas("hero-gate");
    expect(hasPlayed("hero-gate")).toBe(true);
  });

  it("computes section scroll progress clamped 0..1 cleanly", () => {
    // At top = 0.85 * vh -> progress = 0
    expect(computeSectionProgress(850, 300, 1000)).toBeCloseTo(0, 6);
    // Above 85% -> > 0
    expect(computeSectionProgress(450, 300, 1000)).toBeGreaterThan(0.4);
    // At bottom = 0.35 * vh -> rectTop + rectHeight = 0.35 * vh -> progress = 1
    expect(computeSectionProgress(50, 300, 1000)).toBeCloseTo(1, 6);
    // Far scrolled past -> clamped at 1
    expect(computeSectionProgress(-400, 300, 1000)).toBe(1);
    // Far below -> clamped at 0
    expect(computeSectionProgress(1400, 300, 1000)).toBe(0);
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.8)).toBe(1);
  });

  it("evaluates STAGE_AT thresholds and stageLit smoothsteps cleanly", () => {
    expect(STAGE_AT).toEqual([0.12, 0.37, 0.62, 0.87]);
    expect(stageLit(0, 0)).toBe(0);
    expect(stageLit(0.12, 0)).toBeCloseTo(0.5, 4);
    expect(stageLit(0.2, 0)).toBe(1);
    expect(stageLit(1, 3)).toBe(1);
    expect(lambdaFor(240)).toBeCloseTo(4000 / 240, 4);
  });

  it("derives flat 3-face isometric tones strictly from token + ink (0% / 12% / 22%)", () => {
    const base = new Color("#5CC9B0");
    const ink = new Color("#0E181D");
    const shades = deriveFaceShades(base, ink);
    expect(shades.top.getHexString()).toBe(base.getHexString());
    expect(shades.left.getHexString()).toBe(base.clone().lerp(ink, 0.12).getHexString());
    expect(shades.right.getHexString()).toBe(base.clone().lerp(ink, 0.22).getHexString());
  });
});
