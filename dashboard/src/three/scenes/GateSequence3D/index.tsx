import React, { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import {
  Color,
  EdgesGeometry,
  InstancedMesh,
  LineBasicMaterial,
  Matrix4,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";
import {
  L,
  SEVERITY_GLYPH_GEOMETRIES,
  STAGE_AT,
  Scene3D,
  UNIT_BOX_GEOMETRY,
  UNIT_SHADED_BOX_GEOMETRY,
  stageLit,
  useGatehouseTheme,
  useInvalidateWhile,
  type SectionProgressStore,
} from "../../core";
import { SEVERITY_META } from "../../../rules/severity";
import { LedgerChainGroup } from "../LedgerChain3D";
import type { Scene3DMode } from "../../core/useScene3DMode";
import type { GateSequenceSummary } from "./sequenceData";

const INV_SQRT2 = Math.SQRT1_2;

/** Converts screen-space horizontal pixel offset `sx` into isometric world (x, z) along camera-right axis. */
function worldAtScreenX(sx: number): readonly [number, number] {
  return [sx * INV_SQRT2, -sx * INV_SQRT2];
}

export interface GateSequenceCanvasSceneProps {
  stationScreenXs: readonly [number, number, number, number];
  summary: GateSequenceSummary;
  mode: Scene3DMode;
  progressStore: SectionProgressStore;
  replayTrigger: number;
  onStationStatesChange?: (litStations: readonly [boolean, boolean, boolean, boolean]) => void;
}

export function GateSequenceCanvasScene({
  stationScreenXs,
  summary,
  mode,
  progressStore,
  replayTrigger,
  onStationStatesChange,
}: GateSequenceCanvasSceneProps) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const { colors, version } = useGatehouseTheme(invalidate);

  const railRef = useRef<Mesh>(null);
  const packetRef = useRef<Mesh>(null);
  const scanPlaneRef = useRef<Mesh>(null);
  const repoWireRef = useRef<Mesh>(null);
  const padsInstRef = useRef<InstancedMesh>(null);
  const astInstRef = useRef<InstancedMesh>(null);
  const scoreInstRef = useRef<InstancedMesh>(null);

  const smoothP = useRef(mode === "static" ? 1 : progressStore.getProgress());
  const replayActiveRef = useRef(false);
  const replayProgressRef = useRef(0);
  const lastReportedRef = useRef<string>("");

  const dummyMatrix = useMemo(() => new Matrix4(), []);
  const tmpScale = useMemo(() => new Vector3(), []);
  const tmpColor = useMemo(() => new Color(), []);
  const unitEdges = useMemo(() => new EdgesGeometry(UNIT_BOX_GEOMETRY), []);

  const railMat = useMemo(
    () => new MeshBasicMaterial({ color: colors.primary.clone(), vertexColors: true, toneMapped: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const packetMat = useMemo(
    () => new MeshBasicMaterial({ color: colors.primary.clone(), vertexColors: true, toneMapped: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const scanPlaneMat = useMemo(
    () => new MeshBasicMaterial({ color: colors.primary.clone(), toneMapped: false, transparent: true, opacity: 0.25 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const instMat = useMemo(
    () => new MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    []
  );
  const glyphMat = useMemo(
    () => new MeshBasicMaterial({ toneMapped: false }),
    []
  );
  const wireMat = useMemo(
    () => new LineBasicMaterial({ color: colors.lineStrong.clone(), toneMapped: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    return () => {
      unitEdges.dispose();
      railMat.dispose();
      packetMat.dispose();
      scanPlaneMat.dispose();
      instMat.dispose();
      glyphMat.dispose();
      wireMat.dispose();
    };
  }, [unitEdges, railMat, packetMat, scanPlaneMat, instMat, glyphMat, wireMat]);

  useEffect(() => {
    railMat.color.copy(colors.primary);
    packetMat.color.copy(colors.primary);
    scanPlaneMat.color.copy(colors.primary);
    wireMat.color.copy(colors.lineStrong);
    invalidate();
  }, [railMat, packetMat, scanPlaneMat, wireMat, colors, version, invalidate]);

  useEffect(() => {
    const unsub = progressStore.subscribe(() => {
      invalidate();
    });
    return unsub;
  }, [progressStore, invalidate]);

  useEffect(() => {
    if (replayTrigger > 0 && mode !== "static") {
      replayProgressRef.current = 0;
      smoothP.current = 0;
      replayActiveRef.current = true;
      invalidate();
    }
  }, [replayTrigger, mode, invalidate]);

  const tileCount = summary.workflowPaths.length;
  const astCount = Math.max(1, summary.astNodes.length);
  const scoreItemCount = 5; // 3 factor bars + 1 result column + 1 threshold plane
  const glyphCriticalInstRef = useRef<InstancedMesh>(null);
  const glyphHighInstRef = useRef<InstancedMesh>(null);
  const glyphOtherInstRef = useRef<InstancedMesh>(null);

  const findingAstGroups = useMemo(() => {
    const crit: number[] = [];
    const high: number[] = [];
    const other: number[] = [];
    summary.astNodes.forEach((node, idx) => {
      if (node.findingSeverity === "CRITICAL") crit.push(idx);
      else if (node.findingSeverity === "HIGH") high.push(idx);
      else if (node.findingSeverity) other.push(idx);
    });
    return { crit, high, other };
  }, [summary.astNodes]);

  useInvalidateWhile(
    mode,
    (dt, isStatic) => {
      let target = progressStore.getProgress();
      let stillMoving = false;

      if (isStatic) {
        smoothP.current = 1;
        target = 1;
      } else if (replayActiveRef.current) {
        replayProgressRef.current = Math.min(1, replayProgressRef.current + dt * 0.72);
        smoothP.current = replayProgressRef.current;
        if (replayProgressRef.current >= 1) {
          replayActiveRef.current = false;
        } else {
          stillMoving = true;
        }
      } else {
        const prev = smoothP.current;
        smoothP.current = MathUtils.damp(prev, target, L.enter, dt);
        if (Math.abs(target - smoothP.current) > 0.002) {
          stillMoving = true;
        } else {
          smoothP.current = target;
        }
      }

      const p = smoothP.current;
      const lit = [
        stageLit(p, 0),
        stageLit(p, 1),
        stageLit(p, 2),
        stageLit(p, 3),
      ] as const;

      const litSig = lit.map((v) => (v >= 0.5 ? "1" : "0")).join("");
      if (litSig !== lastReportedRef.current) {
        lastReportedRef.current = litSig;
        onStationStatesChange?.([
          lit[0] >= 0.5,
          lit[1] >= 0.5,
          lit[2] >= 0.5,
          lit[3] >= 0.5,
        ]);
      }

      const minSx = stationScreenXs[0];
      const maxSx = stationScreenXs[3];
      const spanSx = Math.max(120, maxSx - minSx);

      // 1. Rail along screen-right axis from station 0 -> station 3 scaled by progress p
      if (railRef.current) {
        const curLen = Math.max(4, spanSx * p);
        const midSx = minSx + curLen * 0.5;
        const [wx, wz] = worldAtScreenX(midSx);
        railRef.current.position.set(wx, -12, wz);
        railRef.current.scale.set(curLen, 4, 6);
      }

      // 2. Packet sliding along rail from station 0 -> station 3
      if (packetRef.current) {
        const pktSx = minSx + spanSx * p;
        const [px, pz] = worldAtScreenX(pktSx);
        packetRef.current.position.set(px, -4, pz);
      }

      // 3. 4 Station Base Slabs + Port Socket + Station 1 Path Tiles combined in 1 InstancedMesh
      if (padsInstRef.current) {
        for (let i = 0; i < 4; i++) {
          const [sx, sz] = worldAtScreenX(stationScreenXs[i]);
          dummyMatrix.makeScale(128, 6, 68);
          dummyMatrix.setPosition(sx, -22, sz);
          padsInstRef.current.setMatrixAt(i, dummyMatrix);
          tmpColor.copy(colors.panel).lerp(colors.primary, lit[i] * 0.18);
          padsInstRef.current.setColorAt(i, tmpColor);
        }
        // Index 4: Station 1 Port Socket slab
        const [s1x, s1z] = worldAtScreenX(stationScreenXs[0] + 18);
        dummyMatrix.makeScale(30, 14, 30);
        dummyMatrix.setPosition(s1x, -8, s1z);
        padsInstRef.current.setMatrixAt(4, dummyMatrix);
        tmpColor.copy(colors.lineStrong).lerp(colors.primary, lit[0]);
        padsInstRef.current.setColorAt(4, tmpColor);

        // Indices 5..5+tileCount-1: Workflow path tiles (count from sampleWorkflows)
        const [bx, bz] = worldAtScreenX(stationScreenXs[0] - 28);
        for (let i = 0; i < tileCount; i++) {
          const row = Math.floor(i / 2);
          const col = i % 2;
          const tileLit = clampStep(lit[0], i / Math.max(1, tileCount));
          dummyMatrix.makeScale(16, 4, 14);
          dummyMatrix.setPosition(bx + (col - 0.5) * 20, -10 + tileLit * 4, bz + (row - 0.5) * 18);
          padsInstRef.current.setMatrixAt(5 + i, dummyMatrix);
          tmpColor.copy(colors.lineStrong).lerp(colors.primary, tileLit);
          padsInstRef.current.setColorAt(5 + i, tmpColor);
        }

        padsInstRef.current.instanceMatrix.needsUpdate = true;
        if (padsInstRef.current.instanceColor) padsInstRef.current.instanceColor.needsUpdate = true;
      }

      // Station 1: Repo cube sliding into socket
      if (repoWireRef.current) {
        const slideOffset = (1 - lit[0]) * -46 + 18;
        const [rx, rz] = worldAtScreenX(stationScreenXs[0] + slideOffset);
        repoWireRef.current.position.set(rx, 8, rz);
        wireMat.color.copy(colors.lineStrong).lerp(colors.primary, lit[0]);
      }

      // Station 2: Parsed AST tree nodes + Scan plane sweeping L->R
      const [s2x, s2z] = worldAtScreenX(stationScreenXs[1]);
      if (scanPlaneRef.current) {
        const sweepSx = stationScreenXs[1] - 48 + lit[1] * 96;
        const [swx, swz] = worldAtScreenX(sweepSx);
        scanPlaneRef.current.position.set(swx, 8, swz);
        scanPlaneRef.current.visible = lit[1] > 0.02 && lit[1] < 0.99;
      }
      if (astInstRef.current) {
        const n = summary.astNodes.length;
        for (let i = 0; i < n; i++) {
          const node = summary.astNodes[i];
          const xNorm = n > 1 ? i / (n - 1) : 0.5;
          const ox = (xNorm - 0.5) * 86;
          const oy = (2 - node.depth) * 12;
          const oz = (node.depth - 1) * 16;
          const swept = lit[1] >= xNorm * 0.85;
          dummyMatrix.makeScale(12, 10, 12);
          dummyMatrix.setPosition(s2x + ox * INV_SQRT2, oy, s2z - ox * INV_SQRT2 + oz);
          astInstRef.current.setMatrixAt(i, dummyMatrix);

          if (swept && node.findingSeverity) {
            tmpColor.copy(
              node.findingSeverity === "CRITICAL"
                ? colors.critical
                : node.findingSeverity === "HIGH"
                ? colors.high
                : colors.low
            );
          } else {
            tmpColor.copy(colors.lineStrong).lerp(colors.primary, swept ? 0.55 : 0);
          }
          astInstRef.current.setColorAt(i, tmpColor);
        }
        astInstRef.current.instanceMatrix.needsUpdate = true;
        if (astInstRef.current.instanceColor) astInstRef.current.instanceColor.needsUpdate = true;
      }

      // Update instanced severity glyph badges over swept finding AST nodes
      const updateGlyphBatch = (
        ref: React.RefObject<InstancedMesh | null>,
        indices: readonly number[],
        colorVal: Color
      ) => {
        const inst = ref.current;
        if (!inst || indices.length === 0) return;
        const n = summary.astNodes.length;
        indices.forEach((nodeIdx, gIdx) => {
          const node = summary.astNodes[nodeIdx];
          const xNorm = n > 1 ? nodeIdx / (n - 1) : 0.5;
          const ox = (xNorm - 0.5) * 86;
          const oy = (2 - node.depth) * 12;
          const oz = (node.depth - 1) * 16;
          const visibleScale = lit[1] >= xNorm * 0.85 ? 8 : 0.001;
          dummyMatrix.makeRotationX(-Math.PI / 2);
          dummyMatrix.scale(tmpScale.set(visibleScale, visibleScale, 1));
          dummyMatrix.setPosition(s2x + ox * INV_SQRT2, oy + 7, s2z - ox * INV_SQRT2 + oz);
          inst.setMatrixAt(gIdx, dummyMatrix);
          inst.setColorAt(gIdx, colorVal);
        });
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      };
      updateGlyphBatch(glyphCriticalInstRef, findingAstGroups.crit, colors.critical);
      updateGlyphBatch(glyphHighInstRef, findingAstGroups.high, colors.high);
      updateGlyphBatch(glyphOtherInstRef, findingAstGroups.other, colors.low);

      // Station 3: Input bars + Result Score Column + 70-point CI Threshold Plane
      if (scoreInstRef.current) {
        const [s3x, s3z] = worldAtScreenX(stationScreenXs[2]);
        const inputs = [
          summary.riskFactors.severityNormalized,
          summary.riskFactors.confidenceNormalized,
          summary.riskFactors.triggerNormalized,
        ];
        const barOffsets = [-32, -14, 4];
        for (let i = 0; i < 3; i++) {
          const rise = clampStep(lit[2], i * 0.18);
          const h = Math.max(3, 36 * inputs[i] * rise);
          const [bx, bz] = worldAtScreenX(stationScreenXs[2] + barOffsets[i]);
          dummyMatrix.makeScale(10, h, 10);
          dummyMatrix.setPosition(bx, -18 + h * 0.5, bz);
          scoreInstRef.current.setMatrixAt(i, dummyMatrix);
          tmpColor.copy(colors.lineStrong).lerp(colors.primary, rise);
          scoreInstRef.current.setColorAt(i, tmpColor);
        }

        // Result score column (index 3)
        const resultRise = clampStep(lit[2], 0.4);
        const maxColH = 54;
        const scoreH = Math.max(4, maxColH * (summary.analysis.risk.score / 100) * resultRise);
        const [rx, rz] = worldAtScreenX(stationScreenXs[2] + 28);
        dummyMatrix.makeScale(16, scoreH, 16);
        dummyMatrix.setPosition(rx, -18 + scoreH * 0.5, rz);
        scoreInstRef.current.setMatrixAt(3, dummyMatrix);
        const exceeds = summary.analysis.risk.score * resultRise >= summary.threshold;
        scoreInstRef.current.setColorAt(3, exceeds ? colors.critical : colors.primary);

        // Threshold plane (index 4) at threshold / 100 height
        const threshY = -18 + maxColH * (summary.threshold / 100);
        dummyMatrix.makeScale(28, 2, 28);
        dummyMatrix.setPosition(rx, threshY, rz);
        scoreInstRef.current.setMatrixAt(4, dummyMatrix);
        scoreInstRef.current.setColorAt(4, colors.high);

        scoreInstRef.current.instanceMatrix.needsUpdate = true;
        if (scoreInstRef.current.instanceColor) scoreInstRef.current.instanceColor.needsUpdate = true;
      }

      if (typeof window !== "undefined") {
        (window as unknown as { __PG_3D_STATS?: Record<string, { calls: number; triangles: number }> }).__PG_3D_STATS = {
          ...(window as unknown as { __PG_3D_STATS?: Record<string, { calls: number; triangles: number }> }).__PG_3D_STATS,
          gateSequence: {
            calls: gl.info.render.calls,
            triangles: gl.info.render.triangles,
          },
        };
      }

      return stillMoving;
    },
    [stationScreenXs, summary, tileCount]
  );

  const [s4x, s4z] = worldAtScreenX(stationScreenXs[3]);
  const s4Lit = stageLit(mode === "static" ? 1 : progressStore.getProgress(), 3);

  return (
    <group>
      <instancedMesh
        ref={padsInstRef}
        args={[UNIT_SHADED_BOX_GEOMETRY, instMat, 5 + tileCount]}
        dispose={null}
      />

      <mesh
        ref={railRef}
        geometry={UNIT_SHADED_BOX_GEOMETRY}
        material={railMat}
        dispose={null}
        rotation={[0, Math.PI / 4, 0]}
      />

      <mesh
        ref={packetRef}
        geometry={UNIT_SHADED_BOX_GEOMETRY}
        material={packetMat}
        dispose={null}
        rotation={[0, Math.PI / 4, 0]}
        scale={[14, 10, 14]}
      />

      <lineSegments
        ref={repoWireRef as unknown as React.RefObject<never>}
        geometry={unitEdges}
        material={wireMat}
        dispose={null}
        scale={[24, 24, 24]}
      />

      <instancedMesh
        ref={astInstRef}
        args={[UNIT_SHADED_BOX_GEOMETRY, instMat, astCount]}
        dispose={null}
      />

      <mesh
        ref={scanPlaneRef}
        geometry={UNIT_BOX_GEOMETRY}
        material={scanPlaneMat}
        dispose={null}
        rotation={[0, Math.PI / 4, 0]}
        scale={[3, 44, 52]}
      />

      <instancedMesh
        ref={scoreInstRef}
        args={[UNIT_SHADED_BOX_GEOMETRY, instMat, scoreItemCount]}
        dispose={null}
      />

      <LedgerChainGroup
        colors={colors}
        litRatio={mode === "static" || STAGE_AT[3] <= smoothP.current ? 1 : s4Lit}
        position={[s4x, -16, s4z]}
      />

      {findingAstGroups.crit.length > 0 && (
        <instancedMesh
          ref={glyphCriticalInstRef}
          args={[
            SEVERITY_GLYPH_GEOMETRIES[SEVERITY_META.CRITICAL.shape],
            glyphMat,
            findingAstGroups.crit.length,
          ]}
          dispose={null}
        />
      )}
      {findingAstGroups.high.length > 0 && (
        <instancedMesh
          ref={glyphHighInstRef}
          args={[
            SEVERITY_GLYPH_GEOMETRIES[SEVERITY_META.HIGH.shape],
            glyphMat,
            findingAstGroups.high.length,
          ]}
          dispose={null}
        />
      )}
      {findingAstGroups.other.length > 0 && (
        <instancedMesh
          ref={glyphOtherInstRef}
          args={[
            SEVERITY_GLYPH_GEOMETRIES[SEVERITY_META.LOW.shape],
            glyphMat,
            findingAstGroups.other.length,
          ]}
          dispose={null}
        />
      )}
    </group>
  );
}

function clampStep(progress: number, offset: number): number {
  const v = (progress - offset) / Math.max(0.2, 1 - offset);
  return Math.max(0, Math.min(1, v));
}

export interface GateSequence3DProps extends GateSequenceCanvasSceneProps {
  fallback: ReactNode;
  overlay?: ReactNode;
}

export function GateSequence3D({
  fallback,
  overlay,
  ...sceneProps
}: GateSequence3DProps) {
  return (
    <Scene3D
      id="gate-sequence"
      height={280}
      label="Isometric gate pipeline showing connect, AST scan, deterministic risk score, and immutable audit record"
      fallback={fallback}
      overlay={overlay}
    >
      <GateSequenceCanvasScene {...sceneProps} />
    </Scene3D>
  );
}
