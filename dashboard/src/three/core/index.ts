export {
  acquireCanvas,
  clearPlayed,
  getLiveCanvasCount,
  hasPlayed,
  markPlayed,
  MAX_LIVE_CANVASES,
  releaseCanvas,
  resetCanvasBudgetForTests,
} from "./liveCanvasBudget";
export {
  clamp01,
  DIFF_SWAP_MS,
  L,
  lambdaFor,
  SCAN_LINE_MS,
  STAGE_AT,
  stageLit,
} from "./motion3d";
export {
  computeScene3DMode,
  resetWebGLProbeForTests,
  type Scene3DMode,
  useScene3DMode,
} from "./useScene3DMode";
export {
  computeSectionProgress,
  type SectionProgressStore,
  useSectionProgress,
} from "./useSectionProgress";
export {
  type GatehouseColorPalette,
  type GatehouseResolvedTheme,
  type GatehouseThemeState,
  resolveDomTheme,
  useGatehouseTheme,
} from "./useGatehouseTheme";
export {
  createSlabMaterialTuple,
  deriveFaceShades,
  disposeSlabMaterials,
  type FaceShades,
  UNIT_BOX_GEOMETRY,
  updateSlabMaterialTuple,
} from "./shading";
export {
  SEVERITY_GLYPH_GEOMETRIES,
  SeverityGlyphMesh,
  type SeverityGlyphMeshProps,
} from "./glyphs";
export { useInvalidateWhile } from "./useInvalidateWhile";
export { useProjectedAnchors, type WorldAnchorSpec } from "./useProjectedAnchors";
export { Scene3D, type Scene3DProps } from "./Scene3D";
