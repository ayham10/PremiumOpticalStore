"use client";

import { useId, useState, type ReactNode } from "react";
import {
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Images,
  Layers,
  Link as LinkIcon,
  MousePointerClick,
  Package,
  Settings,
  Type,
  type LucideIcon,
} from "lucide-react";

export const EDITOR_SECTION_ICONS = {
  text: Type,
  hero: ImageIcon,
  buttons: MousePointerClick,
  products: Package,
  gallery: Images,
  settings: Settings,
  page: FileText,
  links: LinkIcon,
  sections: Layers,
} as const satisfies Record<string, LucideIcon>;

export type EditorSectionIcon = keyof typeof EDITOR_SECTION_ICONS;

export default function EditorSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: EditorSectionIcon;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const Icon = EDITOR_SECTION_ICONS[icon];

  return (
    <section className="admin-card admin-service-card csp-fold">
      <button
        type="button"
        className="csp-fold-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="csp-fold-heading">
          <Icon size={18} strokeWidth={1.75} className="csp-fold-icon" aria-hidden />
          <span>{title}</span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.8}
          className={open ? "csp-fold-chevron is-open" : "csp-fold-chevron"}
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
