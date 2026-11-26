import { useEffect, useMemo, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";

export interface WorldAnchorSpec {
  id: string;
  position: readonly [number, number, number];
}

/**
 * Projects declared world-space anchors using the active R3F camera
 * and writes CSS translate coordinates into mapped DOM element refs directly.
 */
export function useProjectedAnchors(
  anchors: readonly WorldAnchorSpec[],
  domRefs: RefObject<Record<string, HTMLElement | null>>,
  active = true
): void {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const scratch = useMemo(() => new Vector3(), []);

  useEffect(() => {
    if (!active) return;
    const map = domRefs.current;
    if (!map || size.width === 0 || size.height === 0) return;

    camera.updateMatrixWorld();

    for (const anchor of anchors) {
      const el = map[anchor.id];
      if (!el) continue;
      scratch.set(anchor.position[0], anchor.position[1], anchor.position[2]);
      scratch.project(camera);
      const px = (scratch.x * 0.5 + 0.5) * size.width;
      const py = (-scratch.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -50%)`;
    }
  }, [anchors, domRefs, camera, size.width, size.height, active, scratch]);
}
