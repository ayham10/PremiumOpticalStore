"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const VIDEO_1 = {
  src: "/videos/eye-exam.mp4",
  poster: "/images/eye-exam-poster.jpg",
};

const VIDEO_2 = {
  src: "/videos/eye-exam-2.mp4",
  poster: "/images/eye-exam-poster-2.jpg",
};

export default function EyeExamHeroVideo({ alt }: { alt: string }) {
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [active, setActive] = useState<1 | 2>(1);
  const [video2Ready, setVideo2Ready] = useState(false);
  const [video2Failed, setVideo2Failed] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const v1 = video1Ref.current;
    if (!v1) return;
    v1.muted = true;
    v1.loop = false;
    const play = v1.play();
    if (play && typeof play.catch === "function") {
      play.catch(() => undefined);
    }
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion || video2Failed) return;
    const v2 = video2Ref.current;
    if (!v2) return;

    const onReady = () => setVideo2Ready(true);
    const onError = () => setVideo2Failed(true);

    if (v2.readyState >= 2) setVideo2Ready(true);
    v2.addEventListener("loadeddata", onReady);
    v2.addEventListener("error", onError);
    return () => {
      v2.removeEventListener("loadeddata", onReady);
      v2.removeEventListener("error", onError);
    };
  }, [reducedMotion, video2Failed]);

  function crossfadeToSecond() {
    if (fading || active === 2) return;

    if (video2Failed || !video2Ready) {
      const v1 = video1Ref.current;
      if (v1) {
        v1.loop = true;
        v1.currentTime = 0;
        void v1.play().catch(() => undefined);
      }
      return;
    }

    setFading(true);
    const v2 = video2Ref.current;
    if (v2) {
      v2.muted = true;
      v2.loop = true;
      v2.currentTime = 0;
      void v2.play().catch(() => undefined);
    }

    window.setTimeout(() => {
      setActive(2);
      setFading(false);
      const v1 = video1Ref.current;
      if (v1) v1.pause();
    }, 420);
  }

  if (reducedMotion) {
    return (
      <div className="eye-exam-video-frame">
        <Image
          src={VIDEO_1.poster}
          alt={alt}
          fill
          priority
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 960px"
        />
        <div className="eye-exam-video-veil" aria-hidden />
      </div>
    );
  }

  return (
    <div className="eye-exam-video-frame">
      <video
        ref={video1Ref}
        className={`eye-exam-video eye-exam-video-layer ${
          active === 1 && !fading ? "is-visible" : fading && active === 1 ? "is-fading-out" : "is-hidden"
        }`}
        autoPlay
        muted
        playsInline
        preload="metadata"
        poster={VIDEO_1.poster}
        aria-label={alt}
        onEnded={crossfadeToSecond}
      >
        <source src={VIDEO_1.src} type="video/mp4" />
      </video>

      <video
        ref={video2Ref}
        className={`eye-exam-video eye-exam-video-layer ${
          active === 2 || fading ? "is-visible" : "is-hidden"
        }`}
        muted
        playsInline
        loop
        preload="metadata"
        poster={VIDEO_2.poster}
        aria-hidden={active !== 2}
        tabIndex={-1}
      >
        <source src={VIDEO_2.src} type="video/mp4" />
      </video>

      <div className="eye-exam-video-veil" aria-hidden />
    </div>
  );
}
