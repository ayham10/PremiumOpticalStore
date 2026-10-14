"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

export type PeekOption = {
  id: string;
  label: string;
  hint?: string;
};

export default function AdminPeekMultiSelect({
  options,
  selectedIds,
  onChange,
  placeholder,
  selectedLabel,
  emptyLabel,
  ariaLabel,
}: {
  options: PeekOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  selectedLabel?: string;
  emptyLabel: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.filter((item) => selectedIds.includes(item.id)),
    [options, selectedIds],
  );

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function toggle(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((item) => item !== id)
      : [...selectedIds, id];
    onChange(next);
    setOpen(false);
  }

  return (
    <div className="admin-peek" ref={rootRef}>
      <button
        type="button"
        className="admin-peek-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="admin-peek-value">
          {selected.length
            ? selected.map((item) => item.label).join("، ")
            : placeholder}
        </span>
        <ChevronDown size={15} strokeWidth={1.8} aria-hidden />
      </button>
      {selected.length > 0 ? (
        <div className="admin-cat-chips" aria-label={selectedLabel}>
          {selected.map((item) => (
            <button
              key={item.id}
              type="button"
              className="admin-cat-chip"
              onClick={() => toggle(item.id)}
            >
              <span>{item.label}</span>
              <X size={12} strokeWidth={2} aria-hidden />
            </button>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="admin-peek-menu" role="listbox" aria-multiselectable>
          {options.length === 0 ? (
            <p className="admin-cat-hint">{emptyLabel}</p>
          ) : (
            options.map((item) => {
              const checked = selectedIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  className={`admin-cat-option${checked ? " is-selected" : ""}`}
                  onClick={() => toggle(item.id)}
                >
                  <span className="admin-cat-option-name">{item.label}</span>
                  {item.hint ? (
                    <span className="admin-cat-pill is-hidden">{item.hint}</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
