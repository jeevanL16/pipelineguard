import React, { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import { InstancedMesh, Matrix4, MathUtils, MeshBasicMaterial } from "three";
import { Badge } from "../../ui";
import { L, Scene3D, UNIT_SHADED_BOX_GEOMETRY, useGatehouseTheme, useInvalidateWhile } from "../core";
import type { GatehouseColorPalette } from "../core/useGatehouseTheme";
import type { Scene3DMode } from "../core/useScene3DMode";

export interface LedgerChainGroupProps {
  colors: GatehouseColorPalette;
  litRatio: number;
  position?: readonly [number, number, number];
  verifiedTone?: boolean;
}

const CHAIN_LINKS = 4;

/**
 * Reusable 4-block chained audit ledger cluster rendered via a single InstancedMesh draw call.
 * First 3 blocks represent previously locked audit entries; the 4th drops into place as litRatio -> 1.
 */
export function LedgerChainGroup({
  colors,
  litRatio,
  position = [0, 0, 0],
  verifiedTone = false,
}: LedgerChainGroupProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummyMatrix = useMemo(() => new Matrix4(), []);

  const material = useMemo(
    () => new MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    []
  );

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useEffect(() => {
    const inst = meshRef.current;
    if (!inst) return;

    const offsets: readonly [number, number][] = [
      [-34, 8],
      [-12, 8],
      [10, 8],
      [32, 8],
    ];

    for (let i = 0; i < CHAIN_LINKS; i++) {
      const [ox, oz] = offsets[i];
      const isLatest = i === CHAIN_LINKS - 1;
      const dropProgress = isLatest ? Math.max(0, Math.min(1, litRatio)) : 1;
      const yOffset = isLatest ? 4 + (1 - dropProgress) * 28 : 4;
      const scaleFactor = isLatest ? Math.max(0.05, dropProgress) : 1;

      dummyMatrix.makeScale(16 * scaleFactor, 12 * scaleFactor, 16 * scaleFactor);
      dummyMatrix.setPosition(ox, yOffset, oz);
      inst.setMatrixAt(i, dummyMatrix);

      if (isLatest && dropProgress > 0.6) {
        inst.setColorAt(i, verifiedTone ? colors.pass : colors.critical);
      } else {
        inst.setColorAt(i, litRatio > 0.35 ? colors.panel : colors.raised);
      }
    }

    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, [colors, litRatio, verifiedTone, dummyMatrix]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[UNIT_SHADED_BOX_GEOMETRY, material, CHAIN_LINKS]}
      dispose={null}
      position={[position[0], position[1], position[2]]}
    />
  );
}

function ArtifactLedgerCanvas({
  digest,
  matched,
  mode,
}: {
  digest: string;
  matched: boolean;
  mode: Scene3DMode;
}) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const { colors, version } = useGatehouseTheme(invalidate);
  const progressRef = useRef(mode === "static" ? 1 : 0);
  const [litRatio, setLitRatio] = React.useState(mode === "static" ? 1 : 0);

  useEffect(() => {
    progressRef.current = mode === "static" ? 1 : 0;
    setLitRatio(mode === "static" ? 1 : 0);
    invalidate();
  }, [digest, matched, mode, colors, version, invalidate]);

  useInvalidateWhile(
    mode,
    (dt, isStatic) => {
      if (isStatic) {
        if (progressRef.current !== 1) {
          progressRef.current = 1;
          setLitRatio(1);
        }
        return false;
      }

      const next = MathUtils.damp(progressRef.current, 1, L.enter, dt);
      progressRef.current = Math.abs(1 - next) < 0.01 ? 1 : next;
      setLitRatio(progressRef.current);

      if (typeof window !== "undefined") {
        (window as unknown as { __PG_3D_STATS?: Record<string, { calls: number; triangles: number }> }).__PG_3D_STATS = {
          ...(window as unknown as { __PG_3D_STATS?: Record<string, { calls: number; triangles: number }> }).__PG_3D_STATS,
          ledgerArtifact: {
            calls: gl.info.render.calls,
            triangles: gl.info.render.triangles,
          },
        };
      }

      return progressRef.current < 1;
    },
    [digest, matched]
  );

  return (
    <LedgerChainGroup
      colors={colors}
      litRatio={litRatio}
      position={[0, -6, 0]}
      verifiedTone={matched}
    />
  );
}

export interface LedgerArtifactScene3DProps {
  digest: string;
  matched: boolean;
  mode: Scene3DMode;
  fallback: ReactNode;
}

/** Route-scoped lazy 3D ledger chain for ArtifactsPage driven by the user's real Web Crypto digest. */
export function LedgerArtifactScene3D({
  digest,
  matched,
  mode,
  fallback,
}: LedgerArtifactScene3DProps) {
  return (
    <Scene3D
      id="ledger-artifact"
      height={140}
      label={`Artifact digest chain block for ${digest.slice(0, 12)}`}
      fallback={fallback}
      overlay={
        <div className="pointer-events-none absolute inset-x-3 bottom-2.5 flex items-center justify-between">
          <span className="pg-code-sm text-[var(--pg-text-muted)]">
            sha256:{digest.slice(0, 12)}
          </span>
          <Badge
            severity={matched ? "PASS" : "CRITICAL"}
            label={matched ? "Chain locked · Pass" : "Mismatch · Blocked"}
          />
        </div>
      }
    >
      <ArtifactLedgerCanvas digest={digest} matched={matched} mode={mode} />
    </Scene3D>
  );
}
