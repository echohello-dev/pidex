import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { HistoryHandoff } from '../../src/renderer/components/HistoryHandoff';
import type { WorkspaceInfo } from '../../src/renderer/api';

const roots: WorkspaceInfo[] = [
  { dirName: 'api', name: 'api', cwd: '/code/api', availability: 'available', branch: '', sessionCount: 1, lastActive: '' },
  { dirName: 'web', name: 'web', cwd: '/code/web', availability: 'available', branch: '', sessionCount: 0, lastActive: '' },
  { dirName: 'offline', name: 'offline', cwd: '/code/offline', availability: 'missing', branch: '', sessionCount: 0, lastActive: '' },
];
afterEach(cleanup);

describe('<HistoryHandoff>', () => {
  it('requires an available destination and prepares only on explicit submit', () => {
    const onPrepare = vi.fn();
    const { getByLabelText, getByRole, queryByRole } = render(
      <HistoryHandoff roots={roots} sourceRootId="api" onPrepare={onPrepare} />,
    );
    fireEvent.click(document.querySelector('summary')!);
    const destination = getByLabelText('Destination root');
    expect(queryByRole('option', { name: 'api / /code/api' })).toBeNull();
    expect(getByRole('option', { name: /offline/ })).toBeDisabled();
    expect(getByRole('button', { name: 'Prepare draft' })).toBeDisabled();
    fireEvent.change(destination, { target: { value: 'web' } });
    expect(onPrepare).not.toHaveBeenCalled();
    fireEvent.submit(getByRole('form', { name: 'Prepare context handoff' }));
    expect(onPrepare).toHaveBeenCalledExactlyOnceWith('web');
  });

  it('rejects a destination that becomes unavailable while the form is open', () => {
    const onPrepare = vi.fn();
    const { getByLabelText, getByRole, rerender } = render(
      <HistoryHandoff roots={roots} sourceRootId="api" onPrepare={onPrepare} />,
    );
    fireEvent.click(document.querySelector('summary')!);
    fireEvent.change(getByLabelText('Destination root'), { target: { value: 'web' } });
    rerender(<HistoryHandoff
      roots={roots.map((root) => ({ ...root, availability: 'missing' }))}
      sourceRootId="api" onPrepare={onPrepare}
    />);
    expect(getByRole('button', { name: 'Prepare draft' })).toBeDisabled();
    fireEvent.submit(getByRole('form', { name: 'Prepare context handoff' }));
    expect(onPrepare).not.toHaveBeenCalled();
  });

  it('explains how to add a destination when no other roots are registered', () => {
    const { getByText, getByRole } = render(
      <HistoryHandoff roots={[roots[0]]} sourceRootId="api" onPrepare={vi.fn()} />,
    );
    fireEvent.click(document.querySelector('summary')!);
    expect(getByText(/Add an available root from the sidebar/)).toBeTruthy();
    expect(getByRole('button', { name: 'Prepare draft' })).toBeDisabled();
  });
});
