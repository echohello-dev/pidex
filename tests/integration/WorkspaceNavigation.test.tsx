import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { WorkspaceNavigation } from '../../src/renderer/components/WorkspaceNavigation';
import type { WorkspaceInfo } from '../../src/renderer/api';

afterEach(cleanup);
const roots: WorkspaceInfo[] = [
  {
    dirName: 'api',
    cwd: '/code/api',
    name: 'api',
    branch: 'main',
    sessionCount: 1,
    lastActive: '',
    availability: 'available',
  },
  {
    dirName: 'web',
    cwd: '/code/web',
    name: 'web',
    branch: '',
    sessionCount: 0,
    lastActive: '',
    availability: 'missing',
  },
];
function props() {
  return {
    roots,
    groups: [{ id: 'group', name: 'Commerce', rootIds: ['api', 'web'] }],
    groupId: 'group',
    rootId: 'api',
    onGroup: vi.fn(),
    onRoot: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    onAdd: vi.fn(),
  };
}

describe('workspace roots navigation', () => {
  it('labels root paths and availability, and selects roots independently of groups', () => {
    const callbacks = props();
    render(<WorkspaceNavigation {...callbacks} />);
    expect(screen.getByText('Missing folder')).toBeVisible();
    const button = screen.getByRole('button', { name: /api.*\/code\/api/ });
    expect(button).toHaveAttribute('aria-current', 'location');
    fireEvent.click(screen.getByRole('button', { name: /web.*\/code\/web/ }));
    expect(callbacks.onRoot).toHaveBeenCalledExactlyOnceWith(roots[1]);
    expect(callbacks.onSave).not.toHaveBeenCalled();
  });
  it('creates a named group with known roots and edits membership with stale-write provenance', async () => {
    const callbacks = props();
    render(<WorkspaceNavigation {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Workspace name' }), {
      target: { value: 'New workspace' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /web/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save workspace' }));
    await waitFor(() =>
      expect(callbacks.onSave).toHaveBeenCalledWith({
        name: 'New workspace',
        rootIds: ['api', 'web'],
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('form')).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit workspace' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /web/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save workspace' }));
    await waitFor(() =>
      expect(callbacks.onSave).toHaveBeenLastCalledWith({
        id: 'group',
        name: 'Commerce',
        rootIds: ['api'],
        expectedRoots: ['api', 'web'],
      }),
    );
  });
  it('keeps the group draft on a persistence failure', async () => {
    const callbacks = props();
    callbacks.onSave.mockRejectedValue(new Error('Disk full'));
    render(<WorkspaceNavigation {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit workspace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save workspace' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Disk full');
    expect(screen.getByRole('textbox', { name: 'Workspace name' })).toHaveValue(
      'Commerce',
    );
  });
});
