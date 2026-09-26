"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

export const ADMIN_SAVE_SUCCESS_MESSAGE = "تم حفظ التغييرات بنجاح";
export const ADMIN_SAVE_CONTINUE_LABEL = "متابعة";

export type AdminSuccessNoticeOptions = {
  title?: string;
  detail?: string;
};

type AdminSuccessNoticeContextValue = {
  notifySaved: (options?: AdminSuccessNoticeOptions) => void;
};

const AdminSuccessNoticeContext =
  createContext<AdminSuccessNoticeContextValue | null>(null);

export function useAdminSuccessNotice(): AdminSuccessNoticeContextValue {
  return (
    useContext(AdminSuccessNoticeContext) ?? {
      notifySaved: () => undefined,
    }
  );
}

export function AdminSuccessNoticeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(ADMIN_SAVE_SUCCESS_MESSAGE);
  const [detail, setDetail] = useState<string | null>(null);

  const hide = useCallback(() => {
    setOpen(false);
  }, []);

  const notifySaved = useCallback((options?: AdminSuccessNoticeOptions) => {
    setTitle(options?.title?.trim() || ADMIN_SAVE_SUCCESS_MESSAGE);
    setDetail(options?.detail?.trim() || null);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ notifySaved }), [notifySaved]);

  return (
    <AdminSuccessNoticeContext.Provider value={value}>
      {children}
      <AdminSuccessNoticeDialog
        open={open}
        title={title}
        detail={detail}
        onClose={hide}
      />
    </AdminSuccessNoticeContext.Provider>
  );
}

function AdminSuccessNoticeDialog({
  open,
  title,
  detail,
  onClose,
}: {
  open: boolean;
  title: string;
  detail: string | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="admin-save-notice"
      role="presentation"
      dir="rtl"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
      }}
    >
      <div
        className="admin-save-notice-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-save-notice-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="admin-save-notice-check" aria-hidden>
          <Check size={22} strokeWidth={2.4} />
        </span>
        <h2 id="admin-save-notice-title">{title}</h2>
        {detail ? <p className="admin-save-notice-detail">{detail}</p> : null}
        <button
          type="button"
          className="admin-save-notice-btn"
          onClick={onClose}
        >
          {ADMIN_SAVE_CONTINUE_LABEL}
        </button>
      </div>
    </div>,
    document.body,
  );
}
