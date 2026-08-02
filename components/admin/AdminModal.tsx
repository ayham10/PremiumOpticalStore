"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export default function AdminModal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: "rgba(11, 15, 20, 0.72)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="admin-card max-h-[92svh] w-full overflow-y-auto rounded-b-none pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:rounded-[18px] sm:pb-6"
        style={{ maxWidth: wide ? 720 : 480 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="admin-section-title">{title}</h2>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
