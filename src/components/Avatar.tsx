import { useState } from 'react';
import { cn } from '@/lib/cn';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Oxblood-family tonal ramp for initials avatars. Deliberately a single chroma
 * (warm oxblood → clay → terracotta) so a stack of avatars stays personal-yet-
 * restrained — the brand's "one chroma in the room" rule (Phase 4 accent
 * restraint; the old version hashed across six different accent families, so a
 * card could show four unrelated hues at once — audit §1).
 */
const AVATAR_TONES: readonly (readonly [string, string])[] = [
  ['#5E211E', '#7A2A26'], // deep oxblood
  ['#7A2A26', '#9B3A33'], // oxblood
  ['#8E4A3C', '#A85A48'], // clay
  ['#A0453B', '#B85A44'], // terracotta
  ['#6E2E28', '#8E3A30'], // brick
];

/** Deterministically pick an oxblood-family tone from the name. */
function toneFor(name: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

/** Circular avatar: shows the image when available, else oxblood initials. */
export function Avatar({ name, src, size = 40, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  const [from, to] = toneFor(name);

  return (
    <span
      className={cn(
        'inline-grid place-items-center overflow-hidden rounded-full',
        'font-display font-semibold text-[var(--accent-fg)] ring-1 ring-white/20',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        backgroundImage: showImage ? undefined : `linear-gradient(135deg, ${from}, ${to})`,
      }}
      title={name}
    >
      {showImage ? (
        <img
          src={src}
          alt={name}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
