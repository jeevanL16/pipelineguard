import React, { forwardRef } from "react";
import { SeverityShapeIcon } from "./Badge";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "default" | "compact";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
  pendingText?: string;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--pg-primary)] text-[var(--pg-on-primary)] hover:bg-[var(--pg-primary-hover)] border border-transparent",
  secondary:
    "bg-[var(--pg-raised)] text-[var(--pg-text)] border border-[var(--pg-line)] hover:border-[var(--pg-line-strong)]",
  danger:
    "bg-[var(--pg-critical)] text-[var(--pg-on-primary)] border border-transparent hover:opacity-90",
  ghost:
    "bg-transparent text-[var(--pg-text-muted)] border border-transparent hover:text-[var(--pg-text)] hover:bg-[var(--pg-raised)]",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  default: "h-10 px-4 pg-label-lg",
  compact: "h-8 px-3 pg-label-md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "default",
    pending = false,
    pendingText,
    children,
    className = "",
    disabled,
    type = "button",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`inline-grid place-items-center rounded-[8px] font-medium whitespace-nowrap transition-[background-color,border-color,transform] duration-120 ease-out active:translate-y-px disabled:opacity-60 disabled:pointer-events-none cursor-pointer ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      <span
        className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${
          pending && pendingText ? "invisible" : ""
        }`}
      >
        {children}
      </span>
      {pending && pendingText && (
        <span className="col-start-1 row-start-1 inline-flex items-center justify-center gap-2">
          {pendingText}
        </span>
      )}
    </button>
  );
});

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  children: React.ReactNode;
}

export function Chip({
  selected = false,
  children,
  className = "",
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`inline-flex items-center gap-1.5 h-7 px-2 rounded-[4px] pg-label-sm border transition-colors duration-120 ease-out cursor-pointer select-none ${
        selected
          ? "bg-[var(--pg-raised)] text-[var(--pg-text)] border-[var(--pg-line-strong)]"
          : "bg-[var(--pg-panel)] text-[var(--pg-text-muted)] border-[var(--pg-line)] hover:text-[var(--pg-text)] hover:border-[var(--pg-line-strong)]"
      } ${className}`}
      {...props}
    >
      {selected && (
        <SeverityShapeIcon shape="check" className="text-[var(--pg-primary)]" />
      )}
      <span>{children}</span>
    </button>
  );
}

export function Kbd({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={`inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-[4px] bg-[var(--pg-raised)] text-[var(--pg-text-muted)] border border-[var(--pg-line)] pg-code-sm leading-none ${className}`}
    >
      {children}
    </kbd>
  );
}
