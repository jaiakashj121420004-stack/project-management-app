import { useEffect, useRef, useState } from 'react';
import { Download, Share, SquarePlus } from 'lucide-react';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Modal } from '@/components/Modal';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';

interface InstallPromptProps {
  /** Match the Sidebar's collapsed rail: icon-only, no label. */
  collapsed?: boolean;
}

/**
 * "Install Aurora" affordance. Aurora has been a fully-configured installable
 * PWA since Phase 9, but nothing in the UI ever told a user that a website can
 * be added to their home screen — most people don't know this is possible.
 * Lives in the Sidebar's footer area (quiet, always in view, doesn't compete
 * with the Topbar's already-busy search/notifications/user-menu row) and is
 * hidden entirely once the app is already installed or the platform genuinely
 * can't install it (no `beforeinstallprompt` support AND not iOS Safari).
 */
export function InstallPrompt({ collapsed = false }: InstallPromptProps) {
  const { canInstall, isIOS, promptInstall } = useInstallPrompt();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const hasTrackedShown = useRef(false);

  const visible = canInstall || isIOS;

  useEffect(() => {
    if (!visible || hasTrackedShown.current) return;
    hasTrackedShown.current = true;
    track('install_prompt_shown', { platform: isIOS ? 'ios_safari' : 'chromium' });
  }, [visible, isIOS]);

  if (!visible) return null;

  async function handleClick() {
    if (canInstall) {
      const outcome = await promptInstall();
      if (outcome) {
        track(outcome === 'accepted' ? 'install_accepted' : 'install_dismissed', {
          platform: 'chromium',
        });
      }
      return;
    }
    setShowIOSModal(true);
  }

  return (
    <>
      <GradientButton
        variant="secondary"
        size="sm"
        leftIcon={<Download size={15} />}
        onClick={handleClick}
        className={cn('w-full', collapsed && 'aspect-square w-11 px-0')}
        aria-label="Install Aurora"
      >
        {!collapsed && 'Install Aurora'}
      </GradientButton>

      <Modal
        open={showIOSModal}
        onClose={() => {
          setShowIOSModal(false);
          track('install_dismissed', { platform: 'ios_safari' });
        }}
        title="Install Aurora"
        description="Add Aurora to your Home Screen for quick, full-screen access — just like an app."
      >
        <ol className="space-y-4 text-sm text-fg">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--glass-fill)] font-mono text-xs font-semibold text-fg-muted">
              1
            </span>
            <span>
              Tap the{' '}
              <Share
                size={15}
                className="inline -translate-y-0.5 text-[color:var(--accent-from)]"
                aria-hidden
              />{' '}
              <strong>Share</strong> icon in Safari&apos;s toolbar.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--glass-fill)] font-mono text-xs font-semibold text-fg-muted">
              2
            </span>
            <span>
              Scroll down and tap{' '}
              <SquarePlus
                size={15}
                className="inline -translate-y-0.5 text-[color:var(--accent-from)]"
                aria-hidden
              />{' '}
              <strong>Add to Home Screen</strong>.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--glass-fill)] font-mono text-xs font-semibold text-fg-muted">
              3
            </span>
            <span>
              Tap <strong>Add</strong> — Aurora now opens full-screen right from your Home Screen.
            </span>
          </li>
        </ol>
      </Modal>
    </>
  );
}
