import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, m } from "motion/react";
import { X } from "lucide-react";
import { MOTION } from "../motion/motion";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onBeforeClose?: () => boolean;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  onBeforeClose,
  children,
  maxWidthClass = "max-w-[520px]",
}: DialogProps) {
  const handleAttemptClose = () => {
    if (onBeforeClose && !onBeforeClose()) {
      return;
    }
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          handleAttemptClose();
        } else {
          onOpenChange(true);
        }
      }}
    >
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild>
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={MOTION.stateChange}
                className="fixed inset-0 z-50"
                style={{ backgroundColor: "var(--pg-scrim)" }}
              />
            </DialogPrimitive.Overlay>

            <DialogPrimitive.Content
              onOpenAutoFocus={(e) => {
                // Move focus inside dialog content frame-0 before Radix sets aria-hidden on background
                const target = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>(
                  "input:not([disabled]), button:not([aria-label='Close dialog'])"
                );
                if (target) {
                  e.preventDefault();
                  target.focus();
                }
              }}
              onEscapeKeyDown={(e) => {
                if (onBeforeClose && !onBeforeClose()) {
                  e.preventDefault();
                }
              }}
              onPointerDownOutside={(e) => {
                if (onBeforeClose && !onBeforeClose()) {
                  e.preventDefault();
                }
              }}
              asChild
            >
              <m.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={MOTION.surfaceEnter}
                className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100vw-32px)] ${maxWidthClass} max-h-[90vh] overflow-y-auto rounded-[14px] bg-[var(--pg-panel)] text-[var(--pg-text)] border border-[var(--pg-line)] p-6 outline-none`}
                style={{ boxShadow: "var(--pg-overlay-shadow)" }}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <DialogPrimitive.Title className="pg-headline-sm text-[var(--pg-text)] m-0">
                      {title}
                    </DialogPrimitive.Title>
                    {description && (
                      <DialogPrimitive.Description className="pg-body-sm text-[var(--pg-text-muted)] mt-1 m-0">
                        {description}
                      </DialogPrimitive.Description>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAttemptClose}
                    aria-label="Close dialog"
                    className="p-2 rounded-[8px] text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] hover:bg-[var(--pg-raised)] transition-colors cursor-pointer"
                  >
                    <X size={16} strokeWidth={1.5} />
                  </button>
                </div>
                {children}
              </m.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Right-hand evidence drawer — square on the screen edge (rounded: none).
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
}: DrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild>
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={MOTION.stateChange}
                className="fixed inset-0 z-50"
                style={{ backgroundColor: "var(--pg-scrim)" }}
              />
            </DialogPrimitive.Overlay>

            <DialogPrimitive.Content asChild>
              <m.div
                initial={{ x: "100%", opacity: 0.9 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0.9 }}
                transition={MOTION.surfaceEnter}
                className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[560px] h-full overflow-y-auto rounded-none bg-[var(--pg-panel)] text-[var(--pg-text)] border-l border-[var(--pg-line)] p-6 outline-none"
                style={{ boxShadow: "var(--pg-overlay-shadow)" }}
              >
                <div className="flex items-start justify-between gap-4 pb-4 mb-5 border-b border-[var(--pg-line)]">
                  <div className="min-w-0">
                    <DialogPrimitive.Title className="pg-headline-sm text-[var(--pg-text)] m-0 break-words">
                      {title}
                    </DialogPrimitive.Title>
                    {subtitle && (
                      <DialogPrimitive.Description className="pg-code-sm text-[var(--pg-text-muted)] mt-1 m-0">
                        {subtitle}
                      </DialogPrimitive.Description>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    aria-label="Close drawer"
                    className="p-2 rounded-[8px] text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] hover:bg-[var(--pg-raised)] transition-colors shrink-0 cursor-pointer"
                  >
                    <X size={16} strokeWidth={1.5} />
                  </button>
                </div>
                {children}
              </m.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
