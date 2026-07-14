import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CreditCard, LogOut, MessageSquarePlus, User, type LucideIcon } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/hooks/useAuth';
import { springs } from '@/lib/motion';
import { cn } from '@/lib/cn';
import { useProfile } from './useProfile';
import { resolveAvatarUrl, resolveDisplayName } from './identity';
import { signOut } from './api';
import { PlanBadge } from '@/features/billing/PlanBadge';
import { FeedbackModal } from '@/features/feedback';

function MenuItem({
  icon: Icon,
  onClick,
  children,
  tone = 'default',
}: {
  icon: LucideIcon;
  onClick: () => void;
  children: ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm font-medium',
        'transition-colors hover:bg-[var(--glass-fill)]',
        tone === 'danger' ? 'text-danger' : 'text-fg-muted hover:text-fg',
      )}
    >
      <Icon size={17} className="shrink-0" />
      {children}
    </button>
  );
}

/** Avatar button in the top bar that opens a menu with Profile + Sign out. */
export function UserMenu() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const name = resolveDisplayName(profile, user);
  const avatarUrl = resolveAvatarUrl(profile, user);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function onSignOut() {
    setOpen(false);
    await signOut();
    void navigate('/login', { replace: true });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="grid place-items-center rounded-full ring-offset-2 transition-transform duration-200 ease-spring hover:-translate-y-0.5"
      >
        <Avatar name={name} src={avatarUrl} size={38} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={springs.snappy}
            className="glass-menu absolute right-0 top-12 z-50 w-60 origin-top-right rounded-2xl p-2"
          >
            <div className="flex items-center gap-3 px-3 py-2.5">
              <Avatar name={name} src={avatarUrl} size={40} />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-fg">
                  {name}
                  {profile && <PlanBadge plan={profile.plan} />}
                </p>
                {user?.email && <p className="truncate text-xs text-fg-subtle">{user.email}</p>}
              </div>
            </div>
            <div className="my-1 h-px bg-[var(--hairline)]" />
            <MenuItem
              icon={User}
              onClick={() => {
                setOpen(false);
                void navigate('/profile');
              }}
            >
              Profile
            </MenuItem>
            <MenuItem
              icon={CreditCard}
              onClick={() => {
                setOpen(false);
                void navigate('/billing');
              }}
            >
              Billing
            </MenuItem>
            <MenuItem
              icon={MessageSquarePlus}
              onClick={() => {
                setOpen(false);
                setFeedbackOpen(true);
              }}
            >
              Send feedback
            </MenuItem>
            <MenuItem icon={LogOut} tone="danger" onClick={() => void onSignOut()}>
              Sign out
            </MenuItem>
          </motion.div>
        )}
      </AnimatePresence>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
