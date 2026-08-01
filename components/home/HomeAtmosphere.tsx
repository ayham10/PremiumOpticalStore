"use client";

import { useEffect, useRef } from "react";

/**
 * Subtle fullscreen cinematic backdrop for the homepage hub.
 * Fixed behind content; never intercepts pointer events.
 */
export default function HomeAtmosphere() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Keep a still poster when motion is reduced
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let cancelled = false;
    let idleId: number | undefined;
    let timerId: number | undefined;

    const start = () => {
      if (cancelled || video.getAttribute("src")) return;
      video.src = "/videos/hero.mp4";
      video.load();
      void video.play().catch(() => {
        /* autoplay may be blocked; static poster still provides atmosphere */
      });
    };

    const ric = (
      window as Window & {
        requestIdleCallback?: (
          cb: IdleRequestCallback,
          opts?: IdleRequestOptions
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;

    if (typeof ric === "function") {
      idleId = ric(start, { timeout: 1200 });
    } else {
      timerId = window.setTimeout(start, 400);
    }

    return () => {
      cancelled = true;
      if (idleId != null) {
        (
          window as Window & { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback?.(idleId);
      }
      if (timerId != null) window.clearTimeout(timerId);
    };
  }, []);

  return (
    <div className="home-atmosphere" aria-hidden>
      <video
        ref={videoRef}
        className="home-atmosphere-video"
        muted
        loop
        playsInline
        preload="none"
        poster="https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&w=1600&q=70"
      />
      <div className="home-atmosphere-overlay" />
    </div>
  );
}
