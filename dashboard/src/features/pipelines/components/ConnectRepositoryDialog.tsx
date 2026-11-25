import React, { useEffect, useRef, useState } from "react";
import { Dialog, useToast } from "../../../ui";
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
  const wasOpen = useRef(false);

  useEffect(() => {
    if (wasOpen.current && !open && openerEl) {
      requestAnimationFrame(() => openerEl.focus());
    }
    wasOpen.current = open;
  }, [open, openerEl]);

  const handleBeforeClose = () => {
    if (!isDirty) return true;
    return window.confirm("Discard unsaved repository details?");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Connect repository"
      description="Inspect workflow files before saving."
      onBeforeClose={handleBeforeClose}
    >
      <ConnectRepositoryForm
        autoFocus
        onDirtyChange={setIsDirty}
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
