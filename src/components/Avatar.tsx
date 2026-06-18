import { useState } from 'react';
import { cn } from '@/lib/cn';
import { accentVars, ACCENT_NAMES, type AccentName } from '@/lib/accents';

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

/** Deterministically pick an accent from the name so avatars feel personal. */
function accentFor(name: string): AccentName {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return ACCENT_NAMES[hash % ACCENT_NAMES.length]!;
}

/** Circular avatar: shows the image when available, else gradient initials. */
export function Avatar({ name, src, size = 40, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <span
      className={cn(
        'inline-grid place-items-center overflow-hidden rounded-full',
        'font-display font-semibold text-white ring-1 ring-white/20',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        ...accentVars(accentFor(name)),
        backgroundImage: showImage
          ? undefined
          : 'linear-gradient(135deg, var(--accent-from), var(--accent-to))',
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
