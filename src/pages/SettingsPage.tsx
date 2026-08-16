import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  Copy,
  Palette,
  RefreshCw,
  Rss,
  RotateCcw,
  Sparkles,
  Type,
} from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GradientButton } from '@/components/buttons/GradientButton';
import { PersonalizationPresetGrid } from '@/components/theme/PersonalizationPresetGrid';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Tooltip } from '@/components/Tooltip';
import { ProGate } from '@/features/billing/ProGate';
import { feedUrlForToken } from '@/features/calendar-feed/api';
import { useEnableFeed, useFeedToken, useRevokeFeedToken, useRotateFeedToken } from '@/features/calendar-feed/useCalendarFeed';
import { useGenerateMcpToken, useMcpTokenStatus, useRevokeMcpToken, useRotateMcpToken } from '@/features/mcp-connect/useMcpToken';
import { useTheme } from '@/hooks/useTheme';
import { useCustomTheme } from '@/hooks/useCustomTheme';
import { cn } from '@/lib/cn';
import { AA_CONTRAST, contrastRatio, THEME_BG } from '@/lib/contrast';
import { FONT_PAIRINGS, type FontPairingId } from '@/lib/customTheme';
import type { PersonalizationPresetId } from '@/lib/personalizationPresets';

/**
 * Settings — app-wide theming (replaces the old dev-only Style Guide route in
 * the main nav). Font pairing is free; custom colors are Pro (gated by
 * <ProGate>, matching every other Pro affordance in the app). Every change
 * here writes CSS custom properties on <html> immediately (see
 * lib/customTheme.ts), so the live preview panel below IS the real app —
 * nothing here is a mockup.
 *
 * CURATED-FIRST (2026-08-15): "Custom colors" now leads with a grid of eight
 * coordinated personalization presets (`PersonalizationPresetGrid` +
 * `lib/personalizationPresets.ts`) — a background, text, AND accent gradient
 * per option, all AA-compliant by construction. The raw hex/color-wheel
 * pickers still exist for a power user who wants full control, but now live
 * behind an "Advanced: pick your own colors" disclosure, with the contrast
 * warning kept as a safety net for that path specifically (presets never
 * need it — they can't fail AA). Selecting a preset and editing an Advanced
 * color are mutually exclusive — each clears the other, so there's always
 * exactly one source of truth for `applyCustomTheme` to resolve.
 *
 * REBUILT 2026-08-15: a production report that nothing on this page responded
 * to clicks (no console errors, other pages fine) could not be reproduced by
 * reading the code or by live-testing the deployed site — SettingsPage had no
 * bug in it. This version intentionally drops the per-section `<Reveal>`
 * (Framer Motion mount-fade) wrappers the old version used six times in a row
 * — the one pattern used far more densely here than on any other page — so a
 * plain, animation-free DOM tree is on record as still being interactive.
 * Everything else is functionally identical to before.
 */
const DEFAULT_FG: Record<'dark' | 'light', string> = {
  dark: '#ECE2D2',
  light: '#221A14',
};

export function SettingsPage() {
  const { theme } = useTheme();
  // Settings live in CustomThemeProvider now (2026-08-15), not local state —
  // `setSettings` applies to <html>, persists to localStorage, AND (signed
  // in) writes through to the account, so every change here is exactly what
  // syncs to the user's other devices.
  const { settings, setSettings, resetSettings } = useCustomTheme();
  // Open the Advanced disclosure by default only when it's already the active
  // customization (an Advanced pair from before this change, or from a prior
  // session) — otherwise the curated grid is the default, primary UI.
  const [advancedOpen, setAdvancedOpen] = useState(
    () => settings.preset === null && (settings.bg !== null || settings.text !== null),
  );

  // Only meaningful for the Advanced pair — presets are AA-compliant by
  // construction (see personalizationPresets.test.ts), so this stays 0/false
  // whenever a preset is active (bg/text are null in that case).
  const effectiveBg = settings.bg ?? THEME_BG[theme];
  const effectiveText = settings.text ?? DEFAULT_FG[theme];
  const contrast = contrastRatio(effectiveBg, effectiveText);
  const lowContrast = (settings.bg !== null || settings.text !== null) && contrast < AA_CONTRAST;

  function setFontPairing(id: FontPairingId) {
    setSettings({ ...settings, fontPairing: id });
  }

  function setPreset(id: PersonalizationPresetId) {
    // Preset and Advanced are mutually exclusive — picking a preset clears
    // any Advanced bg/text so applyCustomTheme has one unambiguous source.
    setSettings({ ...settings, preset: id, bg: null, text: null });
  }

  function setBg(hex: string | null) {
    setSettings({ ...settings, bg: hex, preset: null });
  }

  function setText(hex: string | null) {
    setSettings({ ...settings, text: hex, preset: null });
  }

  function handleReset() {
    resetSettings();
    setAdvancedOpen(false);
  }

  const isCustomized =
    settings.preset !== null ||
    settings.bg !== null ||
    settings.text !== null ||
    settings.fontPairing !== 'almanac';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div>
          <p className="text-sm font-medium text-fg-muted">Make Aurora yours</p>
          <h1 className="gradient-text mt-1 font-display text-headline font-bold">Settings</h1>
          <p className="mt-2 max-w-prose text-fg-muted">
            Choose a font pairing and, on Pro, your own background and text colors — applied
            everywhere, instantly, without breaking the glass.
          </p>
        </div>
        {isCustomized && (
          <GradientButton variant="secondary" leftIcon={<RotateCcw size={16} />} onClick={handleReset}>
            Reset to default
          </GradientButton>
        )}
      </header>

      <GlassPanel className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-fg">Day / Night</h2>
          <p className="text-sm text-fg-muted">Both are first-class — switch any time.</p>
        </div>
        <ThemeToggle />
      </GlassPanel>

      <GlassPanel className="p-5 sm:p-6">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-fg">
          <Type size={18} className="text-[var(--accent-from)]" /> Font pairing
        </h2>
        <p className="mb-4 text-sm text-fg-muted">
          A curated set — every pairing keeps Aurora's editorial serif identity.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.entries(FONT_PAIRINGS) as [FontPairingId, (typeof FONT_PAIRINGS)[FontPairingId]][]).map(
            ([id, pairing]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFontPairing(id)}
                aria-pressed={settings.fontPairing === id}
                className={cn(
                  'relative z-0 flex cursor-pointer flex-col items-start gap-1.5 rounded-2xl border p-4 text-left transition-colors',
                  settings.fontPairing === id
                    ? 'border-[color:var(--accent-from)] bg-[var(--glass-fill)]'
                    : 'border-[var(--glass-border)] hover:bg-[var(--glass-fill)]',
                )}
              >
                <span className="flex w-full items-center justify-between">
                  <span
                    style={{ fontFamily: `${pairing.display}, Georgia, serif` }}
                    className="text-2xl font-semibold text-fg"
                  >
                    Aa
                  </span>
                  {settings.fontPairing === id && <Check size={16} className="text-[var(--accent-from)]" />}
                </span>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-from)]">
                  {pairing.category}
                </span>
                <span className="text-sm font-semibold text-fg">{pairing.label}</span>
                <span style={{ fontFamily: `${pairing.body}, Georgia, serif` }} className="text-xs text-fg-muted">
                  {pairing.description}
                </span>
              </button>
            ),
          )}
        </div>
      </GlassPanel>

      <GlassPanel className="p-5 sm:p-6">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-fg">
          <Palette size={18} className="text-[var(--accent-from)]" /> Custom colors
        </h2>
        <p className="mb-4 text-sm text-fg-muted">
          A curated set — background, text, and a matching accent for buttons and highlights, all
          at once. The glass and grain stay exactly the same, only the color underneath changes.
        </p>
        <ProGate
          title="Custom colors are a Pro feature"
          reason="Upgrade to Pro to personalize Aurora's colors — everything else stays free."
        >
          <PersonalizationPresetGrid value={settings.preset} onChange={setPreset} />

          <div className="mt-5 border-t border-[var(--glass-border)] pt-4">
            <button
              type="button"
              onClick={() => setAdvancedOpen((open) => !open)}
              aria-expanded={advancedOpen}
              className="flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
            >
              <ChevronDown
                size={16}
                className={cn('transition-transform duration-200', advancedOpen && 'rotate-180')}
              />
              Advanced: pick your own colors
            </button>

            {advancedOpen && (
              <div className="mt-4">
                <p className="mb-3 text-xs text-fg-subtle">
                  Full control over background and text — a matching accent is still derived
                  automatically, but nothing here is curated, so double-check the contrast warning
                  below.
                </p>
                <div className="grid gap-5 sm:grid-cols-2">
                  <ColorField label="Background" value={settings.bg} onChange={setBg} />
                  <ColorField label="Text" value={settings.text} onChange={setText} />
                </div>
                {lowContrast && (
                  <p className="mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-sm text-warning">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    This background/text combination is hard to read ({contrast.toFixed(1)}:1 —
                    aim for at least {AA_CONTRAST}:1). Consider picking a lighter or darker text
                    color.
                  </p>
                )}
              </div>
            )}
          </div>
        </ProGate>
      </GlassPanel>

      <GlassPanel className="p-5 sm:p-6">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-fg">
          <Rss size={18} className="text-[var(--accent-from)]" /> Calendar sync
        </h2>
        <p className="mb-4 text-sm text-fg-muted">
          Subscribe from Google Calendar, Apple Calendar, or Outlook — your due dates, to-dos,
          and milestones stay in sync automatically.
        </p>
        <ProGate
          title="Calendar sync is a Pro feature"
          reason="Upgrade to Pro to subscribe to your Aurora calendar from any calendar app."
        >
          <CalendarFeedSection />
        </ProGate>
      </GlassPanel>

      <GlassPanel className="p-5 sm:p-6">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-fg">
          <Bot size={18} className="text-[var(--accent-from)]" /> Connect Claude
        </h2>
        <p className="mb-4 text-sm text-fg-muted">
          Let Claude Desktop or Claude Code read and write your boards, to-dos, and notes directly
          — generate a personal access token and paste it into Claude's config.
        </p>
        <ProGate
          title="Connecting Claude is a Pro feature"
          reason="Upgrade to Pro to connect Claude Desktop or Claude Code to your Aurora account."
        >
          <McpConnectSection />
        </ProGate>
      </GlassPanel>

      {/* NOTE: do NOT add `aurora-grain` here. That class is a full-bleed
          decorative overlay LAYER (position:absolute; inset:0) meant only for
          <AuroraBackground>; applied to a content panel it turns that panel
          into a page-sized 40%-opacity sheet covering the whole route and
          silently swallowing every click on it. That was the "Settings is
          frozen" bug (2026-08-15). The grain is already visible through this
          panel from the background behind it. */}
      <GlassPanel strong glow className="p-6 sm:p-8">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          <Sparkles size={13} /> Live preview
        </p>
        <h3 className="mb-1.5 font-display text-title font-bold text-fg">The quick almanac fox</h3>
        <p className="max-w-prose text-fg-muted">
          This panel is a real glass surface with the same paper-grain texture used everywhere
          else — it's showing you exactly what the rest of the app looks like right now, not a
          mockup.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--glass-fill)] px-3 py-1 text-xs font-medium text-fg">
            Body text
          </span>
          <span className="rounded-full bg-[var(--glass-fill)] px-3 py-1 text-xs font-medium text-fg-muted">
            Muted text
          </span>
          <Tooltip label="Even tooltips pick up your colors">
            <span className="rounded-full bg-[var(--glass-fill)] px-3 py-1 text-xs font-medium text-fg-subtle">
              Subtle text
            </span>
          </Tooltip>
        </div>
        {/* The point of the curated-first rework: buttons and highlights are
            no longer stuck on the brand oxblood — they pick up the same
            preset/derived accent as the rest of this preview, live. */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <GradientButton size="sm">Sample button</GradientButton>
          <span
            style={{
              background: 'linear-gradient(110deg, var(--accent-from), var(--accent-to))',
              color: 'var(--accent-fg)',
            }}
            className="rounded-full px-3 py-1 text-xs font-semibold"
          >
            Highlight
          </span>
        </div>
      </GlassPanel>
    </div>
  );
}

/**
 * Generate/copy/rotate/turn-off the ICS subscribe link. The link itself is a
 * plain HTTPS URL a calendar app polls with no session — the opaque token in
 * it IS the access control (see calendar-feed / calendar-feed-token edge
 * functions), so this UI is the only place it's ever shown in full.
 */
function CalendarFeedSection() {
  const { data: token, isLoading } = useFeedToken();
  const enable = useEnableFeed();
  const rotate = useRotateFeedToken();
  const revoke = useRevokeFeedToken();
  const [copied, setCopied] = useState(false);

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be denied/unavailable — the URL is still selectable
      // text in the field below, so nothing is actually blocked.
    }
  }

  if (isLoading) {
    return <p className="text-sm text-fg-muted">Loading…</p>;
  }

  if (!token) {
    return (
      <GradientButton
        leftIcon={<Rss size={16} />}
        onClick={() => enable.mutate()}
        isLoading={enable.isPending}
      >
        Turn on calendar sync
      </GradientButton>
    );
  }

  const url = feedUrlForToken(token);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Calendar subscribe URL"
          className="h-10 flex-1 rounded-lg border bg-[var(--field-bg)] px-2.5 text-sm text-fg-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
        />
        <Tooltip label="Copy link">
          <button
            type="button"
            onClick={() => void handleCopy(url)}
            className="btn-3d flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] px-3.5 text-sm font-semibold text-[var(--accent-fg)]"
          >
            <Copy size={15} /> {copied ? 'Copied!' : 'Copy'}
          </button>
        </Tooltip>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Tooltip label="Get a fresh link; the old one stops working">
          <button
            type="button"
            onClick={() => rotate.mutate()}
            disabled={rotate.isPending}
            className="flex items-center gap-1.5 text-xs font-medium text-fg-muted hover:text-fg disabled:opacity-50"
          >
            <RefreshCw size={13} /> Regenerate link
          </button>
        </Tooltip>
        <button
          type="button"
          onClick={() => revoke.mutate()}
          disabled={revoke.isPending}
          className="text-xs font-medium text-fg-muted hover:text-danger disabled:opacity-50"
        >
          Turn off
        </button>
      </div>
      <p className="text-xs text-fg-subtle">
        In Google Calendar: Other calendars → From URL. In Apple Calendar: File → New Calendar
        Subscription. Paste the link above.
      </p>
    </div>
  );
}

const MCP_SERVER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp-server`;
const TOKEN_PLACEHOLDER = '<paste-your-token-here>';

/**
 * Generate/regenerate/revoke the Aurora MCP access token that lets Claude
 * Desktop/Code read and write the caller's own data (see SETUP-MCP.md). Unlike
 * the calendar feed's token, the PLAINTEXT here is never stored server-side —
 * `revealedToken` (local component state, not the query cache) is the only
 * place it ever exists after generation, shown exactly once with an explicit
 * "you won't see this again" warning, matching the mcp-token edge function's
 * own one-time-return contract.
 */
function McpConnectSection() {
  const { data: status, isLoading } = useMcpTokenStatus();
  const generate = useGenerateMcpToken();
  const rotate = useRotateMcpToken();
  const revoke = useRevokeMcpToken();
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  async function handleCopy(field: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 2000);
    } catch {
      // Clipboard API can be denied/unavailable — the text is still selectable.
    }
  }

  if (isLoading) {
    return <p className="text-sm text-fg-muted">Loading…</p>;
  }

  const tokenForSnippets = revealedToken ?? TOKEN_PLACEHOLDER;
  const claudeCodeCommand = `claude mcp add --transport http aurora ${MCP_SERVER_URL} --header "Authorization: Bearer ${tokenForSnippets}"`;
  const claudeDesktopConfig = JSON.stringify(
    {
      mcpServers: {
        aurora: {
          command: 'npx',
          args: [
            '-y',
            'mcp-remote',
            MCP_SERVER_URL,
            '--header',
            `Authorization:Bearer ${tokenForSnippets}`,
          ],
        },
      },
    },
    null,
    2,
  );

  return (
    <div className="flex flex-col gap-4">
      {!status?.exists && !revealedToken && (
        <GradientButton
          leftIcon={<Bot size={16} />}
          onClick={() => generate.mutate(undefined, { onSuccess: setRevealedToken })}
          isLoading={generate.isPending}
        >
          Generate access token
        </GradientButton>
      )}

      {revealedToken && (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--accent-from)]/40 bg-[var(--accent-from)]/[0.06] p-3">
          <p className="text-xs font-semibold text-fg">
            Copy this token now — you won't be able to see it again.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              readOnly
              value={revealedToken}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Aurora MCP access token"
              className="h-10 flex-1 rounded-lg border bg-[var(--field-bg)] px-2.5 font-mono text-sm text-fg-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
            />
            <button
              type="button"
              onClick={() => void handleCopy('token', revealedToken)}
              className="btn-3d flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] px-3.5 text-sm font-semibold text-[var(--accent-fg)]"
            >
              <Copy size={15} /> {copiedField === 'token' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {status?.exists && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-fg-subtle">
            Connected
            {status.createdAt && ` · generated ${format(parseISO(status.createdAt), 'MMM d, yyyy')}`}
            {status.lastUsedAt
              ? ` · last used ${format(parseISO(status.lastUsedAt), 'MMM d, h:mm a')}`
              : ' · not used yet'}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Tooltip label="Get a fresh token; the old one stops working immediately">
              <button
                type="button"
                onClick={() => rotate.mutate(undefined, { onSuccess: setRevealedToken })}
                disabled={rotate.isPending}
                className="flex items-center gap-1.5 text-xs font-medium text-fg-muted hover:text-fg disabled:opacity-50"
              >
                <RefreshCw size={13} /> Regenerate token
              </button>
            </Tooltip>
            <button
              type="button"
              onClick={() => {
                revoke.mutate();
                setRevealedToken(null);
              }}
              disabled={revoke.isPending}
              className="text-xs font-medium text-fg-muted hover:text-danger disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {(status?.exists || revealedToken) && (
        <div className="flex flex-col gap-3 border-t border-[var(--glass-border)] pt-3">
          <p className="text-xs text-fg-subtle">
            {revealedToken
              ? 'Paste one of these into Claude, depending on which app you use:'
              : "Regenerate to get a fresh token to paste below — for reference, here's the config shape:"}
          </p>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-fg">Claude Code</span>
            <div className="flex items-start gap-2">
              <pre className="flex-1 overflow-x-auto rounded-lg border bg-[var(--field-bg)] p-2.5 font-mono text-xs text-fg-muted">
                {claudeCodeCommand}
              </pre>
              <Tooltip label="Copy command">
                <button
                  type="button"
                  onClick={() => void handleCopy('code', claudeCodeCommand)}
                  className="flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2 text-xs text-fg-muted hover:text-fg"
                >
                  <Copy size={13} /> {copiedField === 'code' ? 'Copied!' : 'Copy'}
                </button>
              </Tooltip>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-fg">
              Claude Desktop — <code className="text-[11px]">claude_desktop_config.json</code>
            </span>
            <div className="flex items-start gap-2">
              <pre className="flex-1 overflow-x-auto rounded-lg border bg-[var(--field-bg)] p-2.5 font-mono text-xs text-fg-muted">
                {claudeDesktopConfig}
              </pre>
              <Tooltip label="Copy config">
                <button
                  type="button"
                  onClick={() => void handleCopy('desktop', claudeDesktopConfig)}
                  className="flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2 text-xs text-fg-muted hover:text-fg"
                >
                  <Copy size={13} /> {copiedField === 'desktop' ? 'Copied!' : 'Copy'}
                </button>
              </Tooltip>
            </div>
          </div>
          <p className="text-xs text-fg-subtle">
            Restart Claude Desktop after editing its config. Full setup guide: SETUP-MCP.md in the
            project repo.
          </p>
        </div>
      )}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (hex: string | null) => void;
}) {
  const current = value ?? '#808080';
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-fg">{label}</span>
      <div className="flex items-center gap-2">
        {/* The native color input IS a hex/color-wheel picker (OS-drawn), the
            most reliable way to offer this without shipping a custom canvas
            widget — paired with a text field for typing a hex directly. */}
        <input
          type="color"
          aria-label={`${label} color`}
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-[var(--glass-border)] bg-transparent p-0.5"
        />
        <input
          type="text"
          aria-label={`${label} hex value`}
          value={value ?? ''}
          placeholder="Default"
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange(/^#[0-9a-fA-F]{6}$/.test(v) ? v : v === '' ? null : (value ?? null));
          }}
          className="h-10 w-28 rounded-lg border bg-[var(--field-bg)] px-2.5 text-sm text-fg focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs font-medium text-fg-muted hover:text-danger"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
