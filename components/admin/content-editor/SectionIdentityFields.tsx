"use client";

export default function SectionIdentityFields({
  heading,
  onHeadingChange,
  headingLabel,
  headingHint,
  adminName,
  onAdminNameChange,
  adminLabel,
  adminHint,
  dir,
  lang,
  hideHeading,
}: {
  heading?: string;
  onHeadingChange?: (value: string) => void;
  headingLabel?: string;
  headingHint?: string;
  adminName: string;
  onAdminNameChange: (value: string) => void;
  adminLabel: string;
  adminHint: string;
  dir?: "ltr" | "rtl";
  lang?: string;
  hideHeading?: boolean;
}) {
  return (
    <div className="csp-section-identity">
      {!hideHeading && onHeadingChange ? (
        <label className="admin-service-field">
          <span className="label">{headingLabel}</span>
          <input
            className="input"
            dir={dir}
            lang={lang}
            value={heading || ""}
            onChange={(event) => onHeadingChange(event.target.value)}
          />
          {headingHint ? <small className="admin-muted">{headingHint}</small> : null}
        </label>
      ) : null}
      <label className="admin-service-field">
        <span className="label">{adminLabel}</span>
        <input
          className="input"
          dir={dir}
          lang={lang}
          value={adminName}
          onChange={(event) => onAdminNameChange(event.target.value)}
        />
        <small className="admin-muted">{adminHint}</small>
      </label>
    </div>
  );
}
