import {
  isContentPreviewVisibilityMessage,
  previewWriteMethodBlocked,
} from "@/lib/content-editor-preview";

const FETCH_GUARD = "__oyonPreviewFetchGuard";

export function installPreviewFetchGuard(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const scoped = window as Window & {
    [FETCH_GUARD]?: boolean;
    fetch: typeof fetch;
  };
  if (scoped[FETCH_GUARD]) return () => undefined;
  const original = window.fetch.bind(window);
  scoped[FETCH_GUARD] = true;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const method =
      init?.method || (input instanceof Request ? input.method : "GET");
    if (previewWriteMethodBlocked(method)) {
      return Promise.resolve(
        new Response(JSON.stringify({ ok: false, preview: true }), {
          status: 204,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return original(input, init);
  };
  return () => {
    window.fetch = original;
    scoped[FETCH_GUARD] = false;
  };
}

function tuneImage(image: HTMLImageElement) {
  if (!image.getAttribute("loading")) image.loading = "lazy";
  if (!image.getAttribute("decoding")) image.decoding = "async";
}

function tuneVideo(video: HTMLVideoElement) {
  video.preload = "metadata";
  if (video.autoplay || video.hasAttribute("data-preview-autoplay")) {
    video.setAttribute("data-preview-autoplay", "1");
    video.autoplay = false;
  }
}

export function installPreviewMediaGuard(): () => void {
  if (typeof document === "undefined") return () => undefined;

  let parentVisible = true;
  const videoObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const video = entry.target as HTMLVideoElement;
        tuneVideo(video);
        const allow =
          parentVisible &&
          document.visibilityState === "visible" &&
          entry.isIntersecting;
        if (!allow) {
          video.pause();
          continue;
        }
        if (video.hasAttribute("data-preview-autoplay") || video.loop) {
          void video.play().catch(() => undefined);
        }
      }
    },
    { threshold: 0.2 },
  );

  function watch(node: ParentNode) {
    node.querySelectorAll("img").forEach((image) => tuneImage(image));
    node.querySelectorAll("video").forEach((video) => {
      tuneVideo(video);
      videoObserver.observe(video);
    });
  }

  watch(document);

  const mutations = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLImageElement) tuneImage(node);
        if (node instanceof HTMLVideoElement) {
          tuneVideo(node);
          videoObserver.observe(node);
        }
        if (node instanceof HTMLElement) watch(node);
      });
    }
  });
  mutations.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  function onVisibility() {
    if (document.visibilityState !== "visible" || !parentVisible) {
      document.querySelectorAll("video").forEach((video) => video.pause());
    }
  }

  function onMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin) return;
    if (!isContentPreviewVisibilityMessage(event.data)) return;
    parentVisible = event.data.visible;
    if (!parentVisible) {
      document.querySelectorAll("video").forEach((video) => video.pause());
      return;
    }
    document.querySelectorAll("video").forEach((video) => {
      videoObserver.unobserve(video);
      videoObserver.observe(video);
    });
  }

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("message", onMessage);

  return () => {
    mutations.disconnect();
    videoObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("message", onMessage);
    document.querySelectorAll("video").forEach((video) => video.pause());
  };
}
