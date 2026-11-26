import React, { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import { Color, InstancedMesh, Matrix4, MathUtils, MeshBasicMaterial, Vector3 } from "three";
import type { Rule, Severity } from "../../rules/schemas";
import { SEVERITY_META } from "../../rules/severity";
import {
  L,
  SEVERITY_GLYPH_GEOMETRIES,
  Scene3D,
  UNIT_SHADED_BOX_GEOMETRY,
  useGatehouseTheme,
  useInvalidateWhile,
  useProjectedAnchors,
  type WorldAnchorSpec,
} from "../core";
import type { Scene3DMode } from "../core/useScene3DMode";

const INV_SQRT2 = Math.SQRT1_2;

function blockWorldX(idx: number, total: number): readonly [number, number] {
  const span = Math.min(980, total * 42);
  const sx = total > 1 ? (idx / (total - 1) - 0.5) * span : 0;
  return [sx * INV_SQRT2, -sx * INV_SQRT2];
}

function fullHeightForSeverity(sev: Severity): number {
  const maxW = SEVERITY_META.CRITICAL.weight;
  const w = SEVERITY_META[sev].weight;
  return 16 + (w / Math.max(1, maxW)) * 78;
}

function RuleCatalogCanvas({
  rules,
  selectedSevs,
  activeRuleId,
  mode,
  anchorRefs,
}: {
  rules: readonly Rule[];
  selectedSevs: readonly Severity[];
  activeRuleId: string | null;
  mode: Scene3DMode;
  anchorRefs: React.RefObject<Record<string, HTMLElement | null>>;
}) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const { colors, version } = useGatehouseTheme(invalidate);

  const instRef = useRef<InstancedMesh>(null);
  const glyphCritRef = useRef<InstancedMesh>(null);
  const glyphHighRef = useRef<InstancedMesh>(null);
  const glyphMedRef = useRef<InstancedMesh>(null);
  const glyphLowRef = useRef<InstancedMesh>(null);

  const heightsRef = useRef<number[]>(
    rules.map((r) => fullHeightForSeverity(r.severity))
  );

  const dummyMatrix = useMemo(() => new Matrix4(), []);
  const tmpScale = useMemo(() => new Vector3(), []);
  const tmpColor = useMemo(() => new Color(), []);

  const instMat = useMemo(
    () => new MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    []
  );
  const glyphMat = useMemo(
    () => new MeshBasicMaterial({ toneMapped: false }),
    []
  );

  useEffect(() => {
    return () => {
      instMat.dispose();
      glyphMat.dispose();
    };
  }, [instMat, glyphMat]);

  useEffect(() => {
    invalidate();
  }, [colors, version, selectedSevs, activeRuleId, invalidate]);

  const anchors = useMemo<WorldAnchorSpec[]>(
    () =>
      rules.map((rule, idx) => {
        const [wx, wz] = blockWorldX(idx, rules.length);
        const h = fullHeightForSeverity(rule.severity);
        return { id: rule.id, position: [wx, -36 + h + 12, wz] };
      }),
    [rules]
  );
  useProjectedAnchors(anchors, anchorRefs, true);

  const sevGroups = useMemo(() => {
    const groups: Record<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW", number[]> = {
      CRITICAL: [],
      HIGH: [],
      MEDIUM: [],
      LOW: [],
    };
    rules.forEach((r, idx) => {
      if (r.severity === "CRITICAL" || r.severity === "HIGH" || r.severity === "MEDIUM" || r.severity === "LOW") {
        groups[r.severity].push(idx);
      }
    });
    return groups;
  }, [rules]);

  useInvalidateWhile(
    mode,
    (dt, isStatic) => {
      let moving = false;
      const inst = instRef.current;

      if (inst) {
        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i];
          const matchesFilter =
            selectedSevs.length === 0 || selectedSevs.includes(rule.severity);
          const fullH = fullHeightForSeverity(rule.severity);
          const targetH = matchesFilter ? fullH : fullH * 0.25;
          const prevH = heightsRef.current[i] ?? targetH;
          let curH = targetH;

          if (!isStatic) {
            curH = MathUtils.damp(prevH, targetH, L.state, dt);
            if (Math.abs(targetH - curH) > 0.15) moving = true;
            else curH = targetH;
          }
          heightsRef.current[i] = curH;

          const [wx, wz] = blockWorldX(i, rules.length);
          const isHovered = activeRuleId === rule.id;
          const lift = isHovered ? 6 : 0;

          dummyMatrix.makeScale(isHovered ? 28 : 24, curH, isHovered ? 28 : 24);
          dummyMatrix.setPosition(wx, -36 + curH * 0.5 + lift, wz);
          inst.setMatrixAt(i, dummyMatrix);

          if (!matchesFilter) {
            tmpColor.copy(colors.panel).lerp(colors.line, 0.35);
          } else if (isHovered) {
            tmpColor.copy(colors.primary);
          } else {
            tmpColor.copy(
              rule.severity === "CRITICAL"
                ? colors.critical
                : rule.severity === "HIGH"
                ? colors.high
                : rule.severity === "MEDIUM"
                ? colors.medium
                : colors.low
            );
          }
          inst.setColorAt(i, tmpColor);
        }
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      }

      const updateGlyphs = (
        ref: React.RefObject<InstancedMesh | null>,
        indices: readonly number[],
        colorVal: Color
      ) => {
        const gInst = ref.current;
        if (!gInst || indices.length === 0) return;
        indices.forEach((ruleIdx, gIdx) => {
          const rule = rules[ruleIdx];
          const matchesFilter =
            selectedSevs.length === 0 || selectedSevs.includes(rule.severity);
          const curH = heightsRef.current[ruleIdx] ?? fullHeightForSeverity(rule.severity);
          const [wx, wz] = blockWorldX(ruleIdx, rules.length);
          const lift = activeRuleId === rule.id ? 6 : 0;
          const scale = matchesFilter ? 8 : 0.001;

          dummyMatrix.makeRotationX(-Math.PI / 2);
          dummyMatrix.scale(tmpScale.set(scale, scale, 1));
          dummyMatrix.setPosition(wx, -36 + curH + lift + 2, wz);
          gInst.setMatrixAt(gIdx, dummyMatrix);
          gInst.setColorAt(gIdx, colorVal);
        });
        gInst.instanceMatrix.needsUpdate = true;
        if (gInst.instanceColor) gInst.instanceColor.needsUpdate = true;
      };

      updateGlyphs(glyphCritRef, sevGroups.CRITICAL, colors.onPrimary);
      updateGlyphs(glyphHighRef, sevGroups.HIGH, colors.onPrimary);
      updateGlyphs(glyphMedRef, sevGroups.MEDIUM, colors.onPrimary);
      updateGlyphs(glyphLowRef, sevGroups.LOW, colors.onPrimary);

      if (typeof window !== "undefined") {
        (window as unknown as { __PG_3D_STATS?: Record<string, { calls: number; triangles: number }> }).__PG_3D_STATS = {
          ...(window as unknown as { __PG_3D_STATS?: Record<string, { calls: number; triangles: number }> }).__PG_3D_STATS,
          ruleCatalog: {
            calls: gl.info.render.calls,
            triangles: gl.info.render.triangles,
          },
        };
      }

      return moving;
    },
    [rules, selectedSevs, activeRuleId, sevGroups]
  );

  return (
    <group>
      <instancedMesh
        ref={instRef}
        args={[UNIT_SHADED_BOX_GEOMETRY, instMat, rules.length]}
        dispose={null}
      />
      {sevGroups.CRITICAL.length > 0 && (
        <instancedMesh
          ref={glyphCritRef}
          args={[SEVERITY_GLYPH_GEOMETRIES.diamond, glyphMat, sevGroups.CRITICAL.length]}
          dispose={null}
        />
      )}
      {sevGroups.HIGH.length > 0 && (
        <instancedMesh
          ref={glyphHighRef}
          args={[SEVERITY_GLYPH_GEOMETRIES.triangle, glyphMat, sevGroups.HIGH.length]}
          dispose={null}
        />
      )}
      {sevGroups.MEDIUM.length > 0 && (
        <instancedMesh
          ref={glyphMedRef}
          args={[SEVERITY_GLYPH_GEOMETRIES.square, glyphMat, sevGroups.MEDIUM.length]}
          dispose={null}
        />
      )}
      {sevGroups.LOW.length > 0 && (
        <instancedMesh
          ref={glyphLowRef}
          args={[SEVERITY_GLYPH_GEOMETRIES.circle, glyphMat, sevGroups.LOW.length]}
          dispose={null}
        />
      )}
    </group>
  );
}

export interface RuleCatalog3DProps {
  rules: readonly Rule[];
  selectedSevs: readonly Severity[];
  activeRuleId: string | null;
  mode: Scene3DMode;
  onHoverRule: (id: string | null) => void;
  onJumpToRule: (id: string) => void;
  fallback: ReactNode;
}

export function RuleCatalog3D({
  rules,
  selectedSevs,
  activeRuleId,
  mode,
  onHoverRule,
  onJumpToRule,
  fallback,
}: RuleCatalog3DProps) {
  const anchorRefs = useRef<Record<string, HTMLElement | null>>({});

  return (
    <Scene3D
      id="rule-catalog"
      height={180}
      label="Severity-weighted rule catalog blocks synchronized with the severity filters and rule table"
      fallback={fallback}
      overlay={
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {rules.map((rule) => {
            const matches =
              selectedSevs.length === 0 || selectedSevs.includes(rule.severity);
            const active = activeRuleId === rule.id;
            return (
              <button
                key={rule.id}
                ref={(el) => {
                  anchorRefs.current[rule.id] = el;
                }}
                type="button"
                aria-label={`${rule.id} (${rule.severity}): ${rule.title}`}
                onMouseEnter={() => onHoverRule(rule.id)}
                onMouseLeave={() => onHoverRule(null)}
                onFocus={() => onHoverRule(rule.id)}
                onBlur={() => onHoverRule(null)}
                onClick={() => onJumpToRule(rule.id)}
                className={`pointer-events-auto absolute top-0 left-0 px-1.5 py-0.5 rounded-[4px] pg-code-sm border text-[11px] leading-none cursor-pointer transition-colors duration-120 ${
                  active
                    ? "bg-[var(--pg-raised)] text-[var(--pg-primary)] border-[var(--pg-primary)] z-10"
                    : matches
                    ? "bg-[var(--pg-panel)] text-[var(--pg-text)] border-[var(--pg-line)] opacity-90"
                    : "bg-[var(--pg-panel)] text-[var(--pg-text-muted)] border-[var(--pg-line)] opacity-45"
                }`}
              >
                {rule.id.replace("PG-WF-", "")}
              </button>
            );
          })}
        </div>
      }
    >
      <RuleCatalogCanvas
        rules={rules}
        selectedSevs={selectedSevs}
        activeRuleId={activeRuleId}
        mode={mode}
        anchorRefs={anchorRefs}
      />
    </Scene3D>
  );
}
