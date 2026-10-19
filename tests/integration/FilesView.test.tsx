import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { FilesView } from '../../src/renderer/components/WorkbenchViews';
import type { PidexApi, Result } from '../../src/renderer/api';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const props = {
  cwd: '/project',
  files: ['a.ts', 'b.ts'],
  initialFile: 'a.ts',
  report: vi.fn(),
};

describe('file previews', () => {
  it('ignores an older request that completes after switching files', async () => {
    const pending = new Map<string, (result: Result<string>) => void>();
    const readFile = vi.fn<PidexApi['readFile']>(
      (_cwd, file) =>
        new Promise((resolve) => {
          pending.set(file, resolve);
        }),
    );
    vi.stubGlobal('pidex', { readFile } satisfies Partial<PidexApi>);
    render(<FilesView {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'b.ts' }));
    await act(async () => pending.get('b.ts')!({ data: 'Current file' }));
    expect(screen.getByText('Current file')).toBeVisible();
    await act(async () => pending.get('a.ts')!({ data: 'Stale file' }));
    expect(screen.queryByText('Stale file')).not.toBeInTheDocument();
    expect(screen.getByText('Current file')).toBeVisible();
    expect(readFile).toHaveBeenLastCalledWith('/project', 'b.ts');
  });

  it('renders source as text and returns to the previous tab when the selected tab is closed', async () => {
    const readFile = vi.fn<PidexApi['readFile']>(async (_cwd, file) => ({
      data: file === 'a.ts' ? '<script>alert(1)</script>' : 'Second file',
    }));
    vi.stubGlobal('pidex', { readFile } satisfies Partial<PidexApi>);
    const { container } = render(<FilesView {...props} />);
    expect(await screen.findByText('<script>alert(1)</script>')).toBeVisible();
    expect(container.querySelector('script')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'b.ts' }));
    await screen.findByText('Second file');
    fireEvent.click(screen.getByRole('button', { name: 'Close b.ts' }));
    expect(await screen.findByText('<script>alert(1)</script>')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Close a.ts' }));
    expect(screen.getByText('Choose a file')).toBeVisible();
  });

  it('explains preview errors and filters the file tree without making a new request', async () => {
    const readFile = vi
      .fn<PidexApi['readFile']>()
      .mockResolvedValue({ error: 'Binary files cannot be previewed.' });
    vi.stubGlobal('pidex', { readFile } satisfies Partial<PidexApi>);
    render(<FilesView {...props} />);
    expect(await screen.findByText('Preview unavailable')).toBeVisible();
    expect(screen.getByText('Binary files cannot be previewed.')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Filter files'), {
      target: { value: 'no-such-file' },
    });
    expect(screen.getByText('No files found.')).toBeVisible();
    expect(readFile).toHaveBeenCalledOnce();
  });
});
