import React, { useEffect, useRef, useState } from "react";
import { Button, Dialog, useToast } from "../../../ui";
import { ConnectRepositoryForm } from "./ConnectRepositoryForm";

export const RECENT_CONNECTED_KEY = "pg-recent-connected";

export function ConnectRepositoryDialog({
  open,
  onOpenChange,
  openerEl,
  onConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openerEl?: HTMLElement | null;
  onConnected?: (pipelineId: string) => void;
}) {
  const { pushToast } = useToast();
  const [isDirty, setIsDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (wasOpen.current && !open && openerEl) {
      requestAnimationFrame(() => openerEl.focus());
    }
    wasOpen.current = open;
    if (!open) {
      setConfirmDiscard(false);
    }
  }, [open, openerEl]);

  const handleBeforeClose = () => {
    if (!isDirty) return true;
    setConfirmDiscard(true);
    return false;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Connect repository"
      description="Inspect workflow files before saving."
      onBeforeClose={handleBeforeClose}
    >
      {confirmDiscard && (
        <div
          role="alert"
          className="mb-4 rounded-[8px] border border-[var(--pg-high)] bg-[var(--pg-high-tint)] p-3 flex flex-wrap items-center justify-between gap-3"
        >
          <span className="pg-body-sm text-[var(--pg-text)]">
            Discard unsaved repository details?
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="compact"
              onClick={() => setConfirmDiscard(false)}
            >
              Keep editing
            </Button>
            <Button
              variant="danger"
              size="compact"
              onClick={() => {
                setConfirmDiscard(false);
                setIsDirty(false);
                onOpenChange(false);
              }}
            >
              Discard
            </Button>
          </div>
        </div>
      )}

      <ConnectRepositoryForm
        autoFocus
        onDirtyChange={(dirty) => {
          setIsDirty(dirty);
          if (!dirty) setConfirmDiscard(false);
        }}
        onCancel={() => {
          if (handleBeforeClose()) {
            onOpenChange(false);
          }
        }}
        onSuccess={(createdId) => {
          try {
            sessionStorage.setItem(RECENT_CONNECTED_KEY, createdId);
          } catch {
            // ignore
          }
          setIsDirty(false);
          onOpenChange(false);
          pushToast({
            message: "Repository connected. First scan queued.",
            tone: "pass",
          });
          onConnected?.(createdId);
        }}
      />
    </Dialog>
  );
}
