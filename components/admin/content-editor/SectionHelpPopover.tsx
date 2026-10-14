"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import {
  SECTION_HELP_I18N,
  type SectionHelpKind,
} from "@/lib/content-editor-help";

type Translate = (path: string, vars?: Record<string, string | number>) => string;

function HelpDemo({ kind }: { kind: SectionHelpKind }) {
  if (kind === "heroMedia" || kind === "homepageHero" || kind === "catalogHero") {
    return (
      <div className={`csp-mini csp-mini-hero${kind === "homepageHero" ? " is-home" : ""}`}>
        <span className="csp-mini-media" aria-hidden />
        <span className="csp-mini-copy">
          <i />
          <b />
          <em />
          {kind === "homepageHero" ? (
            <span className="csp-mini-labels">
              <i />
              <i />
              <i />
            </span>
          ) : null}
          {kind === "catalogHero" ? <span className="csp-mini-lead" /> : null}
        </span>
      </div>
    );
  }
  if (kind === "featureGrid") {
    return (
      <div className="csp-mini csp-mini-cards">
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className="csp-mini-card">
            <i />
            <b />
            <em />
          </span>
        ))}
      </div>
    );
  }
  if (kind === "benefitsList") {
    return (
      <div className="csp-mini csp-mini-list">
        <b />
        <span className="csp-mini-rule" />
        {[0, 1, 2].map((index) => (
          <span key={index} className="csp-mini-li">
            <i />
            <em />
          </span>
        ))}
      </div>
    );
  }
  if (kind === "notice") {
    return (
      <div className="csp-mini csp-mini-notice">
        <b />
        <em />
      </div>
    );
  }
  if (kind === "valuesStrip") {
    return (
      <div className="csp-mini csp-mini-values">
        <i />
        <b />
        <em />
        <span className="csp-mini-stars">★★★★★</span>
      </div>
    );
  }
  if (kind === "bookingCta") {
    return (
      <div className="csp-mini csp-mini-banner">
        <em />
        <span className="csp-mini-btn" />
      </div>
    );
  }
  if (kind === "buttons") {
    return (
      <div className="csp-mini csp-mini-buttons">
        <span className="csp-mini-btn" />
        <span className="csp-mini-btn is-ghost" />
      </div>
    );
  }
  if (kind === "gallery") {
    return (
      <div className="csp-mini csp-mini-gallery">
        <i />
        <i />
        <i />
      </div>
    );
  }
  if (kind === "products") {
    return (
      <div className="csp-mini csp-mini-products">
        {[0, 1, 2].map((index) => (
          <span key={index} className="csp-mini-product">
            <i />
            <b />
            <em />
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="csp-mini csp-mini-footer">
      <b />
      <em />
      <span className="csp-mini-meta">
        <i />
        <i />
      </span>
    </div>
  );
}

export default function SectionHelpPopover({
  kind,
  t,
}: {
  kind: SectionHelpKind;
  t: Translate;
}) {
  const copy = SECTION_HELP_I18N[kind];
  const tooltipId = useId();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent | PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className={open ? "csp-help is-open" : "csp-help"}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="csp-help-btn"
        aria-label={t("admin.servicePages.sectionHelp")}
        aria-expanded={open}
        aria-controls={tooltipId}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <CircleHelp size={14} strokeWidth={2.1} aria-hidden />
      </button>
      <span className="csp-help-pop" id={tooltipId} role="tooltip">
        <strong>{t(copy.title)}</strong>
        <p>{t(copy.body)}</p>
        <HelpDemo kind={kind} />
      </span>
    </span>
  );
}
