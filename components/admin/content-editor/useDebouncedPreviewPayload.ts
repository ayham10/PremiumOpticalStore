"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildEditorPreviewDocument,
  PREVIEW_UPDATE_MS,
  previewFlushKey,
  shouldFlushPreviewNow,
  type ContentPreviewKind,
  type ContentPreviewPayload,
} from "@/lib/content-editor-preview";
import type {
  CustomServicePage,
  ServicePagesLocale,
  ServicePagesLocaleBundle,
  ServicePagesSettings,
} from "@/lib/types";

type PreviewSource = {
  locale: ServicePagesLocale;
  kind: ContentPreviewKind;
  saved?: ServicePagesSettings;
  bundle: ServicePagesLocaleBundle;
  customPage?: CustomServicePage | null;
  products?: ContentPreviewPayload["products"];
  activeSectionId?: string | null;
};

function buildPayload(source: PreviewSource): ContentPreviewPayload {
  return {
    locale: source.locale,
    kind: source.kind,
    document: buildEditorPreviewDocument(
      source.saved,
      source.locale,
      source.bundle,
      source.customPage,
    ),
    customPage: source.customPage,
    products: source.products,
    activeSectionId: source.activeSectionId || null,
    previewPlaceholders: true,
  };
}

export function useDebouncedPreviewPayload(
  source: PreviewSource,
): ContentPreviewPayload {
  const flushKey = previewFlushKey(
    source.locale,
    source.kind,
    source.customPage?.id,
    source.activeSectionId,
  );
  const latest = useRef(source);
  latest.current = source;
  const prevKey = useRef<string | null>(null);
  const [payload, setPayload] = useState<ContentPreviewPayload>(() =>
    buildPayload(source),
  );

  useEffect(() => {
    const apply = () => setPayload(buildPayload(latest.current));
    const previous = prevKey.current;
    if (shouldFlushPreviewNow(previous, flushKey)) {
      prevKey.current = flushKey;
      apply();
      return;
    }
    const timer = window.setTimeout(apply, PREVIEW_UPDATE_MS);
    return () => window.clearTimeout(timer);
  }, [
    flushKey,
    source.saved,
    source.bundle,
    source.customPage,
    source.products,
  ]);

  return payload;
}
