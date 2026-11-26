import { BoxGeometry, Color, MeshBasicMaterial } from "three";

export interface FaceShades {
  top: Color;
  left: Color;
  right: Color;
  underside: Color;
}

/**
 * Shared unit box geometry for slabs, rails, and blocks.
 * Always mount with dispose={null} in R3F so unmounting one scene preserves it for others.
 */
export const UNIT_BOX_GEOMETRY = new BoxGeometry(1, 1, 1);

/**
 * Flat Gatehouse isometric three-face tone derivation:
 * top = exact token colour, left = 12% toward ink, right = 22% toward ink.
 */
export function deriveFaceShades(baseColor: Color, inkColor: Color): FaceShades {
  return {
    top: baseColor.clone(),
    left: baseColor.clone().lerp(inkColor, 0.12),
    right: baseColor.clone().lerp(inkColor, 0.22),
    underside: baseColor.clone().lerp(inkColor, 0.3),
  };
}

/**
 * Six-face MeshBasicMaterial tuple aligned with Three.js BoxGeometry order:
 * [+x (right visible face), -x, +y (top visible face), -y (bottom), +z (left visible face), -z]
 * when viewed from orthographic [1000, 1000, 1000] looking at [0, 0, 0].
 */
export function createSlabMaterialTuple(
  baseColor: Color,
  inkColor: Color,
  opacity = 1
): MeshBasicMaterial[] {
  const shades = deriveFaceShades(baseColor, inkColor);
  const transparent = opacity < 1;
  const make = (c: Color) =>
    new MeshBasicMaterial({
      color: c,
      toneMapped: false,
      transparent,
      opacity,
    });

  return [
    make(shades.right),
    make(shades.left),
    make(shades.top),
    make(shades.underside),
    make(shades.left),
    make(shades.right),
  ];
}

export function updateSlabMaterialTuple(
  materials: MeshBasicMaterial[],
  baseColor: Color,
  inkColor: Color,
  opacity = 1
): void {
  if (materials.length < 6) return;
  const shades = deriveFaceShades(baseColor, inkColor);
  const transparent = opacity < 1;
  const faceColors = [
    shades.right,
    shades.left,
    shades.top,
    shades.underside,
    shades.left,
    shades.right,
  ];
  for (let i = 0; i < 6; i++) {
    const mat = materials[i];
    mat.color.copy(faceColors[i]);
    mat.transparent = transparent;
    mat.opacity = opacity;
    mat.needsUpdate = false;
  }
}

export function disposeSlabMaterials(materials: MeshBasicMaterial[]): void {
  for (const mat of materials) {
    mat.dispose();
  }
}
