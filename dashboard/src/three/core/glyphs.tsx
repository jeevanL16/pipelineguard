import React, { useEffect, useMemo } from "react";
import { Color, MeshBasicMaterial, Shape, ShapeGeometry } from "three";
import type { SeverityShape } from "../../rules/severity";

function buildDiamondGeometry(): ShapeGeometry {
  const s = new Shape();
  s.moveTo(0, 0.5);
  s.lineTo(0.5, 0);
  s.lineTo(0, -0.5);
  s.lineTo(-0.5, 0);
  s.closePath();
  return new ShapeGeometry(s);
}

function buildTriangleGeometry(): ShapeGeometry {
  const s = new Shape();
  s.moveTo(0, 0.48);
  s.lineTo(-0.48, -0.38);
  s.lineTo(0.48, -0.38);
  s.closePath();
  return new ShapeGeometry(s);
}

function buildSquareGeometry(): ShapeGeometry {
  const s = new Shape();
  s.moveTo(-0.36, -0.36);
  s.lineTo(0.36, -0.36);
  s.lineTo(0.36, 0.36);
  s.lineTo(-0.36, 0.36);
  s.closePath();
  return new ShapeGeometry(s);
}

function buildCircleGeometry(): ShapeGeometry {
  const s = new Shape();
  s.absarc(0, 0, 0.4, 0, Math.PI * 2, false);
  return new ShapeGeometry(s, 24);
}

function buildDashGeometry(): ShapeGeometry {
  const s = new Shape();
  s.moveTo(-0.4, -0.1);
  s.lineTo(0.4, -0.1);
  s.lineTo(0.4, 0.1);
  s.lineTo(-0.4, 0.1);
  s.closePath();
  return new ShapeGeometry(s);
}

function buildCheckGeometry(): ShapeGeometry {
  const s = new Shape();
  s.moveTo(-0.44, 0.04);
  s.lineTo(-0.32, 0.16);
  s.lineTo(-0.1, -0.06);
  s.lineTo(0.32, 0.36);
  s.lineTo(0.44, 0.24);
  s.lineTo(-0.1, -0.32);
  s.closePath();
  return new ShapeGeometry(s);
}

export const SEVERITY_GLYPH_GEOMETRIES: Record<SeverityShape, ShapeGeometry> = {
  diamond: buildDiamondGeometry(),
  triangle: buildTriangleGeometry(),
  square: buildSquareGeometry(),
  circle: buildCircleGeometry(),
  dash: buildDashGeometry(),
  check: buildCheckGeometry(),
};

export interface SeverityGlyphMeshProps {
  shape: SeverityShape;
  color: Color;
  size?: number;
  position?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
}

/**
 * Shared flat unlit glyph mesh matching DESIGN.md severity shapes.
 * Shared ShapeGeometry is mounted with dispose={null} so unmount never corrupts siblings.
 */
export function SeverityGlyphMesh({
  shape,
  color,
  size = 10,
  position = [0, 0, 0],
  rotation = [-Math.PI / 2, 0, 0],
}: SeverityGlyphMeshProps) {
  const geometry = SEVERITY_GLYPH_GEOMETRIES[shape] ?? SEVERITY_GLYPH_GEOMETRIES.square;
  const material = useMemo(
    () => new MeshBasicMaterial({ color: color.clone(), toneMapped: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    material.color.copy(color);
  }, [material, color]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <mesh
      geometry={geometry}
      material={material}
      dispose={null}
      position={[position[0], position[1], position[2]]}
      rotation={[rotation[0], rotation[1], rotation[2]]}
      scale={[size, size, 1]}
    />
  );
}
