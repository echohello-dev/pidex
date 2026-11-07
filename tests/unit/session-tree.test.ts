import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  archiveTree,
  forkArchive,
  loadArchive,
  parseArchive,
  selectedPath,
  runtimeMatchesSelection,
} from '../../src/main/session-tree';

const message = (id: string, parentId: string | null, text = id) => ({
  type: 'message',
  id,
  parentId,
  message: { role: 'assistant', content: [{ type: 'text', text }] },
});
const header = {
  type: 'session',
  version: 3,
  id: 'session',
  cwd: '/tmp/project',
};
const records = [
  header,
  message('root', null),
  message('old', 'root'),
  { type: 'model_change', id: 'model', parentId: 'root', modelId: 'test' },
  message('new', 'model'),
  {
    type: 'label',
    id: 'label',
    parentId: 'new',
    targetId: 'old',
    label: 'Experiment',
  },
];
const encoded = (value: unknown[]) =>
  value.map((r) => JSON.stringify(r)).join('\n') + '\n';
const temporary: string[] = [];
describe('Pi archive branch selection', () => {
  afterEach(async () => {
    await Promise.all(
      temporary
        .splice(0)
        .map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );
  });
  it('includes metadata in the tree and resolves explicit abandoned branches without latest-leaf fallback', () => {
    const archive = parseArchive(encoded(records));
    expect(archiveTree(archive)).toMatchObject({
      leafId: 'label',
      canContinue: true,
      nodes: [
        { id: 'root', depth: 0 },
        { id: 'old', depth: 1, tip: true },
        { id: 'model', depth: 1 },
        { id: 'new', depth: 2 },
        { id: 'label', depth: 3, tip: true },
      ],
    });
    expect(selectedPath(archive, 'old').map((e) => e.id)).toEqual([
      'root',
      'old',
    ]);
    expect(selectedPath(archive).map((e) => e.id)).toEqual([
      'root',
      'model',
      'new',
      'label',
    ]);
    expect(() => selectedPath(archive, 'deleted')).toThrow('no longer exists');
  });
  it('shows orphaned and cyclic entries as invalid browseable roots and rejects their continuation', () => {
    const archive = parseArchive(
      encoded([
        header,
        message('orphan', 'gone'),
        message('a', 'b'),
        message('b', 'a'),
      ]),
    );
    expect(archiveTree(archive).nodes).toHaveLength(3);
    expect(archiveTree(archive).nodes.every((n) => !n.valid)).toBe(true);
    expect(() => selectedPath(archive, 'orphan')).toThrow('missing lineage');
    expect(() => selectedPath(archive, 'b')).toThrow('cyclic lineage');
  });
  it('handles empty archives, malformed tails, duplicate ids and unsupported archive versions', () => {
    expect(archiveTree(parseArchive(encoded([header])))).toMatchObject({
      nodes: [],
      leafId: null,
    });
    expect(selectedPath(parseArchive(encoded([header])), null)).toEqual([]);
    expect(() => selectedPath(parseArchive(encoded(records)), null)).toThrow(
      'has advanced',
    );
    for (const text of [
      encoded(records) + '{partial',
      encoded([...records, message('old', null)]),
    ]) {
      expect(archiveTree(parseArchive(text))).toMatchObject({
        canContinue: false,
        warning: expect.any(String),
      });
    }
    expect(
      archiveTree(parseArchive(encoded([{ ...header, version: 2 }])))
        .canContinue,
    ).toBe(false);
  });
  it('forks exactly the selected parent chain, preserving tool/compaction records and source bytes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pidex-tree-'));
    temporary.push(root);
    const file = path.join(root, 'source.jsonl');
    const original = encoded([
      ...records,
      {
        type: 'compaction',
        id: 'compact',
        parentId: 'old',
        firstKeptEntryId: 'root',
        summary: 'keep',
      },
      {
        type: 'message',
        id: 'tool',
        parentId: 'compact',
        message: { role: 'toolResult', toolCallId: 'call', content: [] },
      },
    ]);
    await fs.writeFile(file, original);
    const fork = await forkArchive(file, 'tool', root);
    const archive = await loadArchive(fork, root);
    expect(archive.header).toMatchObject({
      version: 3,
      parentSession: await fs.realpath(file),
    });
    expect(archive.header?.id).not.toBe('session');
    expect(archive.entries.map((e) => e.id)).toEqual([
      'root',
      'old',
      'compact',
      'tool',
    ]);
    expect(archive.entries[2]).toMatchObject({
      firstKeptEntryId: 'root',
      summary: 'keep',
    });
    expect(await fs.readFile(file, 'utf8')).toBe(original);
    await expect(forkArchive(file, 'missing', root)).rejects.toThrow(
      'no longer exists',
    );
    await fs.writeFile(file, original + '{partial');
    await expect(forkArchive(file, 'old', root)).rejects.toThrow(
      'intact Pi v3',
    );
  });
  it('rejects out-of-root and symlinked source paths before writing a fork', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pidex-tree-'));
    temporary.push(root);
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'pidex-outside-'));
    temporary.push(outside);
    const file = path.join(outside, 'source.jsonl');
    await fs.writeFile(file, encoded(records));
    const link = path.join(root, 'link.jsonl');
    await fs.symlink(file, link);
    await expect(forkArchive(link, 'old', root)).rejects.toThrow(
      'Invalid session',
    );
    expect(await fs.readdir(root)).toEqual(['link.jsonl']);
  });
  it('allows only linear model/thinking startup entries after a selection', () => {
    const setup = {
      type: 'thinking_level_change',
      id: 'setup',
      parentId: 'old',
    };
    expect(runtimeMatchesSelection('old', { entries: [], leafId: 'old' })).toBe(
      true,
    );
    expect(
      runtimeMatchesSelection('old', { entries: [setup], leafId: 'setup' }),
    ).toBe(true);
    expect(
      runtimeMatchesSelection(null, {
        entries: [{ ...setup, parentId: null }],
        leafId: 'setup',
      }),
    ).toBe(true);
    for (const entry of [
      { ...setup, type: 'message' },
      { ...setup, type: 'custom' },
      { ...setup, parentId: 'unrelated' },
    ])
      expect(
        runtimeMatchesSelection('old', { entries: [entry], leafId: 'setup' }),
      ).toBe(false);
    expect(
      runtimeMatchesSelection('old', { entries: [], leafId: 'unrelated' }),
    ).toBe(false);
    expect(runtimeMatchesSelection(null, { entries: [], leafId: null })).toBe(
      true,
    );
    expect(runtimeMatchesSelection('old', { leafId: 'old' })).toBe(false);
  });
});
