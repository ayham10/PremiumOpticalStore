"use client";

import { useEffect, useRef } from "react";
import {
  CONTENT_PREVIEW_MESSAGE,
  CONTENT_PREVIEW_PATH,
  CONTENT_PREVIEW_READY,
  CONTENT_PREVIEW_VIEWPORTS,
  type ContentPreviewPayload,
} from "@/lib/content-editor-preview";

function ScaledFrame({
  mode,
  label,
  payload,
}: {
  mode: "mobile" | "desktop";
  label: string;
  payload: ContentPreviewPayload;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const viewport = CONTENT_PREVIEW_VIEWPORTS[mode];

  function post(target?: Window | null) {
    const win = target ?? frameRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      { type: CONTENT_PREVIEW_MESSAGE, payload: payloadRef.current },
      window.location.origin,
    );
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      if (
        event.data &&
        typeof event.data === "object" &&
        (event.data as { type?: string }).type === CONTENT_PREVIEW_READY
      ) {
        post(event.source as Window);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const serialized = JSON.stringify(payload);
  useEffect(() => {
    post();
    // Serialized draft is the live preview contract; avoid object-identity loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    function applyScale() {
      const width = shell?.clientWidth || viewport.width;
      const scale = Math.min(1, width / viewport.width);
      shell?.style.setProperty("--csp-preview-scale", String(scale));
      shell?.style.setProperty("--csp-preview-width", `${viewport.width}px`);
      shell?.style.setProperty("--csp-preview-height", `${viewport.height}px`);
    }

    applyScale();
    const observer = new ResizeObserver(applyScale);
    observer.observe(shell);
    return () => observer.disconnect();
  }, [viewport.height, viewport.width]);

  return (
    <figure className={`csp-scaled-preview is-${mode}`} ref={shellRef}>
      <figcaption>{label}</figcaption>
      <div className="csp-scaled-preview-scroll">
        <div className="csp-scaled-preview-sizer">
          <iframe
            ref={frameRef}
            className="csp-scaled-preview-frame"
            title={label}
            src={CONTENT_PREVIEW_PATH}
            onLoad={() => post()}
            sandbox="allow-scripts allow-same-origin allow-popups-to-escape-sandbox"
          />
        </div>
      </div>
    </figure>
  );
}

export default function LivePagePreviews({
  payload,
  mobileLabel,
  desktopLabel,
}: {
  payload: ContentPreviewPayload;
  mobileLabel: string;
  desktopLabel: string;
}) {
  return (
    <div className="csp-live-previews">
      <ScaledFrame mode="mobile" label={mobileLabel} payload={payload} />
      <ScaledFrame mode="desktop" label={desktopLabel} payload={payload} />
    </div>
  );
}
