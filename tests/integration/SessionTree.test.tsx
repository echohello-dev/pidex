import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {
  EntryTree,
  SessionTree,
  sessionForest,
} from '../../src/renderer/components/SessionTree';
import type { SessionInfo } from '../../src/renderer/api';
import type { SessionTree as Tree } from '../../src/main/session-tree';
const info = (file: string, parentSession?: string): SessionInfo => ({
  id: file,
  file,
  title: file,
  parentSession,
  model: 'pi',
  timestamp: '',
  messageCount: 2,
});
const tree: Tree = {
  leafId: 'new',
  canContinue: true,
  nodes: [
    {
      id: 'root',
      parentId: null,
      depth: 0,
      label: 'user: Task',
      tip: false,
      valid: true,
    },
    {
      id: 'old',
      parentId: 'root',
      depth: 1,
      label: 'assistant: Old answer',
      tip: true,
      valid: true,
    },
    {
      id: 'new',
      parentId: 'root',
      depth: 1,
      label: 'assistant: New answer',
      tip: true,
      valid: true,
    },
  ],
};
describe('session tree navigation', () => {
  afterEach(cleanup);
  it('nests fork archives, preserves source context when searching and exposes selection', () => {
    const onSelect = vi.fn();
    render(
      <SessionTree
        sessions={[
          info('fork', 'source'),
          info('source'),
          info('orphan', 'gone'),
        ]}
        selectedFile="fork"
        query="fork"
        onSelect={onSelect}
      />,
    );
    const rows = screen.getAllByRole('treeitem');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('source');
    expect(rows[1].getAttribute('aria-level')).toBe('2');
    expect(rows[1].getAttribute('aria-selected')).toBe('true');
    fireEvent.click(rows[0]);
    expect(onSelect).toHaveBeenCalledWith(info('source'));
    rows[0].focus();
    fireEvent.keyDown(rows[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows[1]);
  });
  it('terminates missing and cyclic session lineage without hiding archives', () => {
    const sessions = [info('a', 'b'), info('b', 'a'), info('c', 'gone')];
    expect(
      sessionForest(sessions)
        .map((r) => r.info.file)
        .sort(),
    ).toEqual(['a', 'b', 'c']);
    render(<SessionTree sessions={sessions} onSelect={vi.fn()} />);
    expect(screen.getByText(/Source unavailable/)).toBeTruthy();
  });
  it('selects an exact entry or branch tip and distinguishes selected from archive tip', () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <EntryTree tree={tree} selectedId="new" onSelect={onSelect} />,
    );
    const old = screen.getByRole('treeitem', { name: /Old answer/ });
    fireEvent.click(old);
    expect(onSelect).toHaveBeenCalledWith('old');
    fireEvent.change(screen.getByLabelText('Branch tip'), {
      target: { value: 'old' },
    });
    expect(onSelect).toHaveBeenLastCalledWith('old');
    rerender(<EntryTree tree={tree} selectedId="old" onSelect={onSelect} />);
    expect(
      screen
        .getByRole('treeitem', { name: /Old answer/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(
      within(screen.getByRole('treeitem', { name: /New answer/ })).getByText(
        /Archive tip/,
      ),
    ).toBeTruthy();
  });
  it('explains empty sessions', () => {
    render(
      <EntryTree
        tree={{ nodes: [], leafId: null, canContinue: true }}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/Empty session/)).toBeTruthy();
  });
});
