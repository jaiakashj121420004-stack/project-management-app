import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useFocusTrap } from './useFocusTrap';

function Harness({ onEscape }: { onEscape?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useFocusTrap<HTMLDivElement>(open, { onEscape });
  return (
    <div>
      <button data-testid="trigger" onClick={() => setOpen(true)}>
        open
      </button>
      {open && (
        <div data-testid="container" ref={ref} tabIndex={-1}>
          <button data-testid="first">first</button>
          <button data-testid="mid">mid</button>
          <button data-testid="last">last</button>
          <button data-testid="close" onClick={() => setOpen(false)}>
            close
          </button>
        </div>
      )}
    </div>
  );
}

describe('useFocusTrap', () => {
  it('moves focus into the container on activate', () => {
    render(<Harness />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByTestId('first'));
  });

  it('wraps Tab from the last focusable back to the first', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('trigger'));
    const container = screen.getByTestId('container');
    screen.getByTestId('close').focus();
    fireEvent.keyDown(container, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByTestId('first'));
  });

  it('wraps Shift+Tab from the first focusable to the last', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('trigger'));
    const container = screen.getByTestId('container');
    screen.getByTestId('first').focus();
    fireEvent.keyDown(container, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId('close'));
  });

  it('calls onEscape when Escape is pressed', () => {
    const onEscape = vi.fn();
    render(<Harness onEscape={onEscape} />);
    fireEvent.click(screen.getByTestId('trigger'));
    fireEvent.keyDown(screen.getByTestId('container'), { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the trigger when it closes', () => {
    render(<Harness />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger); // focus moves into the trap
    expect(document.activeElement).toBe(screen.getByTestId('first'));
    fireEvent.click(screen.getByTestId('close')); // deactivate + unmount
    expect(document.activeElement).toBe(trigger);
  });
});
