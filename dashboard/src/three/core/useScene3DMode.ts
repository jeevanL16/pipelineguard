import { useSyncExternalStore } from "react";

export type Scene3DMode = "webgl" | "static" | "fallback";

const MQ = [
  "(min-width: 768px)",
  "(forced-colors: active)",
  "(prefers-contrast: more)",
  "(prefers-reduced-motion: reduce)",
] as const;

const allowForce = Boolean(import.meta.env.DEV || import.meta.env.VITE_E2E === "1");

let gl2Standard: boolean | undefined;
let gl2Forced: boolean | undefined;

export function resetWebGLProbeForTests(): void {
  gl2Standard = undefined;
  gl2Forced = undefined;
}

function hasUsableWebGL2(force: boolean): boolean {
  if (typeof document === "undefined") return false;
  if (!force && gl2Standard !== undefined) return gl2Standard;
  if (force && gl2Forced !== undefined) return gl2Forced;

  let usable = false;
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("webgl2", {
      failIfMajorPerformanceCaveat: !force,
    }) as WebGL2RenderingContext | null;
    usable = Boolean(ctx);
    ctx?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    usable = false;
  }

  if (force) gl2Forced = usable;
  else gl2Standard = usable;
  return usable;
}

export function computeScene3DMode(): Scene3DMode {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "fallback";
  }

  const q = (query: string) => window.matchMedia(query).matches;
  const override = new URLSearchParams(window.location.search).get("scene3d");
  const saveData =
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
      ?.saveData === true;

  if (
    override === "off" ||
    !q(MQ[0]) ||
    q(MQ[1]) ||
    q(MQ[2]) ||
    saveData
  ) {
    return "fallback";
  }

  const force = override === "force" && allowForce;
  if (!hasUsableWebGL2(force)) {
    return "fallback";
  }

  return override === "static" || q(MQ[3]) ? "static" : "webgl";
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const lists = MQ.map((s) => window.matchMedia(s));
  lists.forEach((l) => l.addEventListener("change", cb));
  window.addEventListener("popstate", cb);
  window.addEventListener("hashchange", cb);
  return () => {
    lists.forEach((l) => l.removeEventListener("change", cb));
    window.removeEventListener("popstate", cb);
    window.removeEventListener("hashchange", cb);
  };
}

export function useScene3DMode(): Scene3DMode {
  return useSyncExternalStore(subscribe, computeScene3DMode, () => "fallback");
}
