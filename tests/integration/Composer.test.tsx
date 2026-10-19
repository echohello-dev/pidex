import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Composer } from '../../src/renderer/components/WorkbenchControls';

afterEach(cleanup);
const base = {
  draft: '',
  onDraft: vi.fn(),
  onSend: vi.fn(),
  onAttach: vi.fn(),
  onModel: vi.fn(),
  model: '',
  models: [],
};
describe('workbench composer', () => {
  it('does not submit an empty draft and allows multiline input', () => {
    render(<Composer {...base} />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    const input = screen.getByRole('textbox', { name: 'Message pi' });
    fireEvent.change(input, { target: { value: 'first\nsecond' } });
    expect(base.onDraft).toHaveBeenLastCalledWith('first\nsecond');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(base.onSend).not.toHaveBeenCalled();
  });

  it('selects slash commands by keyboard and completes them without submitting', () => {
    const onDraft = vi.fn();
    const onSend = vi.fn();
    render(
      <Composer
        {...base}
        draft="/c"
        onDraft={onDraft}
        onSend={onSend}
        commands={[{ name: 'compact' }, { name: 'clear' }]}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Message pi' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(onDraft).toHaveBeenLastCalledWith('/clear ');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('stops a running session and can steer it when a follow-up is entered', () => {
    const stop = vi.fn();
    const { rerender } = render(<Composer {...base} running onStop={stop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(stop).toHaveBeenCalledOnce();
    rerender(<Composer {...base} running onStop={stop} draft="Follow up" />);
    expect(screen.getByRole('button', { name: 'Steer' })).toBeEnabled();
    expect(screen.getByLabelText('Session model')).toBeDisabled();
    expect(screen.getByLabelText('Tool permissions')).toBeDisabled();
  });
});
