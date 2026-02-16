/**
 * Meridio official logo — inline SVG variants.
 * Design: oscilloscope zigzag wave (blue→teal→violet) + star head + "Meridıo" wordmark.
 * Based on the official 2400×900 master SVG.
 */

interface LogoProps {
  className?: string;
  /** Height in pixels (width scales proportionally) */
  height?: number;
  /** Show text or icon-only */
  variant?: "full" | "icon";
  /** Text color override (default: white for dark bg) */
  textColor?: string;
  /** Show tagline under wordmark */
  showTagline?: boolean;
}

/**
 * Full horizontal logo: mark + "Meridıo" wordmark.
 * viewBox is 2400×900 scaled to requested height.
 */
export function MeridioLogo({
  className,
  height = 36,
  variant = "full",
  textColor = "#ffffff",
  showTagline = false,
}: LogoProps) {
  if (variant === "icon") {
    return <MeridioIcon className={className} size={height} />;
  }

  const w = Math.round(height * (2400 / 900));

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 2400 900"
      width={w}
      height={height}
      fill="none"
      className={className}
      aria-label="Meridio"
      role="img"
    >
      <defs>
        <linearGradient id="mlg-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2c90ff" />
          <stop offset="0.55" stopColor="#00d3a7" />
          <stop offset="1" stopColor="#7b61ff" />
        </linearGradient>
        <radialGradient id="mlg-pulse" cx="50%" cy="50%" r="60%">
          <stop offset="0" stopColor="#00d3a7" stopOpacity="0.65" />
          <stop offset="1" stopColor="#00d3a7" stopOpacity="0" />
        </radialGradient>
        <filter id="mlg-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur" />
          <feOffset dx="0" dy="10" result="off" />
          <feColorMatrix
            in="off"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.28 0"
            result="shadow"
          />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="mlg-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Mark */}
      <g transform="translate(150,195)" filter="url(#mlg-shadow)">
        {/* Radial pulse behind star */}
        <circle cx="820" cy="120" r="160" fill="url(#mlg-pulse)" />
        {/* Main oscilloscope stroke */}
        <path
          d="M 60 420 L 220 160 L 380 420 L 540 160 L 700 420 L 860 120"
          fill="none"
          stroke="url(#mlg-wave)"
          strokeWidth="78"
          strokeLinecap="round"
          strokeLinejoin="miter"
          strokeMiterlimit="4"
        />
        {/* Visible trail */}
        <path
          d="M 700 420 L 860 120"
          fill="none"
          stroke="#eef6ff"
          strokeOpacity="0.30"
          strokeWidth="34"
          strokeLinecap="round"
          filter="url(#mlg-glow)"
        />
        {/* Star head */}
        <path
          d="M 860 70 L 878 104 L 916 120 L 878 136 L 860 170 L 842 136 L 804 120 L 842 104 Z"
          fill="#eef6ff"
          filter="url(#mlg-glow)"
        />
      </g>

      {/* Wordmark */}
      <g transform="translate(1120,320)">
        {/* "Meridıo" with dotless i */}
        <text
          x="0"
          y="0"
          fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
          fontSize="220"
          fontWeight="800"
          fill={textColor}
          letterSpacing="-2"
        >
          Merid&#305;o
        </text>
        {/* Star as dot on the ı */}
        <g transform="translate(551.5,-223.5) scale(0.75)">
          <path
            d="M 120 40 L 134 66 L 164 78 L 134 90 L 120 116 L 106 90 L 76 78 L 106 66 Z"
            fill="#00d3a7"
            filter="url(#mlg-glow)"
          />
        </g>
        {/* Tagline */}
        {showTagline && (
          <text
            x="6"
            y="150"
            fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
            fontSize="64"
            fontWeight="500"
            fill={textColor === "#ffffff" ? "rgba(255,255,255,0.6)" : "#334155"}
            opacity="0.92"
          >
            Congés &amp; notes de frais
          </text>
        )}
      </g>
    </svg>
  );
}

/**
 * Icon-only variant: just the oscilloscope mark + star head.
 * For favicon, collapsed sidebar, app icon.
 */
export function MeridioIcon({
  className,
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 50 1100 600"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-label="Meridio"
      role="img"
    >
      <defs>
        <linearGradient id="mic-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2c90ff" />
          <stop offset="0.55" stopColor="#00d3a7" />
          <stop offset="1" stopColor="#7b61ff" />
        </linearGradient>
        <radialGradient id="mic-pulse" cx="50%" cy="50%" r="60%">
          <stop offset="0" stopColor="#00d3a7" stopOpacity="0.65" />
          <stop offset="1" stopColor="#00d3a7" stopOpacity="0" />
        </radialGradient>
        <filter id="mic-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g transform="translate(150,195)">
        <circle cx="820" cy="120" r="160" fill="url(#mic-pulse)" />
        <path
          d="M 60 420 L 220 160 L 380 420 L 540 160 L 700 420 L 860 120"
          fill="none"
          stroke="url(#mic-wave)"
          strokeWidth="78"
          strokeLinecap="round"
          strokeLinejoin="miter"
          strokeMiterlimit="4"
        />
        <path
          d="M 700 420 L 860 120"
          fill="none"
          stroke="#eef6ff"
          strokeOpacity="0.30"
          strokeWidth="34"
          strokeLinecap="round"
          filter="url(#mic-glow)"
        />
        <path
          d="M 860 70 L 878 104 L 916 120 L 878 136 L 860 170 L 842 136 L 804 120 L 842 104 Z"
          fill="#eef6ff"
          filter="url(#mic-glow)"
        />
      </g>
    </svg>
  );
}
