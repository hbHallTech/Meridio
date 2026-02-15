/**
 * Meridio official logo — inline SVG variants.
 * Design: ribbon curve (blue→teal→violet) + spark node + "Meridio" wordmark.
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
}

/**
 * Full horizontal logo: mark + "Meridio" wordmark.
 * viewBox is 2400×900 scaled to requested height.
 */
export function MeridioLogo({
  className,
  height = 36,
  variant = "full",
  textColor = "#ffffff",
}: LogoProps) {
  if (variant === "icon") {
    return <MeridioIcon className={className} size={height} />;
  }

  // Original aspect ratio: 2400/900 ≈ 2.67, but the visual content
  // sits roughly in a 2000×600 box so we use a tighter viewBox.
  const w = Math.round(height * (380 / 100));

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="60 140 2200 620"
      width={w}
      height={height}
      fill="none"
      className={className}
      aria-label="Meridio"
      role="img"
    >
      <defs>
        <linearGradient id="mlg-ribbon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2c90ff" />
          <stop offset="0.55" stopColor="#00d3a7" />
          <stop offset="1" stopColor="#7b61ff" />
        </linearGradient>
        <radialGradient id="mlg-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0" stopColor="#00d3a7" stopOpacity="0.55" />
          <stop offset="1" stopColor="#00d3a7" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Mark */}
      <g transform="translate(150,185)">
        {/* Glow */}
        <circle cx="310" cy="80" r="120" fill="url(#mlg-glow)" />
        {/* Ribbon curve */}
        <path
          d="M 40 360 C 95 170, 185 120, 275 250 C 325 325, 360 385, 430 385 C 520 385, 560 290, 590 210 C 620 130, 695 85, 770 115"
          fill="none"
          stroke="url(#mlg-ribbon)"
          strokeWidth="68"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Spark node: dark circle */}
        <circle cx="770" cy="115" r="58" fill="#0b2540" opacity="0.90" stroke="#00d3a7" strokeWidth="8" />
        {/* Spark diamond */}
        <path
          d="M 770 76 L 784 102 L 812 115 L 784 128 L 770 154 L 756 128 L 728 115 L 756 102 Z"
          fill="#eef6ff"
        />
        {/* Outer ring */}
        <circle cx="770" cy="115" r="84" fill="none" stroke="#2c90ff" strokeWidth="6" opacity="0.35" />
      </g>

      {/* Wordmark */}
      <g transform="translate(1060,310)">
        <text
          x="0"
          y="0"
          fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
          fontSize="220"
          fontWeight="800"
          fill={textColor}
          letterSpacing="-2"
        >
          Meridio
        </text>
      </g>
    </svg>
  );
}

/**
 * Icon-only variant: just the ribbon mark + spark node.
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
      viewBox="80 120 880 500"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-label="Meridio"
      role="img"
    >
      <defs>
        <linearGradient id="mic-ribbon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2c90ff" />
          <stop offset="0.55" stopColor="#00d3a7" />
          <stop offset="1" stopColor="#7b61ff" />
        </linearGradient>
        <radialGradient id="mic-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0" stopColor="#00d3a7" stopOpacity="0.55" />
          <stop offset="1" stopColor="#00d3a7" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g transform="translate(150,185)">
        <circle cx="310" cy="80" r="120" fill="url(#mic-glow)" />
        <path
          d="M 40 360 C 95 170, 185 120, 275 250 C 325 325, 360 385, 430 385 C 520 385, 560 290, 590 210 C 620 130, 695 85, 770 115"
          fill="none"
          stroke="url(#mic-ribbon)"
          strokeWidth="68"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="770" cy="115" r="58" fill="#0b2540" opacity="0.90" stroke="#00d3a7" strokeWidth="8" />
        <path
          d="M 770 76 L 784 102 L 812 115 L 784 128 L 770 154 L 756 128 L 728 115 L 756 102 Z"
          fill="#eef6ff"
        />
        <circle cx="770" cy="115" r="84" fill="none" stroke="#2c90ff" strokeWidth="6" opacity="0.35" />
      </g>
    </svg>
  );
}
