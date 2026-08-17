"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import {
  BookingServiceIcon,
  BookingServiceIconPicker,
} from "@/components/admin/BookingServiceIcon";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { apiFetch } from "@/lib/admin-api";
import { hasPermission } from "@/lib/admin-permissions";
import { pickLocalized } from "@/lib/booking-services";
import { cn } from "@/lib/format";
import type { AdminSession, BookingService, LocalizedContent } from "@/lib/types";

const PAGE_BG = "#0B0E14";
const CARD_BG = "#151A21";
const BORDER = "#2A2F36";
const GOLD = "#D4AF37";
const MUTED = "#8A929C";

type ServiceForm = {
  nameAr: string;
  nameEn: string;
  nameHe: string;
  descriptionAr: string;
  descriptionEn: string;
  descriptionHe: string;
  icon: string;
  sortOrder: string;
  active: boolean;
};

function emptyForm(order = 1): ServiceForm {
  return {
    nameAr: "",
    nameEn: "",
    nameHe: "",
    descriptionAr: "",
    descriptionEn: "",
    descriptionHe: "",
    icon: "eye",
    sortOrder: String(order),
    active: true,
  };
}

function fromService(service: BookingService): ServiceForm {
  return {
    nameAr: service.name.ar || "",
    nameEn: service.name.en || "",
    nameHe: service.name.he || "",
    descriptionAr: service.description.ar || "",
    descriptionEn: service.description.en || "",
    descriptionHe: service.description.he || "",
    icon: service.icon || "calendar",
    sortOrder: String(service.sortOrder),
    active: service.active,
  };
}

function toLocalized(form: ServiceForm): {
  name: LocalizedContent;
  description: LocalizedContent;
} {
  return {
    name: {
      ar: form.nameAr.trim(),
      en: form.nameEn.trim(),
      he: form.nameHe.trim(),
    },
    description: {
      ar: form.descriptionAr.trim(),
      en: form.descriptionEn.trim(),
      he: form.descriptionHe.trim(),
    },
  };
}

const pageWrap: CSSProperties = {
  margin: "-1.15rem",
  marginBottom: "calc(-1.5rem - env(safe-area-inset-bottom, 0px))",
  minHeight: "100%",
  background: PAGE_BG,
  padding: 16,
  paddingBottom: "calc(5.85rem + env(safe-area-inset-bottom, 0px))",
  overflowX: "hidden",
};

const fieldStyle: CSSProperties = {
  width: "100%",
  minHeight: 44,
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: CARD_BG,
  color: "#fff",
  padding: "0.55rem 0.75rem",
  fontSize: "0.92rem",
};

function notifyBookingServicesSaved() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("oyon:booking-services-saved"));
  }
}

export default function AdminBookingServicesPage() {
  const { t, locale } = useLocale();
  const [items, setItems] = useState<BookingService[]>([]);
  const [role, setRole] = useState<AdminSession["role"]>("admin");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BookingService | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [data, me] = await Promise.all([
        apiFetch<{ services: BookingService[] }>("/api/booking-services"),
        apiFetch<{ user: AdminSession } | AdminSession>("/api/auth/me").catch(
          () => null,
        ),
      ]);
      setItems(data.services || []);
      if (me) {
        const user = "user" in me ? me.user : me;
        setRole(user.role);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.bookingServices.loadError"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () => items.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [items],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(sorted.length + 1));
    setModalOpen(true);
  }

  function openEdit(service: BookingService) {
    setEditing(service);
    setForm(fromService(service));
    setModalOpen(true);
  }

  async function persistOrder(next: BookingService[]) {
    setReordering(true);
    setMessage("");
    try {
      const data = await apiFetch<{ services: BookingService[] }>(
        "/api/booking-services",
        {
          method: "PATCH",
          body: JSON.stringify({
            order: next.map((s, index) => ({
              id: s.id,
              sortOrder: index + 1,
            })),
          }),
        },
      );
      setItems(data.services || next);
      setMessage(t("admin.bookingServices.reordered"));
      notifyBookingServicesSaved();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : t("admin.bookingServices.saveError"),
      );
    } finally {
      setReordering(false);
    }
  }

  function moveService(id: string, direction: -1 | 1) {
    const index = sorted.findIndex((s) => s.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;
    const next = sorted.slice();
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    setItems(next.map((s, i) => ({ ...s, sortOrder: i + 1 })));
    void persistOrder(next);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const localized = toLocalized(form);
    const payload = {
      name: localized.name,
      description: localized.description,
      icon: form.icon,
      sortOrder: Number(form.sortOrder) || 0,
      active: form.active,
    };
    try {
      if (editing) {
        const updated = await apiFetch<{ service: BookingService }>(
          "/api/booking-services",
          {
            method: "PUT",
            body: JSON.stringify({ id: editing.id, ...payload }),
          },
        );
        setItems((prev) =>
          prev
            .map((s) => (s.id === editing.id ? updated.service : s))
            .sort((a, b) => a.sortOrder - b.sortOrder),
        );
        setMessage(t("admin.bookingServices.updated"));
      } else {
        const created = await apiFetch<{ service: BookingService }>(
          "/api/booking-services",
          { method: "POST", body: JSON.stringify(payload) },
        );
        setItems((prev) =>
          [...prev, created.service].sort((a, b) => a.sortOrder - b.sortOrder),
        );
        setMessage(t("admin.bookingServices.created"));
      }
      setModalOpen(false);
      notifyBookingServicesSaved();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : t("admin.bookingServices.saveError"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(service: BookingService) {
    if (!hasPermission(role, "delete")) {
      setMessage(t("admin.bookingServices.deleteDenied"));
      return;
    }
    const label = pickLocalized(service.name, locale, service.key);
    if (!confirm(t("admin.bookingServices.deleteConfirm", { name: label }))) {
      return;
    }
    try {
      await apiFetch(`/api/booking-services?id=${encodeURIComponent(service.id)}`, {
        method: "DELETE",
      });
      await load();
      setMessage(t("admin.bookingServices.deleted"));
      notifyBookingServicesSaved();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : t("admin.bookingServices.deleteError"),
      );
    }
  }

  const addBtnStyle: CSSProperties = {
    height: 42,
    background: "transparent",
    color: GOLD,
    border: `1px solid rgba(212,175,55,0.75)`,
  };

  return (
    <div style={pageWrap} dir="rtl">
      <div className="mx-auto w-full" style={{ maxWidth: 980 }}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1
              className="m-0 text-[1.35rem] font-bold text-white"
              style={{ letterSpacing: "-0.02em" }}
            >
              {t("admin.bookingServices.title")}
            </h1>
            <p className="mt-1 mb-0 text-sm" style={{ color: MUTED }}>
              {t("admin.bookingServices.lead")}
            </p>
          </div>
          <button
            type="button"
            className="btn inline-flex items-center gap-2 px-4"
            style={addBtnStyle}
            onClick={openCreate}
          >
            <Plus size={16} />
            {t("admin.bookingServices.add")}
          </button>
        </div>

        {message ? (
          <p className="mb-4 rounded-xl border border-[rgba(94,196,154,0.35)] bg-[rgba(94,196,154,0.12)] px-3 py-2 text-sm text-[var(--success)]">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mb-4 rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p style={{ color: MUTED }}>{t("common.loading")}</p>
        ) : sorted.length === 0 ? (
          <p style={{ color: MUTED }}>{t("admin.bookingServices.empty")}</p>
        ) : (
          <div className="admin-bsvc-list">
            {sorted.map((service, index) => {
              const name = pickLocalized(service.name, locale, service.key);
              const description = pickLocalized(
                service.description,
                locale,
                "",
              );
              return (
                <article
                  key={service.id}
                  className="admin-bsvc-card"
                  style={{ background: CARD_BG, borderColor: BORDER }}
                >
                  <div className="admin-bsvc-card-main">
                    <span className="admin-bsvc-card-icon" aria-hidden>
                      <BookingServiceIcon icon={service.icon} size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="admin-bsvc-card-title">{name}</h2>
                        <span
                          className={cn(
                            "admin-bsvc-status",
                            service.active ? "is-active" : "is-inactive",
                          )}
                        >
                          {service.active
                            ? t("admin.bookingServices.active")
                            : t("admin.bookingServices.inactive")}
                        </span>
                      </div>
                      {description ? (
                        <p className="admin-bsvc-card-desc">{description}</p>
                      ) : null}
                      <p className="admin-bsvc-card-meta">
                        {t("admin.bookingServices.orderLabel")}: {service.sortOrder}
                      </p>
                    </div>
                  </div>
                  <div className="admin-bsvc-card-actions">
                    <button
                      type="button"
                      className="admin-bsvc-icon-action"
                      disabled={reordering || index === 0}
                      aria-label={t("admin.bookingServices.moveUp")}
                      onClick={() => moveService(service.id, -1)}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      className="admin-bsvc-icon-action"
                      disabled={reordering || index === sorted.length - 1}
                      aria-label={t("admin.bookingServices.moveDown")}
                      onClick={() => moveService(service.id, 1)}
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      className="admin-bsvc-icon-action"
                      aria-label={t("common.edit")}
                      onClick={() => openEdit(service)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="admin-bsvc-icon-action is-danger"
                      aria-label={t("common.delete")}
                      onClick={() => void onDelete(service)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <AdminModal
        open={modalOpen}
        title={
          editing
            ? t("admin.bookingServices.editTitle")
            : t("admin.bookingServices.addTitle")
        }
        onClose={() => setModalOpen(false)}
        wide
      >
        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="text-sm" style={{ color: MUTED }}>
                {t("admin.bookingServices.nameAr")}
              </span>
              <input
                style={fieldStyle}
                value={form.nameAr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nameAr: e.target.value }))
                }
                required
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm" style={{ color: MUTED }}>
                {t("admin.bookingServices.nameEn")}
              </span>
              <input
                style={fieldStyle}
                value={form.nameEn}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nameEn: e.target.value }))
                }
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm" style={{ color: MUTED }}>
                {t("admin.bookingServices.nameHe")}
              </span>
              <input
                style={fieldStyle}
                value={form.nameHe}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nameHe: e.target.value }))
                }
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="text-sm" style={{ color: MUTED }}>
                {t("admin.bookingServices.descriptionAr")}
              </span>
              <textarea
                style={{ ...fieldStyle, minHeight: 88, resize: "vertical" }}
                value={form.descriptionAr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descriptionAr: e.target.value }))
                }
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm" style={{ color: MUTED }}>
                {t("admin.bookingServices.descriptionEn")}
              </span>
              <textarea
                style={{ ...fieldStyle, minHeight: 88, resize: "vertical" }}
                value={form.descriptionEn}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descriptionEn: e.target.value }))
                }
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm" style={{ color: MUTED }}>
                {t("admin.bookingServices.descriptionHe")}
              </span>
              <textarea
                style={{ ...fieldStyle, minHeight: 88, resize: "vertical" }}
                value={form.descriptionHe}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descriptionHe: e.target.value }))
                }
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <label className="block space-y-1.5">
              <span className="text-sm" style={{ color: MUTED }}>
                {t("admin.bookingServices.icon")}
              </span>
              <BookingServiceIconPicker
                value={form.icon}
                disabled={saving}
                onChange={(icon) => setForm((f) => ({ ...f, icon }))}
              />
            </label>
            <div className="flex items-end gap-3">
              <span
                className="admin-bsvc-selected-icon"
                aria-label={t("admin.bookingServices.selectedIcon")}
              >
                <BookingServiceIcon icon={form.icon} size={24} />
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm" style={{ color: MUTED }}>
                {t("admin.bookingServices.order")}
              </span>
              <input
                style={fieldStyle}
                type="number"
                min={1}
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sortOrder: e.target.value }))
                }
              />
            </label>
            <label className="flex items-center gap-2 pt-7 text-sm text-white">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.checked }))
                }
              />
              {t("admin.bookingServices.active")}
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="btn btn-accent"
              disabled={saving}
              style={{ minWidth: 120 }}
            >
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
