/**
 * A small, dependency-free confetti burst for "you did a thing" moments.
 * Uses the Web Animations API on throwaway elements, so there is no canvas, no
 * library and no cleanup to remember. Skipped entirely for reduced-motion users.
 */
const CONFETTI_COLORS: readonly string[] = [
  '#7A2A26',
  '#C24A40',
  '#D97706',
  '#CA8A04',
  '#4D7C0F',
  '#0F766E',
  '#0369A1',
  '#7C3AED',
];
const PIECES = 16;

export function celebrate(origin: { x: number; y: number }): void {
  if (typeof document === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  for (let i = 0; i < PIECES; i += 1) {
    const piece = document.createElement('span');
    const size = 5 + Math.random() * 6;
    piece.setAttribute('aria-hidden', 'true');
    Object.assign(piece.style, {
      position: 'fixed',
      left: `${origin.x}px`,
      top: `${origin.y}px`,
      width: `${size}px`,
      height: `${size * (Math.random() > 0.5 ? 1 : 0.5)}px`,
      borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      background: CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? '#7A2A26',
      pointerEvents: 'none',
      zIndex: '300',
    });
    document.body.appendChild(piece);

    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 70;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 30;
    const animation = piece.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
        {
          transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 540 - 270}deg) scale(1)`,
          opacity: 1,
          offset: 0.55,
        },
        { transform: `translate(${dx * 1.15}px, ${dy + 70}px) rotate(${Math.random() * 720}deg) scale(0.6)`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 350, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
    );
    animation.onfinish = () => piece.remove();
  }
}
