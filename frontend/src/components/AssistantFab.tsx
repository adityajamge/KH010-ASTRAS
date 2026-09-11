/**
 * Floating assistant button: the animated water-drop AI logo.
 *
 * Converted from `frontend/animations/Water Drop AI Logo Animation` into a
 * self-contained React component (pure SVG + CSS keyframes, no JS needed).
 * Rendered bottom-right on every dashboard via DashboardShell.
 *
 * Future scope: clicking opens the assistant chat window. No LLM key yet,
 * so `onOpen` defaults to a no-op.
 */
export function WaterDropLogo({ size = 72 }: { size?: number }) {
  return (
    <svg
      viewBox="-12 -4 224 224"
      width={size}
      height={size}
        style={{ overflow: "visible", display: "block" }}
        role="img"
        aria-label="Animated water drop AI logo"
      >
        <defs>
          <clipPath id="aiDropClip">
            <path d="M100 26 C100 26 152 82 152 116 A52 52 0 1 1 48 116 C48 82 100 26 100 26 Z" />
          </clipPath>
          <linearGradient id="aiWaveA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.74 0.12 230)" />
            <stop offset="100%" stopColor="oklch(0.56 0.13 250)" />
          </linearGradient>
          <linearGradient id="aiWaveB" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.8 0.09 268)" />
            <stop offset="100%" stopColor="oklch(0.68 0.11 258)" />
          </linearGradient>
        </defs>

        <g>
          <circle cx="100" cy="112" r="78" fill="none" stroke="oklch(0.62 0.13 238)" strokeWidth="5" style={{ transformOrigin: "100px 112px", animation: "rippleOut 4.2s cubic-bezier(0.22, 0.61, 0.36, 1) infinite" }} />
          <circle cx="100" cy="112" r="78" fill="none" stroke="oklch(0.62 0.13 238)" strokeWidth="5" style={{ transformOrigin: "100px 112px", animation: "rippleOut 4.2s cubic-bezier(0.22, 0.61, 0.36, 1) infinite 1.4s" }} />
          <circle cx="100" cy="112" r="78" fill="none" stroke="oklch(0.62 0.13 238)" strokeWidth="5" style={{ transformOrigin: "100px 112px", animation: "rippleOut 4.2s cubic-bezier(0.22, 0.61, 0.36, 1) infinite 2.8s" }} />
        </g>

        <circle cx="100" cy="112" r="72" fill="none" stroke="oklch(0.6 0.12 240)" strokeWidth="5" strokeLinecap="round" strokeDasharray="5 20" style={{ transformOrigin: "100px 112px", animation: "ringSpin 16s linear infinite" }} />
        <circle cx="100" cy="112" r="64" fill="none" stroke="oklch(0.55 0.14 272)" strokeWidth="6" strokeLinecap="round" strokeDasharray="70 332" style={{ transformOrigin: "100px 112px", animation: "ringSpinBack 9s linear infinite" }} />
        <g style={{ transformOrigin: "100px 112px", animation: "ringSpin 6s linear infinite" }}>
          <circle cx="100" cy="40" r="6.5" fill="oklch(0.5 0.14 250)" />
        </g>
        <g style={{ transformOrigin: "100px 112px", animation: "ringSpinBack 9s linear infinite" }}>
          <circle cx="164" cy="112" r="5" fill="oklch(0.62 0.13 285)" />
        </g>

        <path d="M100 26 C100 26 152 82 152 116 A52 52 0 1 1 48 116 C48 82 100 26 100 26 Z" fill="oklch(0.975 0.01 238)" />

        <g clipPath="url(#aiDropClip)">
          <g style={{ animation: "dropWaveRise 7s ease-in-out infinite" }}>
            <path d="M-60 100 C-40 94 -20 94 0 100 S40 106 80 100 S120 94 160 100 S200 106 240 100 S280 94 320 100 V200 H-60 Z" fill="url(#aiWaveB)" opacity="0.45" style={{ animation: "dropWaveDriftB 11s linear infinite" }} />
          </g>
          <g style={{ animation: "dropWaveRise 5.5s ease-in-out infinite 0.7s" }}>
            <path d="M-60 106 C-40 100 -20 100 0 106 S40 112 80 106 S120 100 160 106 S200 112 240 106 S280 100 320 106 V200 H-60 Z" fill="url(#aiWaveA)" style={{ animation: "dropWaveDrift 8s linear infinite" }} />
          </g>
          <path d="M74 52 C64 66 60 78 61 90" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" style={{ animation: "sheen 5.4s ease-in-out infinite" }} />
        </g>

        <g clipPath="url(#aiDropClip)">
          <g fill="none" stroke="oklch(0.5 0.12 246)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="6 6" opacity="0.9">
            <line x1="100" y1="66" x2="74" y2="102" style={{ animation: "linkFlow 2.4s linear infinite" }} />
            <line x1="100" y1="66" x2="126" y2="102" style={{ animation: "linkFlow 2.4s linear infinite 0.3s" }} />
            <line x1="74" y1="102" x2="126" y2="102" style={{ animation: "linkFlow 2.4s linear infinite 0.6s" }} />
            <line x1="74" y1="102" x2="100" y2="138" style={{ animation: "linkFlow 2.4s linear infinite 0.9s" }} />
            <line x1="126" y1="102" x2="100" y2="138" style={{ animation: "linkFlow 2.4s linear infinite 1.2s" }} />
          </g>
          <g fill="#ffffff" stroke="oklch(0.46 0.12 246)" strokeWidth="1.4">
            <circle cx="100" cy="66" r="5.5" style={{ transformOrigin: "100px 66px", animation: "nodePulse 3.2s ease-in-out infinite" }} />
            <circle cx="74" cy="102" r="5.5" style={{ transformOrigin: "74px 102px", animation: "nodePulse 3.2s ease-in-out infinite 0.8s" }} />
            <circle cx="126" cy="102" r="5.5" style={{ transformOrigin: "126px 102px", animation: "nodePulse 3.2s ease-in-out infinite 1.6s" }} />
            <circle cx="100" cy="138" r="5.5" style={{ transformOrigin: "100px 138px", animation: "nodePulse 3.2s ease-in-out infinite 2.4s" }} />
          </g>
        </g>

        <path d="M100 26 C100 26 152 82 152 116 A52 52 0 1 1 48 116 C48 82 100 26 100 26 Z" fill="none" stroke="oklch(0.45 0.11 244)" strokeWidth="3" strokeLinejoin="round" />
      </svg>
  );
}

export function AssistantFab({ onOpen }: { onOpen?: () => void }) {
  return (
    <button
      type="button"
      className="assistant-fab"
      aria-label="Open assistant chat"
      title="Open assistant chat"
      onClick={onOpen}
    >
      <WaterDropLogo size={72} />
    </button>
  );
}
