"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/format";

export default function AdminModal({
  open,
  title,
  onClose,
  children,
  wide,
  className,
  icon,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
  icon?: ReactNode;
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
        className={cn(
          "admin-card max-h-[92svh] w-full overflow-y-auto rounded-b-none pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:rounded-[18px] sm:pb-6",
          className,
        )}
        style={{ maxWidth: wide ? 720 : 480 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="admin-modal-head mb-6 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon ? <span className="admin-modal-icon">{icon}</span> : null}
            <h2 className="admin-section-title">{title}</h2>
          </div>
          <button
            type="button"
            className="admin-modal-close grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"
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
