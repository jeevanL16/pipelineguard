import { BoxGeometry, Color, Float32BufferAttribute, MeshBasicMaterial } from "three";

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

function createShadedBoxGeometry(): BoxGeometry {
  const geom = new BoxGeometry(1, 1, 1);
  const normals = geom.getAttribute("normal");
  const colors = new Float32Array(normals.count * 3);

  for (let i = 0; i < normals.count; i++) {
    const nx = normals.getX(i);
    const ny = normals.getY(i);
    const nz = normals.getZ(i);
    // Isometric face luminance factors matching 0% / 12% / 22% shading depth cues in 1 draw call
    let factor = 1.0;
    if (ny > 0.5) factor = 1.0;
    else if (ny < -0.5) factor = 0.7;
    else if (nz > 0.5 || nx < -0.5) factor = 0.88;
    else factor = 0.78;

    colors[i * 3] = factor;
    colors[i * 3 + 1] = factor;
    colors[i * 3 + 2] = factor;
  }

  geom.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geom;
}

/**
 * Single-draw-call 3-face isometric shaded unit box geometry.
 * Pair with MeshBasicMaterial({ vertexColors: true, toneMapped: false }) and dispose={null}.
 */
export const UNIT_SHADED_BOX_GEOMETRY = createShadedBoxGeometry();

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
