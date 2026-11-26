import React, { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useScene3DMode } from "./useScene3DMode";
import { acquireCanvas, releaseCanvas } from "./liveCanvasBudget";

class WebGLErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(): void {
    // WebGL error caught cleanly; 2D fallback remains active.
  }

  render(): ReactNode {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

export interface Scene3DProps {
  id: string;
  fallback: ReactNode;
  children: ReactNode;
  height: number;
  label: string;
  srContent?: ReactNode;
  overlay?: ReactNode;
  className?: string;
}

/**
 * Lazy orthographic isometric WebGL wrapper enforcing:
 * - max 3 simultaneous live canvases
 * - frameloop="demand" (0 idle GPU frames)
 * - fixed height (zero CLS)
 * - accessible group wrapper with aria-hidden canvas + 2D fallback
 */
export function Scene3D({
  id,
  fallback,
  children,
  height,
  label,
  srContent,
  overlay,
  className = "",
}: Scene3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [far, setFar] = useState(true);
  const [granted, setGranted] = useState(false);
  const [dpr, setDpr] = useState<number | [number, number]>([1, 1.75]);
  const mode = useScene3DMode();

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const nearObs = new IntersectionObserver(
      ([entry]) => setNear(Boolean(entry?.isIntersecting)),
      { rootMargin: "200px" }
    );
    const farObs = new IntersectionObserver(
      ([entry]) => setFar(Boolean(entry?.isIntersecting)),
      { rootMargin: "100%" }
    );
    nearObs.observe(el);
    farObs.observe(el);
    return () => {
      nearObs.disconnect();
      farObs.disconnect();
    };
  }, []);

  const wants = mode !== "fallback" && near && far;

  useEffect(() => {
    if (!wants) {
      setGranted(false);
      return;
    }
    const ok = acquireCanvas(id);
    setGranted(ok);
    return () => {
      if (ok) releaseCanvas(id);
    };
  }, [wants, id]);

  return (
    <div
      ref={hostRef}
      role="group"
      aria-label={label}
      className={className}
      style={{ height, position: "relative" }}
    >
      {!granted ? (
        fallback
      ) : (
        <>
          <WebGLErrorBoundary fallback={fallback}>
            <div aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
              <Canvas
                orthographic
                camera={{
                  zoom: 1,
                  position: [1000, 1000, 1000],
                  near: 0.1,
                  far: 4000,
                }}
                onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
                dpr={dpr}
                frameloop="demand"
                gl={{ antialias: true, powerPreference: "low-power" }}
              >
                <PerformanceMonitor onDecline={() => setDpr(1)} />
                {children}
              </Canvas>
            </div>
          </WebGLErrorBoundary>
          {overlay}
          {srContent}
        </>
      )}
    </div>
  );
}
