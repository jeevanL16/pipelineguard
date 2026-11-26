import React, { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Color, InstancedMesh, Matrix4, MathUtils, Mesh, MeshBasicMaterial, Vector3 } from "three";
import {
  L,
  SEVERITY_GLYPH_GEOMETRIES,
  Scene3D,
  UNIT_BOX_GEOMETRY,
  UNIT_SHADED_BOX_GEOMETRY,
  useGatehouseTheme,
  useInvalidateWhile,
} from "../core";
import type { Scene3DMode } from "../core/useScene3DMode";
import { useHeroScanStore, type HeroScanSnapshot } from "../state/heroScanStore";

const GATE_PARTS = 5; // 2 posts + 2 lintels + 1 center crown notch

function HeroGateCanvas({
  mode,
  snapshot,
}: {
  mode: Scene3DMode;
  snapshot: HeroScanSnapshot;
}) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const { colors, version } = useGatehouseTheme(invalidate);

  const tilesCount = Math.max(1, snapshot.findings.length);
  const instRef = useRef<InstancedMesh>(null);
  const scanPlaneRef = useRef<Mesh>(null);
  const glyphCritRef = useRef<InstancedMesh>(null);
  const glyphHighRef = useRef<InstancedMesh>(null);
  const glyphLowRef = useRef<InstancedMesh>(null);
  const glyphCheckRef = useRef<InstancedMesh>(null);

  const tileOffsetsRef = useRef<number[]>(Array(tilesCount).fill(0));
  const gateOpenRef = useRef(0);
  const scanYRef = useRef(56);

  const dummyMatrix = useMemo(() => new Matrix4(), []);
  const tmpScale = useMemo(() => new Vector3(), []);
  const tmpColor = useMemo(() => new Color(), []);

  const instMat = useMemo(
    () => new MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    []
  );
  const glyphMat = useMemo(
    () => new MeshBasicMaterial({ toneMapped: false }),
    []
  );
  const scanPlaneMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: colors.primary.clone(),
        toneMapped: false,
        transparent: true,
        opacity: 0.28,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    return () => {
      instMat.dispose();
      glyphMat.dispose();
      scanPlaneMat.dispose();
    };
  }, [instMat, glyphMat, scanPlaneMat]);

  useEffect(() => {
    scanPlaneMat.color.copy(colors.primary);
    invalidate();
  }, [scanPlaneMat, colors, version, invalidate]);

  // Keep tile offset array sized cleanly if findings array changes
  useEffect(() => {
    if (tileOffsetsRef.current.length !== tilesCount) {
      tileOffsetsRef.current = Array(tilesCount).fill(0);
    }
    invalidate();
  }, [tilesCount, snapshot, invalidate]);

  const glyphGroups = useMemo(() => {
    const crit: number[] = [];
    const high: number[] = [];
    const low: number[] = [];
    snapshot.findings.forEach((f, idx) => {
      if (f.severity === "CRITICAL") crit.push(idx);
      else if (f.severity === "HIGH") high.push(idx);
      else low.push(idx);
    });
    return { crit, high, low };
  }, [snapshot.findings]);

  useInvalidateWhile(
    mode,
    (dt, isStatic) => {
      let moving = false;
      const n = snapshot.findings.length;
      const totalH = Math.max(84, n * 15);
      const topY = totalH * 0.5 - 6;

      // Scan plane tracks HeroScanDemo.scanLine strictly
      let targetScanY = -topY - 12;
      const isActivelyScanning =
        (snapshot.phase === "scanning" || snapshot.phase === "rescanning") &&
        snapshot.scanLine !== null;

      if (isActivelyScanning && snapshot.totalLines > 0) {
        const lineFrac = (snapshot.scanLine! - 1) / Math.max(1, snapshot.totalLines - 1);
        targetScanY = topY - lineFrac * totalH;
      }

      if (isStatic) {
        scanYRef.current = targetScanY;
        gateOpenRef.current = snapshot.phase === "fixed" ? 1 : 0;
      } else {
        const nextScan = MathUtils.damp(scanYRef.current, targetScanY, L.state, dt);
        if (Math.abs(targetScanY - nextScan) > 0.15) moving = true;
        scanYRef.current = nextScan;

        const targetOpen = snapshot.phase === "fixed" ? 1 : 0;
        const nextOpen = MathUtils.damp(gateOpenRef.current, targetOpen, L.seal, dt);
        if (Math.abs(targetOpen - nextOpen) > 0.005) moving = true;
        gateOpenRef.current = nextOpen;
      }

      if (scanPlaneRef.current) {
        scanPlaneRef.current.visible = !isStatic && isActivelyScanning;
        scanPlaneRef.current.position.set(0, scanYRef.current, 0);
      }

      // Gate arch + dynamic finding tiles inside ONE single InstancedMesh
      const inst = instRef.current;
      if (inst) {
        const openShift = gateOpenRef.current * 8;
        const postX = 64 + openShift * 0.5;
        const isFixedDone = snapshot.phase === "fixed";

        // 0: Left post, 1: Right post, 2: Left lintel, 3: Right lintel, 4: Crown notch
        const gateSpecs: ReadonlyArray<{
          pos: [number, number, number];
          scale: [number, number, number];
          col: Color;
        }> = [
          { pos: [-postX, 0, -28], scale: [12, 128, 12], col: isFixedDone ? colors.panel : colors.raised },
          { pos: [postX, 0, -28], scale: [12, 128, 12], col: isFixedDone ? colors.panel : colors.raised },
          { pos: [-26 - openShift * 0.4, 58 + openShift, -28], scale: [64, 10, 12], col: isFixedDone ? colors.panel : colors.raised },
          { pos: [26 + openShift * 0.4, 58 + openShift, -28], scale: [64, 10, 12], col: isFixedDone ? colors.panel : colors.raised },
          {
            pos: [0, 58 + openShift, -28],
            scale: [16, 12, 14],
            col: isFixedDone ? colors.primary : colors.lineStrong,
          },
        ];

        for (let g = 0; g < GATE_PARTS; g++) {
          const spec = gateSpecs[g];
          dummyMatrix.makeScale(spec.scale[0], spec.scale[1], spec.scale[2]);
          dummyMatrix.setPosition(spec.pos[0], spec.pos[1], spec.pos[2]);
          inst.setMatrixAt(g, dummyMatrix);
          inst.setColorAt(g, spec.col);
        }

        for (let i = 0; i < n; i++) {
          const f = snapshot.findings[i];
          const isTileFixed =
            snapshot.phase === "fixed" ||
            (snapshot.phase === "rescanning" && i < snapshot.fixedCount);
          const isHit =
            snapshot.phase === "done" ||
            snapshot.phase === "rescanning" ||
            (snapshot.phase === "scanning" && i < snapshot.revealedCount);

          const targetPop = isTileFixed ? 0 : isHit ? 22 : 0;
          const prevPop = tileOffsetsRef.current[i] ?? 0;
          let curPop = targetPop;
          if (!isStatic) {
            curPop = MathUtils.damp(
              prevPop,
              targetPop,
              isTileFixed ? L.swap : L.state,
              dt
            );
            if (Math.abs(targetPop - curPop) > 0.1) moving = true;
            else curPop = targetPop;
          }
          tileOffsetsRef.current[i] = curPop;

          const tileY = topY - i * 16;
          dummyMatrix.makeScale(84, 10, 26);
          dummyMatrix.setPosition(curPop, tileY, 16);
          inst.setMatrixAt(GATE_PARTS + i, dummyMatrix);

          if (isTileFixed) {
            tmpColor.copy(colors.passTint).lerp(colors.pass, 0.35);
          } else if (isHit) {
            tmpColor.copy(
              f.severity === "CRITICAL"
                ? colors.critical
                : f.severity === "HIGH"
                ? colors.high
                : colors.low
            );
          } else {
            tmpColor.copy(colors.panel);
          }
          inst.setColorAt(GATE_PARTS + i, tmpColor);
        }

        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      }

      // Position Severity Glyphs & Verified Checkmarks synchronously
      const updateSeverityGlyphs = (
        ref: React.RefObject<InstancedMesh | null>,
        indices: readonly number[],
        colorVal: Color
      ) => {
        const gInst = ref.current;
        if (!gInst || indices.length === 0) return;
        indices.forEach((fIdx, idx) => {
          const isTileFixed =
            snapshot.phase === "fixed" ||
            (snapshot.phase === "rescanning" && fIdx < snapshot.fixedCount);
          const isHit =
            snapshot.phase === "done" ||
            (snapshot.phase === "rescanning" && !isTileFixed) ||
            (snapshot.phase === "scanning" && fIdx < snapshot.revealedCount);

          const show = !isTileFixed && isHit;
          const scale = show ? 9 : 0.001;
          const tileY = topY - fIdx * 16;
          const curPop = tileOffsetsRef.current[fIdx] ?? 0;

          dummyMatrix.makeRotationX(-Math.PI / 2);
          dummyMatrix.scale(tmpScale.set(scale, scale, 1));
          dummyMatrix.setPosition(curPop - 28, tileY + 6, 16);
          gInst.setMatrixAt(idx, dummyMatrix);
          gInst.setColorAt(idx, colorVal);
        });
        gInst.instanceMatrix.needsUpdate = true;
        if (gInst.instanceColor) gInst.instanceColor.needsUpdate = true;
      };

      updateSeverityGlyphs(glyphCritRef, glyphGroups.crit, colors.onPrimary);
      updateSeverityGlyphs(glyphHighRef, glyphGroups.high, colors.onPrimary);
      updateSeverityGlyphs(glyphLowRef, glyphGroups.low, colors.onPrimary);

      const chkInst = glyphCheckRef.current;
      if (chkInst && n > 0) {
        for (let i = 0; i < n; i++) {
          const isTileFixed =
            snapshot.phase === "fixed" ||
            (snapshot.phase === "rescanning" && i < snapshot.fixedCount);
          const scale = isTileFixed ? 9 : 0.001;
          const tileY = topY - i * 16;
          const curPop = tileOffsetsRef.current[i] ?? 0;
          dummyMatrix.makeRotationX(-Math.PI / 2);
          dummyMatrix.scale(tmpScale.set(scale, scale, 1));
          dummyMatrix.setPosition(curPop - 28, tileY + 6, 16);
          chkInst.setMatrixAt(i, dummyMatrix);
          chkInst.setColorAt(i, colors.pass);
        }
        chkInst.instanceMatrix.needsUpdate = true;
        if (chkInst.instanceColor) chkInst.instanceColor.needsUpdate = true;
      }

      if (typeof window !== "undefined") {
        (window as unknown as { __PG_3D_STATS?: Record<string, { calls: number; triangles: number }> }).__PG_3D_STATS = {
          ...(window as unknown as { __PG_3D_STATS?: Record<string, { calls: number; triangles: number }> }).__PG_3D_STATS,
          heroGate: {
            calls: gl.info.render.calls,
            triangles: gl.info.render.triangles,
          },
        };
      }

      return moving;
    },
    [snapshot, glyphGroups]
  );

  return (
    <group rotation={[0, Math.PI / 8, 0]}>
      <instancedMesh
        ref={instRef}
        args={[UNIT_SHADED_BOX_GEOMETRY, instMat, GATE_PARTS + tilesCount]}
        dispose={null}
      />

      <mesh
        ref={scanPlaneRef}
        geometry={UNIT_BOX_GEOMETRY}
        material={scanPlaneMat}
        dispose={null}
        scale={[108, 3, 44]}
      />

      {glyphGroups.crit.length > 0 && (
        <instancedMesh
          ref={glyphCritRef}
          args={[SEVERITY_GLYPH_GEOMETRIES.diamond, glyphMat, glyphGroups.crit.length]}
          dispose={null}
        />
      )}
      {glyphGroups.high.length > 0 && (
        <instancedMesh
          ref={glyphHighRef}
          args={[SEVERITY_GLYPH_GEOMETRIES.triangle, glyphMat, glyphGroups.high.length]}
          dispose={null}
        />
      )}
      {glyphGroups.low.length > 0 && (
        <instancedMesh
          ref={glyphLowRef}
          args={[SEVERITY_GLYPH_GEOMETRIES.circle, glyphMat, glyphGroups.low.length]}
          dispose={null}
        />
      )}
      <instancedMesh
        ref={glyphCheckRef}
        args={[SEVERITY_GLYPH_GEOMETRIES.check, glyphMat, tilesCount]}
        dispose={null}
      />
    </group>
  );
}

export function HeroGateScene({
  mode,
  fallback,
}: {
  mode: Scene3DMode;
  fallback: React.ReactNode;
}) {
  const snapshot = useHeroScanStore();

  return (
    <Scene3D
      id="hero-gate"
      height={240}
      label="Isometric gate model synchronized with the live workflow scan"
      fallback={fallback}
      overlay={
        snapshot.phase === "fixed" && snapshot.digest ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
            <span className="px-2 py-0.5 rounded-[4px] border border-[var(--pg-pass)]/40 bg-[var(--pg-pass-tint)] text-[var(--pg-pass)] pg-code-sm">
              Verified {snapshot.digest.slice(0, 12)}
            </span>
          </div>
        ) : undefined
      }
    >
      <HeroGateCanvas mode={mode} snapshot={snapshot} />
    </Scene3D>
  );
}
