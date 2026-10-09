"use client";

import { useEffect, useState } from "react";
import ContentPreviewCanvas from "@/components/admin/content-editor/ContentPreviewCanvas";
import {
  CONTENT_PREVIEW_READY,
  isContentPreviewMessage,
  snapshotForDirty,
  type ContentPreviewPayload,
} from "@/lib/content-editor-preview";
import {
  installPreviewFetchGuard,
  installPreviewMediaGuard,
} from "@/lib/preview-runtime";

export default function ContentEditorPreviewPage() {
  const [payload, setPayload] = useState<ContentPreviewPayload | null>(null);

  useEffect(() => {
    document.documentElement.classList.remove("admin-dark");
    document.body.classList.remove("admin-dark");
    const stopWrites = installPreviewFetchGuard();
    const stopMedia = installPreviewMediaGuard();
    window.parent?.postMessage(
      { type: CONTENT_PREVIEW_READY },
      window.location.origin,
    );

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!isContentPreviewMessage(event.data)) return;
      setPayload((current) => {
        const next = event.data.payload;
        if (
          current &&
          snapshotForDirty(current) === snapshotForDirty(next)
        ) {
          return current;
        }
        return next;
      });
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      stopMedia();
      stopWrites();
    };
  }, []);

  if (!payload) {
    return <div className="csp-preview-canvas csp-preview-waiting" />;
  }

  return <ContentPreviewCanvas payload={payload} />;
}
