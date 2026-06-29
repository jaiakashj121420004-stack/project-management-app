import { useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import type { Camera } from './constants';
import type { CanvasElement } from './elements';
import type { RemotePeer } from './collab/awareness';

interface RemotePresenceLayerProps {
  peers: RemotePeer[];
  camera: Camera;
  /** Scene elements, to locate each peer's selection for the halo. */
  elements: CanvasElement[];
}

/** Honour the OS "reduce motion" setting for the cursor glide animation. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * The remote-presence overlay (P3.7). Konva owns the local Transformer; remote
 * participants are drawn here as HTML so they layer cleanly over the stage and
 * reuse the app's Avatar styling. For each peer we render:
 *   - a coloured selection halo around every element they have selected, and
 *   - a live cursor (pointer + name pill + avatar) at their world position.
 * World→screen uses the same camera transform as the text/media overlays, so
 * cursors and halos track pan/zoom exactly. The whole layer is non-interactive.
 *
 * Cursors glide between positions with a short CSS transition, disabled under
 * `prefers-reduced-motion` so they snap instead.
 */
export function RemotePresenceLayer({ peers, camera, elements }: RemotePresenceLayerProps) {
  const reducedMotion = usePrefersReducedMotion();
  const scale = camera.scale;
  if (peers.length === 0) return null;

  const elementById = new Map(elements.map((el) => [el.id, el]));

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {/* Selection halos (drawn under cursors). */}
      {peers.flatMap((peer) =>
        peer.selection.flatMap((id) => {
          const el = elementById.get(id);
          if (!el || el.visible === false) return [];
          const left = camera.x + el.x * scale;
          const top = camera.y + el.y * scale;
          return [
            <div
              key={`${peer.clientId}:${id}`}
              aria-hidden
              className="absolute rounded-[10px]"
              style={{
                left: 0,
                top: 0,
                width: el.width,
                height: el.height,
                transformOrigin: '0 0',
                transform: `translate(${left}px, ${top}px) rotate(${el.rotation}deg) scale(${scale})`,
                border: `2px solid ${peer.user.color}`,
                boxShadow: `0 0 0 2px ${peer.user.color}33`,
              }}
            />,
          ];
        }),
      )}

      {/* Live cursors. */}
      {peers.map((peer) => {
        if (!peer.cursor) return null;
        const left = camera.x + peer.cursor.x * scale;
        const top = camera.y + peer.cursor.y * scale;
        return (
          <div
            key={peer.clientId}
            aria-hidden
            className="absolute left-0 top-0"
            style={{
              transform: `translate(${left}px, ${top}px)`,
              transition: reducedMotion ? undefined : 'transform 80ms linear',
              willChange: 'transform',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" className="drop-shadow">
              <path
                d="M2 2 L2 14 L6 10.5 L8.5 16 L11 15 L8.5 9.5 L14 9.5 Z"
                fill={peer.user.color}
                stroke="white"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="absolute left-4 top-3 inline-flex items-center gap-1 whitespace-nowrap rounded-full py-0.5 pl-0.5 pr-2 text-[11px] font-semibold text-white shadow-md"
              style={{ backgroundColor: peer.user.color }}
            >
              <Avatar name={peer.user.name} src={peer.user.avatarUrl} size={16} />
              {peer.user.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
