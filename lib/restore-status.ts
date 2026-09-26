import type { RestoreCategory } from "@/lib/restore-apply";

export type { RestoreCategory };

export type RestorePreviewSection = {
  category: RestoreCategory;
  liveCount: number;
  backupCount: number;
};

export type RestorePreviewResult = {
  backup: {
    id: string;
    kind: "daily" | "manual";
    createdAt: string;
  };
  categories: RestoreCategory[];
  sections: RestorePreviewSection[];
};

export type RestoreExecuteClientResult = {
  ok: true;
  backup: {
    id: string;
    kind: "daily" | "manual";
    createdAt: string;
  };
  categories: RestoreCategory[];
  restoredAt: string;
};
