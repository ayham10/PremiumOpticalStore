"use client";

import type { ReactNode } from "react";

type Props = {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

/** Consistent premium page header: title → description → actions */
export default function AdminPageHeader({
  kicker,
  title,
  description,
  actions,
}: Props) {
  return (
    <header className="admin-page-header">
      <div className="admin-page-header-copy">
        {kicker ? <p className="admin-kicker">{kicker}</p> : null}
        <h1 className="admin-page-title">{title}</h1>
        {description ? (
          <p className="admin-page-desc">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="admin-page-actions">{actions}</div> : null}
    </header>
  );
}
