import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { SettingsView } from '../../src/renderer/components/WorkbenchViews';
import type { Defaults, PidexApi } from '../../src/renderer/api';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  delete document.documentElement.dataset.reducedMotion;
});
const defaults: Defaults = { model: '', provider: '', thinking: 'medium' };
function props() {
  return {
    cwd: '/project',
    models: [{ id: 'sonnet', name: 'Sonnet', provider: 'anthropic' }],
    modelError: '',
    modelsLoading: false,
    defaults,
    resetSignal: 0,
    onSaved: vi.fn(),
    report: vi.fn(),
    onFiles: vi.fn(),
  };
}

describe('workspace settings', () => {
  it('saves the selected model and reasoning defaults and disables duplicate saves', async () => {
    let finish!: (value: Awaited<ReturnType<PidexApi['saveSettings']>>) => void;
    const saveSettings = vi.fn<PidexApi['saveSettings']>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal('pidex', { saveSettings } satisfies Partial<PidexApi>);
    const callbacks = props();
    const { rerender } = render(<SettingsView {...callbacks} />);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Default model'), {
      target: { value: 'anthropic/sonnet' },
    });
    fireEvent.change(screen.getByLabelText('Reasoning effort'), {
      target: { value: 'high' },
    });
    expect(screen.getByText('3 unsaved changes')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const selected = {
      model: 'sonnet',
      provider: 'anthropic',
      thinking: 'high',
    };
    expect(saveSettings).toHaveBeenCalledExactlyOnceWith('/project', selected);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    finish({ data: selected });
    await waitFor(() =>
      expect(callbacks.onSaved).toHaveBeenCalledExactlyOnceWith(selected),
    );
    rerender(<SettingsView {...callbacks} defaults={selected} />);
    expect(screen.getByText('Changes saved')).toBeVisible();
    expect(screen.getByLabelText('Default tool permissions')).toBeDisabled();
    expect(screen.getByLabelText('Default worktree')).toBeDisabled();
  });

  it('keeps an unsaved draft after an IPC error and lets Cancel discard it', async () => {
    vi.stubGlobal('pidex', {
      saveSettings: vi.fn().mockResolvedValue({ error: 'Disk is full' }),
    } satisfies Partial<PidexApi>);
    const callbacks = props();
    render(<SettingsView {...callbacks} />);
    fireEvent.change(screen.getByLabelText('Reasoning effort'), {
      target: { value: 'high' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(callbacks.report).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Disk is full' }),
      ),
    );
    expect(callbacks.onSaved).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Reasoning effort')).toHaveValue('high');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Reasoning effort')).toHaveValue('medium');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('restores Pi defaults as a draft without saving automatically', () => {
    const callbacks = props();
    const initial = {
      model: 'sonnet',
      provider: 'anthropic',
      thinking: 'high',
    };
    const { rerender } = render(
      <SettingsView {...callbacks} defaults={initial} />,
    );
    rerender(
      <SettingsView {...callbacks} defaults={initial} resetSignal={1} />,
    );
    expect(screen.getByLabelText('Default model')).toHaveValue('');
    expect(screen.getByLabelText('Reasoning effort')).toHaveValue('medium');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    expect(callbacks.onSaved).not.toHaveBeenCalled();
  });

  it('does not resurrect clean cached defaults after the model changes outside Settings', async () => {
    const saveSettings = vi
      .fn<PidexApi['saveSettings']>()
      .mockImplementation(async (_cwd, value) => ({ data: value }));
    vi.stubGlobal('pidex', { saveSettings } satisfies Partial<PidexApi>);
    const cache = new Map<string, Defaults>();
    const callbacks = props();
    const first = {
      model: 'sonnet',
      provider: 'anthropic',
      thinking: 'medium',
    };
    const second = {
      model: 'other',
      provider: 'anthropic',
      thinking: 'medium',
    };
    const models = [
      ...callbacks.models,
      { id: 'other', name: 'Other', provider: 'anthropic' },
    ];
    const { unmount } = render(
      <SettingsView
        {...callbacks}
        defaults={first}
        models={models}
        draftCache={cache}
      />,
    );
    unmount();
    render(
      <SettingsView
        {...callbacks}
        defaults={second}
        models={models}
        draftCache={cache}
      />,
    );
    expect(screen.getByLabelText('Default model')).toHaveValue(
      'anthropic/other',
    );
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Reasoning effort'), {
      target: { value: 'high' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith('/project', {
        ...second,
        thinking: 'high',
      }),
    );
  });

  it('retains genuine dirty drafts but removes them from the cache when canceled', () => {
    const cache = new Map<string, Defaults>();
    const callbacks = props();
    const { unmount } = render(
      <SettingsView {...callbacks} draftCache={cache} />,
    );
    fireEvent.change(screen.getByLabelText('Reasoning effort'), {
      target: { value: 'high' },
    });
    unmount();
    render(<SettingsView {...callbacks} draftCache={cache} />);
    expect(screen.getByLabelText('Reasoning effort')).toHaveValue('high');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cache.has('/project')).toBe(false);
  });

  it('persists the reduced motion preference and reads it when reopened', () => {
    const { unmount } = render(<SettingsView {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Reduce motion' }));
    expect(localStorage.getItem('pidex.reduced-motion')).toBe('true');
    expect(document.documentElement.dataset.reducedMotion).toBe('true');
    unmount();
    render(<SettingsView {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }));
    expect(screen.getByRole('switch', { name: 'Reduce motion' })).toBeChecked();
  });
});
