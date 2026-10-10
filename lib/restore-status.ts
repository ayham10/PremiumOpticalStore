import type { RestoreCategory } from "@/lib/restore-apply";
import type {
  MembershipPolicy,
  RestoreChangeItem,
  RestoreLostMembership,
  RestoreMode,
  RestorePreviewDetails,
} from "@/lib/restore-plan";

export type {
  MembershipPolicy,
  RestoreCategory,
  RestoreChangeItem,
  RestoreLostMembership,
  RestoreMode,
  RestorePreviewDetails,
};

/** Client-safe: Vercel inlines NEXT_PUBLIC_VERCEL_ENV at build time. */
export function isLiveRestoreUiAllowed(): boolean {
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
}

export type RestorePreviewSection = {
  category: string;
  liveCount: number;
  backupCount: number;
};

export type RestorePreviewMedia = {
  referenced: number;
  alreadyPresent: number;
  willRestore: number;
  missing: number;
};

export type RestorePreviewResult = {
  backup: {
    id: string;
    kind: "daily" | "manual" | "pre-restore";
    createdAt: string;
  };
  mode: RestoreMode;
  categories: RestoreCategory[];
  sections: RestorePreviewSection[];
  details: RestorePreviewDetails;
  media: RestorePreviewMedia;
};

export type RestoreExecuteClientResult = {
  ok: true;
  backup: RestorePreviewResult["backup"];
  mode: RestoreMode;
  categories: RestoreCategory[];
  restoredAt: string;
  media: {
    complete: true;
    referenced: number;
    alreadyPresent: number;
    restored: number;
    missing: number;
    failed: number;
  };
};

export type RestoreSnapshotItems = {
  pages: Array<{ id: string; name: string; slug: string; status: string }>;
  products: Array<{ id: string; name: string; sku: string; category: string }>;
  categories: Array<{
    id: string;
    name: string;
    names: { ar: string; he: string; en: string };
    showInMainCatalog: boolean;
    system: boolean;
    productCount: number;
  }>;
};
