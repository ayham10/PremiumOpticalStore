"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
};

/** Consistent premium page header: title → description → actions */
export default function AdminPageHeader({
  kicker,
  title,
  description,
  actions,
  icon: Icon,
}: Props) {
  return (
    <header className="admin-page-header">
      <div className="admin-page-header-copy">
        {kicker ? <p className="admin-kicker">{kicker}</p> : null}
        <div className="admin-page-title-row">
          <h1 className="admin-page-title">{title}</h1>
          {Icon ? (
            <Icon
              className="admin-page-title-icon"
              size={26}
              strokeWidth={1.45}
              aria-hidden
            />
          ) : null}
        </div>
        {description ? (
          <p className="admin-page-desc">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="admin-page-actions">{actions}</div> : null}
    </header>
  );
}
