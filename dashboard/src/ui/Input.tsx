import React, { forwardRef } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { SeverityShapeIcon } from "./Badge";

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string | null;
  hint?: string;
  confirmedMessage?: string | null;
}

/**
 * Accessible form input following DESIGN.md rules:
 * - Visible label above input
 * - Line-strong 1px border, 40px height, 12px horizontal padding, 8px radius
 * - Error sits below field tied via aria-describedby & aria-invalid (never inside label)
 * - Positive confirmation check shown only for async lookup or resolved errors
 */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { id, label, error, hint, confirmedMessage, className = "", ...props },
  ref
) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-error` : undefined;
  const describedBy = [errId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block pg-label-md text-[var(--pg-text)]"
      >
        {label}
      </label>

      {hint && (
        <p id={hintId} className="pg-body-sm text-[var(--pg-text-muted)] m-0">
          {hint}
        </p>
      )}

      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full h-10 px-3 rounded-[8px] pg-body-md bg-[var(--pg-panel)] text-[var(--pg-text)] placeholder:text-[var(--pg-text-muted)]/70 border transition-colors duration-120 ease-out disabled:opacity-60 ${
          error
            ? "border-[var(--pg-critical)]"
            : "border-[var(--pg-line-strong)] focus:border-[var(--pg-primary)]"
        } ${className}`}
        {...props}
      />

      {error && (
        <p
          id={errId}
          role="alert"
          className="pg-body-sm text-[var(--pg-critical)] m-0 flex items-center gap-1.5"
        >
          <SeverityShapeIcon shape="diamond" />
          <span>{error}</span>
        </p>
      )}

      {!error && confirmedMessage && (
        <p className="pg-body-sm text-[var(--pg-pass)] m-0 flex items-center gap-1.5">
          <SeverityShapeIcon shape="check" />
          <span>{confirmedMessage}</span>
        </p>
      )}
    </div>
  );
});

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  id?: string;
  value: string;
  onValueChange: (val: string) => void;
  options: readonly SelectOption[];
  disabled?: boolean;
  ariaLabel?: string;
  size?: "default" | "compact";
  className?: string;
}

export function Select({
  id,
  value,
  onValueChange,
  options,
  disabled = false,
  ariaLabel,
  size = "default",
  className = "",
}: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={`inline-flex items-center justify-between gap-2 rounded-[8px] bg-[var(--pg-panel)] text-[var(--pg-text)] border border-[var(--pg-line-strong)] hover:border-[var(--pg-text-muted)] disabled:opacity-60 cursor-pointer transition-colors duration-120 ${
          size === "compact" ? "h-8 px-2.5 pg-label-sm" : "h-10 px-3 pg-body-sm"
        } ${className}`}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon asChild>
          <ChevronDown size={16} strokeWidth={1.5} className="text-[var(--pg-text-muted)]" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-[90] min-w-[var(--radix-select-trigger-width)] max-h-60 overflow-auto rounded-[8px] bg-[var(--pg-panel)] border border-[var(--pg-line-strong)] p-1 text-[var(--pg-text)]"
          style={{ boxShadow: "var(--pg-overlay-shadow)" }}
        >
          <SelectPrimitive.Viewport>
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-[4px] pg-body-sm text-[var(--pg-text)] outline-none cursor-pointer data-[highlighted]:bg-[var(--pg-raised)] data-[state=checked]:text-[var(--pg-primary)]"
              >
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator>
                  <SeverityShapeIcon shape="check" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
