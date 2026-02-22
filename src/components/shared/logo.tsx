interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * nanobots.sh logo — a hexagonal nanobot with antenna nodes.
 * Uses brand colors: brand body, purple-accent accents.
 */
export function Logo({ size = 32, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer glow */}
      <defs>
        <radialGradient id="nb-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e87b35" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#e87b35" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#nb-glow)" />

      {/* Hexagon body */}
      <path
        d="M32 8L54 20V44L32 56L10 44V20L32 8Z"
        stroke="#e87b35"
        strokeWidth="2"
        fill="#e87b35"
        fillOpacity="0.08"
      />

      {/* Inner hexagon */}
      <path
        d="M32 18L44 25V39L32 46L20 39V25L32 18Z"
        stroke="#e87b35"
        strokeWidth="1.5"
        fill="#e87b35"
        fillOpacity="0.12"
      />

      {/* Core eye */}
      <circle cx="32" cy="32" r="5" fill="#e87b35" fillOpacity="0.9" />
      <circle cx="32" cy="32" r="2.5" fill="#0a0816" />

      {/* Antenna nodes — 6 vertices */}
      <circle cx="32" cy="8" r="2.5" fill="#7c5bf0" />
      <circle cx="54" cy="20" r="2.5" fill="#7c5bf0" />
      <circle cx="54" cy="44" r="2.5" fill="#7c5bf0" />
      <circle cx="32" cy="56" r="2.5" fill="#7c5bf0" />
      <circle cx="10" cy="44" r="2.5" fill="#7c5bf0" />
      <circle cx="10" cy="20" r="2.5" fill="#7c5bf0" />

      {/* Connection lines from core to vertices */}
      <line x1="32" y1="27" x2="32" y2="18" stroke="#e87b35" strokeWidth="0.75" strokeOpacity="0.4" />
      <line x1="36" y1="29" x2="44" y2="25" stroke="#e87b35" strokeWidth="0.75" strokeOpacity="0.4" />
      <line x1="36" y1="35" x2="44" y2="39" stroke="#e87b35" strokeWidth="0.75" strokeOpacity="0.4" />
      <line x1="32" y1="37" x2="32" y2="46" stroke="#e87b35" strokeWidth="0.75" strokeOpacity="0.4" />
      <line x1="28" y1="35" x2="20" y2="39" stroke="#e87b35" strokeWidth="0.75" strokeOpacity="0.4" />
      <line x1="28" y1="29" x2="20" y2="25" stroke="#e87b35" strokeWidth="0.75" strokeOpacity="0.4" />
    </svg>
  );
}
