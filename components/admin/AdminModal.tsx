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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(16, 21, 28, 0.45)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="admin-card max-h-[90vh] w-full overflow-y-auto p-6"
        style={{ maxWidth: wide ? 720 : 480 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2
            className="text-xl"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            {title}
          </h2>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line)] text-[var(--slate)] hover:text-[var(--ink)]"
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
