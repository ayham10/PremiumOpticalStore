"use client";

import { memo, useEffect, useRef, useState } from "react";
import {
  CONTENT_PREVIEW_MESSAGE,
  CONTENT_PREVIEW_PATH,
  CONTENT_PREVIEW_READY,
  CONTENT_PREVIEW_VIEWPORTS,
  CONTENT_PREVIEW_VISIBILITY,
  snapshotForDirty,
  type ContentPreviewPayload,
} from "@/lib/content-editor-preview";

function ScaledFrame({
  mode,
  label,
  payload,
  load,
  visible,
}: {
  mode: "mobile" | "desktop";
  label: string;
  payload: ContentPreviewPayload;
  load: boolean;
  visible: boolean;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const lastSent = useRef("");
  const viewport = CONTENT_PREVIEW_VIEWPORTS[mode];

  function post(
    target?: Window | null,
    next: ContentPreviewPayload = payloadRef.current,
  ) {
    const win = target ?? frameRef.current?.contentWindow;
    if (!win) return;
    const serialized = snapshotForDirty(next);
    if (serialized && serialized === lastSent.current) return;
    lastSent.current = serialized;
    win.postMessage(
      { type: CONTENT_PREVIEW_MESSAGE, payload: next },
      window.location.origin,
    );
  }

  function postVisibility(nextVisible: boolean) {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      { type: CONTENT_PREVIEW_VISIBILITY, visible: nextVisible },
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
        lastSent.current = "";
        post(event.source as Window);
        postVisibility(visible);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [visible]);

  useEffect(() => {
    post();
  }, [payload]);

  useEffect(() => {
    postVisibility(visible);
  }, [visible]);

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
          {load ? (
            <iframe
              ref={frameRef}
              className="csp-scaled-preview-frame"
              title={label}
              src={CONTENT_PREVIEW_PATH}
              onLoad={() => {
                lastSent.current = "";
                post();
                postVisibility(visible);
              }}
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="csp-scaled-preview-frame" aria-hidden />
          )}
        </div>
      </div>
    </figure>
  );
}

function LivePagePreviews({
  payload,
  mobileLabel,
  desktopLabel,
  revealed,
}: {
  payload: ContentPreviewPayload;
  mobileLabel: string;
  desktopLabel: string;
  revealed?: boolean;
}) {
  const [desktop, setDesktop] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 900px)");
    const sync = () => setDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (desktop || revealed) setLoaded(true);
  }, [desktop, revealed]);

  const load = desktop || loaded;
  const visible = desktop || Boolean(revealed);

  return (
    <div className="csp-live-previews">
      <ScaledFrame
        mode="mobile"
        label={mobileLabel}
        payload={payload}
        load={load}
        visible={visible}
      />
      <ScaledFrame
        mode="desktop"
        label={desktopLabel}
        payload={payload}
        load={load}
        visible={visible}
      />
    </div>
  );
}

export default memo(LivePagePreviews);
