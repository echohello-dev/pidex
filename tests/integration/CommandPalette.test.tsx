import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CommandPalette } from '../../src/renderer/components/CommandPalette';

afterEach(cleanup);
function props() {
  return {
    workspaces: [],
    sessions: [],
    files: ['src/App.tsx', 'src/Composer.tsx'],
    commands: [{ name: 'compact' }, { name: 'skill:frontend' }],
    onClose: vi.fn(),
    onWorkspace: vi.fn(),
    onSession: vi.fn(),
    onNavigate: vi.fn(),
    onFile: vi.fn(),
    onCommand: vi.fn(),
    onAddWorkspace: vi.fn(),
  };
}

describe('command palette', () => {
  it('autofocuses search, wraps keyboard selection and opens the selected command', () => {
    const callbacks = props();
    render(<CommandPalette {...callbacks} />);
    const input = screen.getByRole('combobox');
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(
      '/compact',
    );
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(callbacks.onClose).toHaveBeenCalledOnce();
    expect(callbacks.onCommand).toHaveBeenCalledExactlyOnceWith('/compact ');
  });

  it('filters files by full path and opens the matching file', () => {
    const callbacks = props();
    render(<CommandPalette {...callbacks} />);
    fireEvent.click(screen.getByRole('tab', { name: /Files/ }));
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'SRC/composer' },
    });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(callbacks.onFile).toHaveBeenCalledExactlyOnceWith(
      'src/Composer.tsx',
    );
  });

  it('handles an empty search without invoking an action and closes on Escape', () => {
    const callbacks = props();
    render(<CommandPalette {...callbacks} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'no-such-command' } });
    expect(screen.getByText('No matching commands.')).toBeVisible();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(callbacks.onClose).not.toHaveBeenCalled();
    expect(input).not.toHaveAttribute('aria-activedescendant');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(callbacks.onClose).toHaveBeenCalledOnce();
  });

  it('traps Tab in the dialog and restores focus when closed', () => {
    const previous = document.createElement('button');
    document.body.append(previous);
    previous.focus();
    const { unmount } = render(<CommandPalette {...props()} />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
    const last = screen.getAllByRole('option').at(-1)!;
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(input).toHaveFocus();
    unmount();
    expect(previous).toHaveFocus();
    previous.remove();
  });
});
