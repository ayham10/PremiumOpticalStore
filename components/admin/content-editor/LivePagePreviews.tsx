"use client";

import {
  memo,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import {
  CONTENT_PREVIEW_CHROME,
  CONTENT_PREVIEW_MESSAGE,
  CONTENT_PREVIEW_PATH,
  CONTENT_PREVIEW_READY,
  CONTENT_PREVIEW_VIEWPORTS,
  CONTENT_PREVIEW_VISIBILITY,
  MOBILE_PREVIEW_DISPLAY_SCALE,
  fitPreviewColumnScale,
  normalizeWheelDelta,
  screenDeltaToPreviewScroll,
  shouldStartPreviewDrag,
  snapshotForDirty,
  viewHrefForEditor,
  type ContentPreviewPayload,
} from "@/lib/content-editor-preview";
import {
  isContentPreviewLabelMessage,
  previewEditingLabel,
} from "@/lib/content-editor-sections";

function scrollPreviewWindow(
  frame: HTMLIFrameElement | null,
  screenDelta: number,
  scale: number,
) {
  const win = frame?.contentWindow;
  if (!win || !screenDelta) return;
  win.scrollBy(0, screenDeltaToPreviewScroll(screenDelta, scale));
}

function DeviceFrame({
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
  const shellRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const lastSent = useRef("");
  const scaleRef = useRef(0.28);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastY: number;
    moved: boolean;
  } | null>(null);
  const [scale, setScale] = useState(0.28);
  const [dragging, setDragging] = useState(false);
  const [chromeEditing, setChromeEditing] = useState(false);
  const viewport = CONTENT_PREVIEW_VIEWPORTS[mode];
  const chrome = CONTENT_PREVIEW_CHROME[mode];
  const href = viewHrefForEditor(payload.kind, payload.customPage?.slug);
  scaleRef.current = scale;

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
      if (isContentPreviewLabelMessage(event.data)) {
        setChromeEditing(
          Boolean(payloadRef.current.activeSectionId) && event.data.clipped,
        );
        return;
      }
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
    if (!payload.activeSectionId) setChromeEditing(false);
  }, [payload.activeSectionId]);

  useEffect(() => {
    postVisibility(visible);
  }, [visible]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    function applyScale() {
      const next = fitPreviewColumnScale(
        stage?.clientWidth || viewport.width,
        viewport.width,
        chrome.width,
        mode === "mobile" ? MOBILE_PREVIEW_DISPLAY_SCALE : 1,
      );
      scaleRef.current = next;
      setScale(next);
    }

    applyScale();
    const observer = new ResizeObserver(applyScale);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [chrome.width, mode, viewport.width]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      event.stopPropagation();
      scrollPreviewWindow(
        frameRef.current,
        normalizeWheelDelta(event),
        scaleRef.current,
      );
    }

    shell.addEventListener("wheel", onWheel, { passive: false });
    return () => shell.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const previous = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = previous;
    };
  }, [dragging]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastY: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = Math.hypot(
      event.clientX - drag.startX,
      event.clientY - drag.startY,
    );
    if (!drag.moved && shouldStartPreviewDrag(distance)) {
      drag.moved = true;
      setDragging(true);
    }
    if (!drag.moved) return;
    event.preventDefault();
    const delta = drag.lastY - event.clientY;
    drag.lastY = event.clientY;
    scrollPreviewWindow(frameRef.current, delta, scaleRef.current);
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
  }

  const frame = (
    <>
      <div className="csp-device-scaler">
        {load ? (
          <iframe
            ref={frameRef}
            className="csp-device-frame"
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
          <div className="csp-device-frame" aria-hidden />
        )}
      </div>
      <div
        className={
          dragging ? "csp-device-glass is-dragging" : "csp-device-glass"
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onContextMenu={(event) => event.preventDefault()}
        aria-hidden
      />
    </>
  );

  return (
    <figure
      className={`csp-device is-${mode}`}
      ref={shellRef}
      style={
        {
          "--csp-preview-scale": String(scale),
          "--csp-preview-width": `${viewport.width}px`,
          "--csp-preview-height": `${viewport.height}px`,
        } as CSSProperties
      }
    >
      <figcaption>
        <span>{label}</span>
        {payload.activeSectionId && chromeEditing ? (
          <span className="csp-device-editing" dir={payload.locale === "en" ? "ltr" : "rtl"}>
            {previewEditingLabel(payload.locale)}
          </span>
        ) : null}
      </figcaption>
      <div className="csp-device-stage" ref={stageRef}>
        {mode === "mobile" ? (
          <div className="csp-phone">
            <i className="csp-phone-notch" aria-hidden />
            <div className="csp-phone-screen">{frame}</div>
            <i className="csp-phone-home" aria-hidden />
          </div>
        ) : (
          <div className="csp-browser">
            <div className="csp-browser-toolbar" aria-hidden>
              <span className="csp-browser-dots">
                <i />
                <i />
                <i />
              </span>
              <span className="csp-browser-url">oyonoptics.com{href}</span>
            </div>
            <div className="csp-browser-screen">{frame}</div>
          </div>
        )}
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
      <DeviceFrame
        mode="mobile"
        label={mobileLabel}
        payload={payload}
        load={load}
        visible={visible}
      />
      <DeviceFrame
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
