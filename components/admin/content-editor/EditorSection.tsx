"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export default function EditorSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="admin-card admin-service-card csp-fold">
      <button
        type="button"
        className="csp-fold-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{title}</span>
        <ChevronDown
          size={16}
          strokeWidth={1.8}
          className={open ? "is-open" : ""}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={panelId} className="csp-fold-body">
          {children}
        </div>
      ) : null}
    </section>
  );
}
