import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  filePatch,
  git,
  inspectWorkspace,
  parseNumstat,
  readSession,
  readText,
  validateDefaults,
  workspacePath,
} from '../../src/main/workbench';

const roots: string[] = [];
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pidex-workbench-'));
  roots.push(root);
  return root;
}
afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe('workspace inspection and preview', () => {
  it('reads actual staged, unstaged and untracked changes, including unusual filenames', async () => {
    const root = await fixture();
    await git(root, ['init', '-b', 'main']);
    await fs.writeFile(path.join(root, 'file with spaces.ts'), 'before\n');
    await git(root, ['add', '.']);
    await git(root, [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.test',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-m',
      'fixture',
    ]);
    await fs.writeFile(path.join(root, 'file with spaces.ts'), 'after\n');
    await fs.writeFile(path.join(root, 'new.ts'), 'new\n');
    let result = await inspectWorkspace(root);
    expect(result.branch).toBe('main');
    expect(result.changes).toContainEqual({
      path: 'file with spaces.ts',
      additions: 1,
      deletions: 1,
      staged: false,
      untracked: false,
    });
    expect(result.changes).toContainEqual({
      path: 'new.ts',
      additions: 0,
      deletions: 0,
      staged: false,
      untracked: true,
    });
    expect(
      await filePatch(root, 'file with spaces.ts', false, false),
    ).toContain('-before\n+after');
    expect(await filePatch(root, 'new.ts', false, true)).toContain('+new');
    await git(root, ['add', '--', 'file with spaces.ts']);
    result = await inspectWorkspace(root);
    expect(
      result.changes.find((c) => c.path === 'file with spaces.ts')?.staged,
    ).toBe(true);
    expect(await filePatch(root, 'file with spaces.ts', true, false)).toContain(
      '+after',
    );
  });

  it('rejects traversal and symlinks that leave the selected workspace', async () => {
    const root = await fixture();
    const outside = await fixture();
    await fs.writeFile(path.join(outside, 'private.txt'), 'private');
    await fs.symlink(
      path.join(outside, 'private.txt'),
      path.join(root, 'link.txt'),
    );
    await expect(workspacePath(root, 'link.txt')).rejects.toThrow(
      'outside this workspace',
    );
    await expect(workspacePath(root, '../private.txt')).rejects.toThrow();
    await expect(
      filePatch(root, '../private.txt', false, false),
    ).rejects.toThrow('Invalid file path');
    await expect(
      workspacePath(root, path.join(outside, 'private.txt')),
    ).rejects.toThrow('Choose a workspace file');
  });

  it('handles empty new files and workspace folders nested inside a repository', async () => {
    const root = await fixture();
    await git(root, ['init', '-b', 'main']);
    const nested = path.join(root, 'nested');
    await fs.mkdir(nested);
    await fs.writeFile(path.join(root, 'outside.txt'), 'outside\n');
    await fs.writeFile(path.join(nested, 'inside.txt'), 'before\n');
    await git(root, ['add', '.']);
    await git(root, [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.test',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-m',
      'fixture',
    ]);
    await fs.writeFile(path.join(root, 'outside.txt'), 'changed\n');
    await fs.writeFile(path.join(nested, 'inside.txt'), 'after\n');
    await fs.writeFile(path.join(nested, 'empty.txt'), '');
    const result = await inspectWorkspace(nested);
    expect(result.changes.map((change) => change.path)).toEqual([
      'inside.txt',
      'empty.txt',
    ]);
    expect(await filePatch(nested, 'inside.txt', false, false)).toContain(
      '+after',
    );
    expect(await filePatch(nested, 'empty.txt', false, true)).not.toContain(
      '@@',
    );
  });

  it('handles a folder without Git and does not preview binary or oversized files', async () => {
    const root = await fixture();
    await fs.writeFile(path.join(root, 'image.bin'), new Uint8Array([0, 1, 2]));
    await fs.writeFile(
      path.join(root, 'large.txt'),
      'x'.repeat(1024 * 1024 + 1),
    );
    await fs.mkdir(path.join(root, 'node_modules'));
    await fs.writeFile(
      path.join(root, 'node_modules', 'ignored.txt'),
      'ignored',
    );
    const result = await inspectWorkspace(root);
    expect(result.gitError).toBeTruthy();
    expect(result.files).not.toContain('node_modules/ignored.txt');
    await expect(readText(path.join(root, 'image.bin'))).rejects.toThrow(
      'Binary',
    );
    await expect(readText(path.join(root, 'large.txt'))).rejects.toThrow(
      '1 MB',
    );
  });

  it('preserves tabs and newlines in Git paths and validates saved defaults', () => {
    expect(parseNumstat('2\t1\ta\tb\nc.ts\0-\t-\tbinary.png\0', false)).toEqual(
      [
        {
          path: 'a\tb\nc.ts',
          additions: 2,
          deletions: 1,
          staged: false,
          untracked: false,
        },
        {
          path: 'binary.png',
          additions: 0,
          deletions: 0,
          staged: false,
          untracked: false,
        },
      ],
    );
    expect(() =>
      validateDefaults({
        model: 'test',
        provider: 'test',
        thinking: 'unknown',
      }),
    ).toThrow();
    expect(
      validateDefaults({ model: '', provider: '', thinking: 'medium' }),
    ).toEqual({ model: '', provider: '', thinking: 'medium' });
  });

  it('previews only the selected session branch and rejects files outside the archive', async () => {
    const root = await fixture();
    const outside = await fixture();
    const user = { role: 'user', content: [{ type: 'text', text: 'Task' }] };
    const answer = {
      role: 'assistant',
      content: [{ type: 'text', text: 'Current answer' }],
    };
    const file = path.join(root, 'session.jsonl');
    await fs.writeFile(
      file,
      [
        { type: 'session', id: 'header' },
        { type: 'message', id: 'user', parentId: null, message: user },
        {
          type: 'message',
          id: 'abandoned',
          parentId: 'user',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Abandoned' }],
          },
        },
        { type: 'message', id: 'current', parentId: 'user', message: answer },
      ]
        .map((record) => JSON.stringify(record))
        .join('\n') + '\nnull\n{"partial"',
    );
    expect(await readSession(file, root)).toEqual([user, answer]);
    await fs.writeFile(path.join(outside, 'session.jsonl'), '{}');
    await expect(
      readSession(path.join(outside, 'session.jsonl'), root),
    ).rejects.toThrow('Invalid session');
  });

  it('terminates cyclic session branches and rejects symlinked archives outside the session root', async () => {
    const root = await fixture();
    const outside = await fixture();
    const first = { role: 'user', content: 'First' };
    const second = { role: 'assistant', content: 'Second' };
    const file = path.join(root, 'cycle.jsonl');
    await fs.writeFile(
      file,
      [
        { type: 'message', id: 'a', parentId: 'b', message: first },
        { type: 'message', id: 'b', parentId: 'a', message: second },
      ]
        .map((record) => JSON.stringify(record))
        .join('\n'),
    );
    expect(await readSession(file, root)).toEqual([first, second]);
    const secret = path.join(outside, 'private.jsonl');
    await fs.writeFile(secret, '{}');
    const linked = path.join(root, 'linked.jsonl');
    await fs.symlink(secret, linked);
    await expect(readSession(linked, root)).rejects.toThrow('Invalid session');
  });

  it('bounds stored model identifiers without mutating the supplied defaults', () => {
    const value = {
      model: 'm'.repeat(201),
      provider: 'p'.repeat(101),
      thinking: 'high',
    };
    expect(validateDefaults(value)).toEqual({
      model: 'm'.repeat(200),
      provider: 'p'.repeat(100),
      thinking: 'high',
    });
    expect(value.model).toHaveLength(201);
    for (const invalid of [
      null,
      {},
      { ...value, provider: 12 },
      { ...value, thinking: 'invalid' },
    ]) {
      expect(() => validateDefaults(invalid)).toThrow(
        'Invalid session defaults',
      );
    }
  });
});
