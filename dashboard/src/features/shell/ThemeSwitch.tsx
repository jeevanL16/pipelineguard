import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "../../app/theme";

const MODES: readonly { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { value: "system", label: "System", icon: <Monitor size={14} strokeWidth={1.5} /> },
  { value: "light", label: "Light", icon: <Sun size={14} strokeWidth={1.5} /> },
  { value: "dark", label: "Dark", icon: <Moon size={14} strokeWidth={1.5} /> },
];

export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="inline-flex items-center rounded-[8px] border border-[var(--pg-line)] bg-[var(--pg-panel)] p-0.5"
    >
      {MODES.map((m) => {
        const active = preference === m.value;
        return (
          <button
            key={m.value}
            type="button"
            aria-pressed={active}
            aria-label={`${m.label} theme`}
            title={`${m.label} theme`}
            onClick={() => setPreference(m.value)}
            className={`inline-flex items-center gap-1.5 h-7 px-2 rounded-[6px] pg-label-sm transition-colors duration-120 cursor-pointer ${
              active
                ? "bg-[var(--pg-raised)] text-[var(--pg-text)]"
                : "text-[var(--pg-text-muted)] hover:text-[var(--pg-text)]"
            }`}
          >
            {m.icon}
            {!compact && <span>{m.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
