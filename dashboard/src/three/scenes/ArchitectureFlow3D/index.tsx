import React, { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import {
  Color,
  InstancedMesh,
  MathUtils,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";
import {
  L,
  Scene3D,
  UNIT_SHADED_BOX_GEOMETRY,
  hasPlayed,
  markPlayed,
  useGatehouseTheme,
  useInvalidateWhile,
  useProjectedAnchors,
  type WorldAnchorSpec,
} from "../../core";
import type { Scene3DMode } from "../../core/useScene3DMode";
import {
  ARCH_EDGES,
  ARCH_NODES,
  LAYER_NAMES,
  getArchNode,
  getConnectedNodeAndEdgeSet,
  getTraceSets,
  type GraphNode,
} from "./graph";

const INV_SQRT2 = Math.SQRT1_2;

function nodeWorldCoords(node: GraphNode): readonly [number, number, number] {
  const sx = (node.layer - 3) * 145;
  const sz = (node.row - 1.5) * 44;
  return [sx * INV_SQRT2, 0, -sx * INV_SQRT2 + sz];
}

function layerPlateCoords(layer: number): readonly [number, number, number] {
  const sx = (layer - 3) * 145;
  return [sx * INV_SQRT2, -12, -sx * INV_SQRT2];
}

function ArchitectureCanvas({
  mode,
  activeNodeId,
  tracingFinding,
  replayNonce,
  inView,
  anchorRefs,
}: {
  mode: Scene3DMode;
  activeNodeId: string | null;
  tracingFinding: boolean;
  replayNonce: number;
  inView: boolean;
  anchorRefs: React.RefObject<Record<string, HTMLElement | null>>;
}) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const { colors, version } = useGatehouseTheme(invalidate);

  const platesRef = useRef<InstancedMesh>(null);
  const nodesRef = useRef<InstancedMesh>(null);
  const edgesRef = useRef<InstancedMesh>(null);
  const packetsRef = useRef<InstancedMesh>(null);

  const playProgressRef = useRef(
    mode === "static" || hasPlayed("architecture-flow") ? 1 : 0
  );
  const traceProgressRef = useRef(0);
  const traceAnimActiveRef = useRef(false);
  const nodeLiftRef = useRef<number[]>(Array(ARCH_NODES.length).fill(0));

  const dummyMatrix = useMemo(() => new Matrix4(), []);
  const tmpPosA = useMemo(() => new Vector3(), []);
  const tmpPosB = useMemo(() => new Vector3(), []);
  const tmpMid = useMemo(() => new Vector3(), []);
  const tmpDir = useMemo(() => new Vector3(), []);
  const tmpAxisX = useMemo(() => new Vector3(1, 0, 0), []);
  const tmpQuat = useMemo(() => new Quaternion(), []);
  const tmpScale = useMemo(() => new Vector3(), []);
  const tmpColor = useMemo(() => new Color(), []);

  const instMat = useMemo(
    () => new MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    []
  );

  useEffect(() => {
    return () => {
      instMat.dispose();
    };
  }, [instMat]);

  useEffect(() => {
    invalidate();
  }, [colors, version, activeNodeId, tracingFinding, invalidate]);

  useEffect(() => {
    if (replayNonce > 0 && mode !== "static") {
      playProgressRef.current = 0;
      invalidate();
    }
  }, [replayNonce, mode, invalidate]);

  useEffect(() => {
    if (tracingFinding) {
      traceProgressRef.current = mode === "static" ? 1 : 0;
      traceAnimActiveRef.current = mode !== "static";
      invalidate();
    } else {
      traceAnimActiveRef.current = false;
      traceProgressRef.current = 0;
      invalidate();
    }
  }, [tracingFinding, mode, invalidate]);

  const anchors = useMemo<WorldAnchorSpec[]>(
    () =>
      ARCH_NODES.map((n) => {
        const [x, y, z] = nodeWorldCoords(n);
        return { id: n.id, position: [x, y + 10, z] };
      }),
    []
  );
  useProjectedAnchors(anchors, anchorRefs, true);

  const connected = useMemo(
    () => getConnectedNodeAndEdgeSet(activeNodeId),
    [activeNodeId]
  );
  const traceSets = useMemo(() => getTraceSets(), []);

  useInvalidateWhile(
    mode,
    (dt, isStatic) => {
      let moving = false;

      if (isStatic) {
        playProgressRef.current = 1;
        traceProgressRef.current = tracingFinding ? 1 : 0;
      } else {
        if (inView && playProgressRef.current < 1) {
          playProgressRef.current = Math.min(1, playProgressRef.current + dt * 0.7);
          moving = true;
          if (playProgressRef.current >= 1) {
            markPlayed("architecture-flow");
          }
        }
        if (tracingFinding && traceAnimActiveRef.current) {
          traceProgressRef.current = Math.min(1, traceProgressRef.current + dt * 0.78);
          moving = true;
          if (traceProgressRef.current >= 1) {
            traceAnimActiveRef.current = false;
          }
        }
      }

      // 1. 7 Layer Base Plates
      const pInst = platesRef.current;
      if (pInst) {
        for (let l = 0; l < LAYER_NAMES.length; l++) {
          const [px, py, pz] = layerPlateCoords(l);
          dummyMatrix.makeScale(86, 4, 176);
          dummyMatrix.setPosition(px, py, pz);
          pInst.setMatrixAt(l, dummyMatrix);
          pInst.setColorAt(l, colors.panel);
        }
        pInst.instanceMatrix.needsUpdate = true;
        if (pInst.instanceColor) pInst.instanceColor.needsUpdate = true;
      }

      // 2. 15 Architecture Nodes
      const nInst = nodesRef.current;
      if (nInst) {
        for (let i = 0; i < ARCH_NODES.length; i++) {
          const node = ARCH_NODES[i];
          const [nx, ny, nz] = nodeWorldCoords(node);
          const isFocused = activeNodeId === node.id;
          const isNeighbor = connected.nodeIds.has(node.id);
          const isTraceNode = tracingFinding && traceSets.nodeIds.has(node.id);
          const dimmed =
            (activeNodeId !== null && !isNeighbor) ||
            (tracingFinding && !isTraceNode);

          const targetLift = isFocused ? 8 : isTraceNode ? 4 : 0;
          const prevLift = nodeLiftRef.current[i] ?? 0;
          let lift = targetLift;
          if (!isStatic) {
            lift = MathUtils.damp(prevLift, targetLift, L.state, dt);
            if (Math.abs(targetLift - lift) > 0.08) moving = true;
            else lift = targetLift;
          }
          nodeLiftRef.current[i] = lift;

          dummyMatrix.makeScale(62, 10, 28);
          dummyMatrix.setPosition(nx, ny + lift, nz);
          nInst.setMatrixAt(i, dummyMatrix);

          if (isFocused || isNeighbor) {
            tmpColor.copy(colors.primary);
          } else if (isTraceNode) {
            tmpColor.copy(colors.critical);
          } else if (dimmed) {
            tmpColor.copy(colors.panel).lerp(colors.canvas, 0.35);
          } else {
            tmpColor.copy(colors.raised);
          }
          nInst.setColorAt(i, tmpColor);
        }
        nInst.instanceMatrix.needsUpdate = true;
        if (nInst.instanceColor) nInst.instanceColor.needsUpdate = true;
      }

      // 3. Graph Edges as thin oriented rails
      const eInst = edgesRef.current;
      if (eInst) {
        for (let i = 0; i < ARCH_EDGES.length; i++) {
          const edge = ARCH_EDGES[i];
          const a = getArchNode(edge.from);
          const b = getArchNode(edge.to);
          if (!a || !b) continue;
          const [ax, ay, az] = nodeWorldCoords(a);
          const [bx, by, bz] = nodeWorldCoords(b);
          tmpPosA.set(ax, ay - 2, az);
          tmpPosB.set(bx, by - 2, bz);
          const len = tmpPosA.distanceTo(tmpPosB);
          tmpMid.addVectors(tmpPosA, tmpPosB).multiplyScalar(0.5);
          tmpDir.subVectors(tmpPosB, tmpPosA).normalize();
          tmpQuat.setFromUnitVectors(tmpAxisX, tmpDir);
          dummyMatrix.compose(tmpMid, tmpQuat, tmpScale.set(len, 2, 2.5));
          eInst.setMatrixAt(i, dummyMatrix);

          const isEdgeConnected = connected.edgeIndices.has(i);
          const isTraceEdge = tracingFinding && Boolean(edge.trace);
          if (isEdgeConnected) {
            tmpColor.copy(colors.primary);
          } else if (isTraceEdge) {
            tmpColor.copy(colors.critical);
          } else if (activeNodeId !== null || tracingFinding) {
            tmpColor.copy(colors.line).lerp(colors.canvas, 0.45);
          } else {
            tmpColor.copy(colors.lineStrong);
          }
          eInst.setColorAt(i, tmpColor);
        }
        eInst.instanceMatrix.needsUpdate = true;
        if (eInst.instanceColor) eInst.instanceColor.needsUpdate = true;
      }

      // 4. Packet Cubes (play-once flow across all edges OR finding trace along trace edges)
      const pkInst = packetsRef.current;
      if (pkInst) {
        const useTrace = tracingFinding;
        const p = useTrace ? traceProgressRef.current : playProgressRef.current;
        for (let i = 0; i < ARCH_EDGES.length; i++) {
          const edge = ARCH_EDGES[i];
          const a = getArchNode(edge.from);
          const b = getArchNode(edge.to);
          const active = useTrace
            ? Boolean(edge.trace) && p > 0.01 && p < 0.995
            : p > 0.01 && p < 0.995;

          if (!a || !b || !active) {
            dummyMatrix.makeScale(0.001, 0.001, 0.001);
            dummyMatrix.setPosition(0, -100, 0);
            pkInst.setMatrixAt(i, dummyMatrix);
            pkInst.setColorAt(i, colors.primary);
            continue;
          }

          const layerSpan = (p * 6 - a.layer) / Math.max(1, b.layer - a.layer);
          const edgeT = Math.max(0, Math.min(1, layerSpan));
          const [ax, ay, az] = nodeWorldCoords(a);
          const [bx, by, bz] = nodeWorldCoords(b);
          tmpPosA.set(ax, ay + 4, az);
          tmpPosB.set(bx, by + 4, bz);
          tmpMid.lerpVectors(tmpPosA, tmpPosB, edgeT);
          const sz = edgeT > 0 && edgeT < 1 ? 8 : 0.001;
          dummyMatrix.makeScale(sz, sz, sz);
          dummyMatrix.setPosition(tmpMid.x, tmpMid.y, tmpMid.z);
          pkInst.setMatrixAt(i, dummyMatrix);
          pkInst.setColorAt(i, useTrace ? colors.critical : colors.primary);
        }
        pkInst.instanceMatrix.needsUpdate = true;
        if (pkInst.instanceColor) pkInst.instanceColor.needsUpdate = true;
      }

      if (typeof window !== "undefined") {
        (window as unknown as { __PG_3D_STATS?: Record<string, { calls: number; triangles: number }> }).__PG_3D_STATS = {
          ...(window as unknown as { __PG_3D_STATS?: Record<string, { calls: number; triangles: number }> }).__PG_3D_STATS,
          architectureFlow: {
            calls: gl.info.render.calls,
            triangles: gl.info.render.triangles,
          },
        };
      }

      return moving;
    },
    [activeNodeId, tracingFinding, inView, connected, traceSets]
  );

  return (
    <group>
      <instancedMesh
        ref={platesRef}
        args={[UNIT_SHADED_BOX_GEOMETRY, instMat, LAYER_NAMES.length]}
        dispose={null}
      />
      <instancedMesh
        ref={edgesRef}
        args={[UNIT_SHADED_BOX_GEOMETRY, instMat, ARCH_EDGES.length]}
        dispose={null}
      />
      <instancedMesh
        ref={nodesRef}
        args={[UNIT_SHADED_BOX_GEOMETRY, instMat, ARCH_NODES.length]}
        dispose={null}
      />
      <instancedMesh
        ref={packetsRef}
        args={[UNIT_SHADED_BOX_GEOMETRY, instMat, ARCH_EDGES.length]}
        dispose={null}
      />
    </group>
  );
}

export interface ArchitectureFlow3DProps {
  mode: Scene3DMode;
  fallback: ReactNode;
  activeNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  tracingFinding: boolean;
  replayNonce: number;
  inView: boolean;
}

export function ArchitectureFlow3D({
  mode,
  fallback,
  activeNodeId,
  onSelectNode,
  tracingFinding,
  replayNonce,
  inView,
}: ArchitectureFlow3DProps) {
  const anchorRefs = useRef<Record<string, HTMLElement | null>>({});

  return (
    <Scene3D
      id="architecture-flow"
      height={380}
      label="Layered PipelineGuard detection and triage data flow across sources, ingest, rules, scoring, events, store, and surfaces"
      fallback={fallback}
      overlay={
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {ARCH_NODES.map((node) => {
            const isSelected = activeNodeId === node.id;
            const countVal = node.count?.();
            return (
              <button
                key={node.id}
                ref={(el) => {
                  anchorRefs.current[node.id] = el;
                }}
                type="button"
                aria-label={`${node.label}: ${node.role}`}
                aria-pressed={isSelected}
                onMouseEnter={() => onSelectNode(node.id)}
                onMouseLeave={() => onSelectNode(null)}
                onFocus={() => onSelectNode(node.id)}
                onBlur={() => onSelectNode(null)}
                onClick={() => onSelectNode(isSelected ? null : node.id)}
                className={`pointer-events-auto absolute top-0 left-0 px-2 py-0.5 rounded-[4px] border pg-label-sm whitespace-nowrap cursor-pointer transition-colors duration-120 ${
                  isSelected
                    ? "bg-[var(--pg-raised)] text-[var(--pg-primary)] border-[var(--pg-primary)] z-10"
                    : "bg-[var(--pg-panel)] text-[var(--pg-text)] border-[var(--pg-line)] hover:border-[var(--pg-line-strong)]"
                }`}
              >
                {node.label}
                {typeof countVal === "number" ? ` (${countVal})` : ""}
              </button>
            );
          })}
        </div>
      }
    >
      <ArchitectureCanvas
        mode={mode}
        activeNodeId={activeNodeId}
        tracingFinding={tracingFinding}
        replayNonce={replayNonce}
        inView={inView}
        anchorRefs={anchorRefs}
      />
    </Scene3D>
  );
}
