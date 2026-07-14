// Automated accessibility smoke (Phase 7). Renders the app's load-bearing
// interactive primitives under jsdom and asserts axe-core finds zero
// violations. These are the widgets Phase 3 hardened (focus, roles, names), so
// this suite is the regression net that keeps them accessible. Full-page and
// contrast coverage lives in the Lighthouse pass (PHASE-7-VERIFICATION.md); the
// dedicated contrast suites cover AA maths.
import { type ReactNode, useState } from 'react';
import { describe, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeContext } from '@/components/theme/theme-context';
import { LabelPill } from '@/features/board/LabelPill';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/feedback/Spinner';
import { GlassSelect } from '@/components/forms/GlassSelect';
import { expectNoAxeViolations } from './axe';

function ThemeWrap({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider
      value={{ theme: 'light', setTheme: () => {}, toggleTheme: () => {} }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

describe('a11y: LabelPill', () => {
  it('full variant with a remove button has no violations', async () => {
    const { container } = render(
      <ThemeWrap>
        <LabelPill name="Design" color="rose" variant="full" onRemove={() => {}} />
      </ThemeWrap>,
    );
    await expectNoAxeViolations(container);
  });

  it('dot variant has no violations', async () => {
    const { container } = render(
      <ThemeWrap>
        <LabelPill name="Backend" color="cyan" variant="dot" />
      </ThemeWrap>,
    );
    await expectNoAxeViolations(container);
  });
});

describe('a11y: Modal', () => {
  it('open dialog with title + description has no violations', async () => {
    render(
      <Modal open onClose={() => {}} title="Delete project" description="This cannot be undone.">
        <p>Are you sure you want to delete this project?</p>
        <button type="button">Confirm</button>
      </Modal>,
    );
    // Modal portals to document.body, so scan the whole document.
    await expectNoAxeViolations(document.body);
  });
});

describe('a11y: Spinner', () => {
  it('status role with an accessible name has no violations', async () => {
    const { container } = render(<Spinner />);
    await expectNoAxeViolations(container);
  });
});

describe('a11y: GlassSelect', () => {
  const options = [
    { value: 'day', label: 'Day' },
    { value: 'night', label: 'Night' },
    { value: 'auto', label: 'System' },
  ];

  function SelectHarness() {
    const [value, setValue] = useState('day');
    return (
      <GlassSelect value={value} onChange={setValue} options={options} label="Theme" />
    );
  }

  it('collapsed combobox has no violations', async () => {
    const { container } = render(<SelectHarness />);
    await expectNoAxeViolations(container);
  });

  it('expanded listbox has no violations', async () => {
    const { container } = render(<SelectHarness />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Theme' }));
    await expectNoAxeViolations(container);
  });
});
