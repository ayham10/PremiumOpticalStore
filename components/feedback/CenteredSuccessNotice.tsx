"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

export const CENTERED_SUCCESS_NOTICE_MS = 3500;
export const CENTERED_SUCCESS_NOTICE_FADE_MS = 280;

export default function CenteredSuccessNotice({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!message) return;
    setLeaving(false);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const fade = reduceMotion ? 0 : CENTERED_SUCCESS_NOTICE_FADE_MS;
    const hide = window.setTimeout(
      () => setLeaving(true),
      CENTERED_SUCCESS_NOTICE_MS,
    );
    const done = window.setTimeout(
      () => onCloseRef.current(),
      CENTERED_SUCCESS_NOTICE_MS + fade,
    );
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(done);
    };
  }, [message]);

  if (!mounted || !message) return null;

  return createPortal(
    <div
      className={
        leaving
          ? "oyon-success-notice is-leaving"
          : "oyon-success-notice"
      }
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="oyon-success-notice-card">
        <span className="oyon-success-notice-check" aria-hidden>
          <Check size={22} strokeWidth={2.4} />
        </span>
        <p className="oyon-success-notice-text">{message}</p>
      </div>
    </div>,
    document.body,
  );
}
