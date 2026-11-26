import React, { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import { Color, InstancedMesh, Matrix4, MathUtils, MeshBasicMaterial } from "three";
import type { IncidentPathSpec } from "../../features/landing/components/incidentPaths";
import { Badge } from "../../ui";
import {
  L,
  Scene3D,
  UNIT_SHADED_BOX_GEOMETRY,
  useGatehouseTheme,
  useInvalidateWhile,
  useProjectedAnchors,
  type WorldAnchorSpec,
} from "../core";
import type { Scene3DMode } from "../core/useScene3DMode";

const INV_SQRT2 = Math.SQRT1_2;
const NODE_SX: readonly [number, number, number, number] = [-300, -100, 100, 300];

function worldAtSx(sx: number): readonly [number, number] {
  return [sx * INV_SQRT2, -sx * INV_SQRT2];
}

function AttackPathCanvas({
  pathSpec,
  guardEnabled,
  mode,
  anchorRefs,
}: {
  pathSpec: IncidentPathSpec;
  guardEnabled: boolean;
  mode: Scene3DMode;
  anchorRefs: React.RefObject<Record<string, HTMLElement | null>>;
}) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const { colors, version } = useGatehouseTheme(invalidate);

  const instRef = useRef<InstancedMesh>(null);
  const packetProgressRef = useRef(0);
  const gateDropRef = useRef(guardEnabled ? 1 : 0);

  const dummyMatrix = useMemo(() => new Matrix4(), []);
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
    packetProgressRef.current = mode === "static" ? 1 : 0;
    invalidate();
  }, [pathSpec.id, guardEnabled, colors, version, mode, invalidate]);

  const anchors = useMemo<WorldAnchorSpec[]>(
    () =>
      pathSpec.nodes.map((node, idx) => {
        const [wx, wz] = worldAtSx(NODE_SX[idx]);
        return { id: `node-${idx}`, position: [wx, -16, wz] };
      }),
    [pathSpec.nodes]
  );
  useProjectedAnchors(anchors, anchorRefs, true);

  // 4 slabs + 1 connecting rail + 3 gate arch parts (left post, right post, lintel crown) + 1 compromise packet = 9 instances in 1 draw call
  const totalInstances = 9;

  useInvalidateWhile(
    mode,
    (dt, isStatic) => {
      let moving = false;

      if (isStatic) {
        packetProgressRef.current = 1;
        gateDropRef.current = guardEnabled ? 1 : 0;
      } else {
        const targetGate = guardEnabled ? 1 : 0;
        const nextGate = MathUtils.damp(gateDropRef.current, targetGate, L.state, dt);
        if (Math.abs(targetGate - nextGate) > 0.005) moving = true;
        gateDropRef.current = nextGate;

        if (packetProgressRef.current < 1) {
          packetProgressRef.current = Math.min(1, packetProgressRef.current + dt * 0.85);
          moving = true;
        }
      }

      const inst = instRef.current;
      if (inst) {
        const p = packetProgressRef.current;
        const gateLocked = guardEnabled;
        const haltFrac = 0.30; // right before gate point (node 1 at sx=-100 -> 1/3 along rail)
        const travelFrac = gateLocked ? p * haltFrac : p;

        // Indices 0..3: 4 Path Slabs
        for (let i = 0; i < 4; i++) {
          const [wx, wz] = worldAtSx(NODE_SX[i]);
          const node = pathSpec.nodes[i];
          const reachedTerminal = !gateLocked && i === 3 && p > 0.92;
          const haltedAtGate = gateLocked && node.isGatePoint && p > 0.65;

          dummyMatrix.makeScale(106, 8, 52);
          dummyMatrix.setPosition(wx, -6, wz);
          inst.setMatrixAt(i, dummyMatrix);

          if (haltedAtGate) {
            tmpColor.copy(colors.primary);
          } else if (reachedTerminal) {
            tmpColor.copy(colors.critical);
          } else if (gateLocked && i > 1) {
            tmpColor.copy(colors.panel).lerp(colors.canvas, 0.3);
          } else {
            tmpColor.copy(colors.panel);
          }
          inst.setColorAt(i, tmpColor);
        }

        // Index 4: Rail connecting node 0 -> node 3
        const span = NODE_SX[3] - NODE_SX[0];
        const [rx, rz] = worldAtSx((NODE_SX[0] + NODE_SX[3]) * 0.5);
        dummyMatrix.makeRotationY(Math.PI / 4);
        const railScale = new Matrix4().makeScale(span, 3, 6);
        dummyMatrix.multiply(railScale);
        dummyMatrix.setPosition(rx, -10, rz);
        inst.setMatrixAt(4, dummyMatrix);
        inst.setColorAt(4, colors.lineStrong);

        // Indices 5..7: Gate Arch positioned cleanly over node 1 (the controlPoint)
        const [gx, gz] = worldAtSx(NODE_SX[1] - 18);
        const gateLift = (1 - gateDropRef.current) * 18;
        const gateColor = gateLocked ? colors.primary : colors.lineStrong;

        dummyMatrix.makeScale(8, 34, 8);
        dummyMatrix.setPosition(gx, 10 + gateLift, gz - 24);
        inst.setMatrixAt(5, dummyMatrix);
        inst.setColorAt(5, gateColor);

        dummyMatrix.makeScale(8, 34, 8);
        dummyMatrix.setPosition(gx, 10 + gateLift, gz + 24);
        inst.setMatrixAt(6, dummyMatrix);
        inst.setColorAt(6, gateColor);

        dummyMatrix.makeScale(10, 8, 56);
        dummyMatrix.setPosition(gx, 28 + gateLift, gz);
        inst.setMatrixAt(7, dummyMatrix);
        inst.setColorAt(7, gateColor);

        // Index 8: Compromise packet moving along rail
        const pktSx = NODE_SX[0] + span * travelFrac;
        const [px, pz] = worldAtSx(pktSx);
        dummyMatrix.makeScale(14, 12, 14);
        dummyMatrix.setPosition(px, 6, pz);
        inst.setMatrixAt(8, dummyMatrix);
        inst.setColorAt(8, colors.critical);

        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      }

      if (typeof window !== "undefined") {
        (window as unknown as { __PG_3D_STATS?: Record<string, { calls: number; triangles: number }> }).__PG_3D_STATS = {
          ...(window as unknown as { __PG_3D_STATS?: Record<string, { calls: number; triangles: number }> }).__PG_3D_STATS,
          attackPath: {
            calls: gl.info.render.calls,
            triangles: gl.info.render.triangles,
          },
        };
      }

      return moving;
    },
    [pathSpec, guardEnabled]
  );

  return (
    <instancedMesh
      ref={instRef}
      args={[UNIT_SHADED_BOX_GEOMETRY, instMat, totalInstances]}
      dispose={null}
    />
  );
}

export interface AttackPath3DProps {
  pathSpec: IncidentPathSpec;
  guardEnabled: boolean;
  mode: Scene3DMode;
  fallback: ReactNode;
}

export function AttackPath3D({
  pathSpec,
  guardEnabled,
  mode,
  fallback,
}: AttackPath3DProps) {
  const anchorRefs = useRef<Record<string, HTMLElement | null>>({});

  return (
    <Scene3D
      id="attack-path"
      height={190}
      label={`${pathSpec.tabLabel} compromise path simulation ${guardEnabled ? "with PipelineGuard enabled" : "without guard"}`}
      fallback={fallback}
      overlay={
        <>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {pathSpec.nodes.map((node, idx) => (
              <div
                key={node.id}
                ref={(el) => {
                  anchorRefs.current[`node-${idx}`] = el;
                }}
                className="absolute top-0 left-0 px-2 py-0.5 rounded-[4px] bg-[var(--pg-panel)] border border-[var(--pg-line)] pg-label-sm text-[var(--pg-text)] whitespace-nowrap"
              >
                {node.label}
              </div>
            ))}
          </div>

          <div className="pointer-events-none absolute top-2.5 right-3 flex items-center gap-2">
            {guardEnabled ? (
              <Badge severity="PASS" label={pathSpec.gateActionLabel} />
            ) : (
              <Badge severity={pathSpec.severity} label="Unblocked compromise path" />
            )}
          </div>
        </>
      }
    >
      <AttackPathCanvas
        pathSpec={pathSpec}
        guardEnabled={guardEnabled}
        mode={mode}
        anchorRefs={anchorRefs}
      />
    </Scene3D>
  );
}
