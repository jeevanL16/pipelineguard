import React, { useEffect, useMemo, useRef } from "react";
import { InstancedMesh, Matrix4, MeshBasicMaterial } from "three";
import type { GatehouseColorPalette } from "../core/useGatehouseTheme";
import { UNIT_SHADED_BOX_GEOMETRY } from "../core/shading";

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
        inst.setColorAt(i, verifiedTone ? colors.pass : colors.primary);
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
