import React, { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { X } from "lucide-react";
import { MOTION } from "../motion/motion";
import { SeverityShapeIcon } from "./Badge";

export interface ToastItem {
  id: string;
  message: string;
  tone?: "pass" | "critical" | "neutral";
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
}

interface ToastContextValue {
  pushToast: (toast: Omit<ToastItem, "id"> & { durationMs?: number }) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ durationMs = 6000, ...rest }: Omit<ToastItem, "id"> & { durationMs?: number }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, ...rest }]);
      if (durationMs > 0) {
        setTimeout(() => dismissToast(id), durationMs);
      }
      return id;
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ pushToast, dismissToast }}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions text"
        className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-[380px] w-[calc(100vw-40px)] pointer-events-none"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <m.div
              key={toast.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={MOTION.surfaceEnter}
              className="pointer-events-auto flex items-center justify-between gap-3 rounded-[8px] bg-[var(--pg-raised)] text-[var(--pg-text)] border border-[var(--pg-line-strong)] px-3 py-2.5 pg-body-sm"
              style={{ boxShadow: "var(--pg-overlay-shadow)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {toast.tone === "pass" && (
                  <SeverityShapeIcon shape="check" className="text-[var(--pg-pass)]" />
                )}
                {toast.tone === "critical" && (
                  <SeverityShapeIcon shape="diamond" className="text-[var(--pg-critical)]" />
                )}
                <span className="truncate">{toast.message}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {toast.actionLabel && toast.onAction && (
                  <button
                    type="button"
                    onClick={async () => {
                      await toast.onAction?.();
                      dismissToast(toast.id);
                    }}
                    className="px-2 py-1 rounded-[4px] bg-[var(--pg-panel)] text-[var(--pg-primary)] hover:underline pg-label-sm cursor-pointer border border-[var(--pg-line)]"
                  >
                    {toast.actionLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Dismiss notification"
                  className="p-1 rounded-[4px] text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] cursor-pointer"
                >
                  <X size={14} strokeWidth={1.5} />
                </button>
              </div>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
