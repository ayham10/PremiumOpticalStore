/** Original SVG art for lens size modals (no external asset). */
export default function LensSizeModalIllustration() {
  return (
    <svg
      className="admin-lens-size-art-svg"
      viewBox="0 0 360 280"
      role="img"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="lensGlow" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="rgba(232,197,106,0.35)" />
          <stop offset="100%" stopColor="rgba(232,197,106,0)" />
        </radialGradient>
        <linearGradient id="lensRim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f3dc8a" />
          <stop offset="45%" stopColor="#c99d3d" />
          <stop offset="100%" stopColor="#8f6824" />
        </linearGradient>
        <linearGradient id="lensGlass" x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor="rgba(180,210,230,0.22)" />
          <stop offset="100%" stopColor="rgba(40,60,80,0.08)" />
        </linearGradient>
        <filter id="lensSoftGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <ellipse cx="180" cy="118" rx="150" ry="95" fill="url(#lensGlow)" />
      <g filter="url(#lensSoftGlow)" opacity="0.95">
        <ellipse
          cx="148"
          cy="112"
          rx="78"
          ry="78"
          fill="url(#lensGlass)"
          stroke="url(#lensRim)"
          strokeWidth="5"
        />
        <ellipse
          cx="212"
          cy="128"
          rx="82"
          ry="82"
          fill="url(#lensGlass)"
          stroke="url(#lensRim)"
          strokeWidth="5"
        />
        <path
          d="M118 92 Q148 68 178 92"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M182 108 Q212 84 242 108"
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <ellipse
        cx="200"
        cy="200"
        rx="120"
        ry="18"
        fill="rgba(0,0,0,0.45)"
        opacity="0.6"
      />
    </svg>
  );
}
