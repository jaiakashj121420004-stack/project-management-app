/**
 * A tiny floating-cards illustration for empty states. Pure SVG in the accent
 * colours (so it follows each project's accent and both themes), with a gentle
 * bob that stops under prefers-reduced-motion.
 */
export function EmptyArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} role="img" aria-label="" aria-hidden>
      <g className="animate-float-slow" style={{ ['--tilt' as string]: '-8deg', transformOrigin: '60px 70px' }}>
        <rect x="26" y="34" width="62" height="74" rx="10" fill="var(--glass-fill-strong)" stroke="var(--glass-border)" strokeWidth="2" />
        <rect x="36" y="48" width="30" height="6" rx="3" fill="var(--accent-from)" opacity="0.55" />
        <rect x="36" y="62" width="42" height="5" rx="2.5" fill="var(--fg-subtle, #9e9082)" opacity="0.35" />
        <rect x="36" y="74" width="36" height="5" rx="2.5" fill="var(--fg-subtle, #9e9082)" opacity="0.35" />
      </g>
      <g className="animate-float" style={{ ['--tilt' as string]: '7deg', transformOrigin: '104px 66px' }}>
        <rect x="74" y="22" width="62" height="78" rx="10" fill="var(--glass-fill-strong)" stroke="var(--accent-from)" strokeWidth="2.5" />
        <circle cx="92" cy="44" r="8" fill="var(--accent-from)" />
        <path d="M88.5 44.2l2.6 2.7 5-5.4" fill="none" stroke="var(--accent-fg)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="106" y="40" width="20" height="5" rx="2.5" fill="var(--fg-subtle, #9e9082)" opacity="0.4" />
        <rect x="84" y="62" width="42" height="5" rx="2.5" fill="var(--fg-subtle, #9e9082)" opacity="0.35" />
        <rect x="84" y="74" width="30" height="5" rx="2.5" fill="var(--fg-subtle, #9e9082)" opacity="0.35" />
      </g>
      <path d="M142 14l2.4 6.6L151 23l-6.6 2.4L142 32l-2.4-6.6L133 23l6.6-2.4z" fill="var(--accent-from)" className="animate-float" style={{ ['--tilt' as string]: '0deg' }} />
      <circle cx="18" cy="22" r="3.5" fill="var(--accent-to)" opacity="0.7" className="animate-float-slow" />
    </svg>
  );
}
