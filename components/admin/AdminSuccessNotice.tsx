"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, X } from "lucide-react";

const AUTO_HIDE_MS = 2500;
export const ADMIN_SAVE_SUCCESS_MESSAGE = "تم حفظ التغييرات بنجاح";

type AdminSuccessNoticeContextValue = {
  notifySaved: () => void;
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
  const timerRef = useRef<number | null>(null);

  const hide = useCallback(() => {
    setOpen(false);
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const notifySaved = useCallback(() => {
    setOpen(true);
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setOpen(false);
      timerRef.current = null;
    }, AUTO_HIDE_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const value = useMemo(() => ({ notifySaved }), [notifySaved]);

  return (
    <AdminSuccessNoticeContext.Provider value={value}>
      {children}
      <AdminSuccessNoticeToast open={open} onClose={hide} />
    </AdminSuccessNoticeContext.Provider>
  );
}

function AdminSuccessNoticeToast({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="admin-save-toast"
      role="status"
      aria-live="polite"
      dir="rtl"
    >
      <span className="admin-save-toast-check" aria-hidden>
        <Check size={15} strokeWidth={2.6} />
      </span>
      <p className="admin-save-toast-text">{ADMIN_SAVE_SUCCESS_MESSAGE}</p>
      <button
        type="button"
        className="admin-save-toast-close"
        onClick={onClose}
        aria-label="إغلاق"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
