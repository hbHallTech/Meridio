/**
 * Meridio "Meridian Pulse" logo — inline SVG variants.
 * Concept: flowing meridian curve with a pulsing teal node at center.
 */

interface LogoProps {
  className?: string;
  /** Height in pixels (width scales proportionally) */
  height?: number;
  /** Show text or icon-only */
  variant?: "full" | "icon";
  /** Text color override */
  textColor?: string;
}

/** Full horizontal logo: icon + "Meridio" text */
export function MeridioLogo({
  className,
  height = 32,
  variant = "full",
  textColor = "#ffffff",
}: LogoProps) {
  if (variant === "icon") {
    return <MeridioIcon className={className} size={height} />;
  }

  const w = Math.round(height * (240 / 32));

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 32"
      width={w}
      height={height}
      fill="none"
      className={className}
      aria-label="Meridio"
      role="img"
    >
      {/* Meridian curve */}
      <path
        d="M3 20C7 20 10 8 18 8C26 8 26 26 34 26C39 26 41 18 41 18"
        stroke="url(#mlogo-g)"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Pulse glow */}
      <circle cx="18" cy="16" r="5" fill="#00d3a7" opacity="0.15" />
      {/* Pulse circle */}
      <circle cx="18" cy="16" r="3" fill="#00d3a7" />
      {/* Spark */}
      <circle cx="18" cy="16" r="1" fill="#fff" />
      {/* Text */}
      <text
        x="52"
        y="23"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="21"
        fontWeight="700"
        fill={textColor}
        letterSpacing="-0.3"
      >
        Meridio
      </text>
      <defs>
        <linearGradient
          id="mlogo-g"
          x1="3"
          y1="16"
          x2="41"
          y2="16"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#2c90ff" />
          <stop offset="1" stopColor="#00d3a7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Icon-only variant (for favicon area, collapsed sidebar, etc.) */
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
      viewBox="0 0 36 36"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-label="Meridio"
      role="img"
    >
      {/* Meridian curve */}
      <path
        d="M3 22C7 22 10 10 18 10C26 10 26 28 34 28C37 28 38 22 38 22"
        stroke="url(#micon-g)"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Pulse glow */}
      <circle cx="18" cy="18" r="6" fill="#00d3a7" opacity="0.14" />
      <circle cx="18" cy="18" r="4" fill="#00d3a7" opacity="0.25" />
      {/* Pulse circle */}
      <circle cx="18" cy="18" r="2.8" fill="#00d3a7" />
      {/* Spark */}
      <circle cx="18" cy="18" r="1" fill="#fff" />
      <defs>
        <linearGradient
          id="micon-g"
          x1="3"
          y1="18"
          x2="38"
          y2="18"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#2c90ff" />
          <stop offset="1" stopColor="#00d3a7" />
        </linearGradient>
      </defs>
    </svg>
  );
}
