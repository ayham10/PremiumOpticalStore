"use client";

import { useEffect, useState } from "react";
import ContentPreviewCanvas from "@/components/admin/content-editor/ContentPreviewCanvas";
import {
  CONTENT_PREVIEW_READY,
  isContentPreviewMessage,
  type ContentPreviewPayload,
} from "@/lib/content-editor-preview";

export default function ContentEditorPreviewPage() {
  const [payload, setPayload] = useState<ContentPreviewPayload | null>(null);

  useEffect(() => {
    document.documentElement.classList.remove("admin-dark");
    document.body.classList.remove("admin-dark");
    window.parent?.postMessage(
      { type: CONTENT_PREVIEW_READY },
      window.location.origin,
    );

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!isContentPreviewMessage(event.data)) return;
      setPayload(event.data.payload);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!payload) {
    return <div className="csp-preview-canvas csp-preview-waiting" />;
  }

  return <ContentPreviewCanvas payload={payload} />;
}
