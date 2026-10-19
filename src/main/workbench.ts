import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { SESSIONS_ROOT } from './sessions';

const exec = promisify(execFile);
const OMIT = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  '.next',
  '.venv',
  'coverage',
]);
const MAX_TEXT = 1024 * 1024;

export type GitChange = {
  path: string;
  additions: number;
  deletions: number;
  staged: boolean;
  untracked: boolean;
};
export type WorkspaceDetails = {
  branch: string;
  changes: GitChange[];
  files: string[];
  gitError?: string;
};
export type Defaults = { model: string; provider: string; thinking: string };
export type SkillInfo = {
  name: string;
  description: string;
  file: string;
  source: 'Workspace' | 'Global';
};
export const DEFAULTS: Defaults = {
  model: '',
  provider: '',
  thinking: 'medium',
};

export function inside(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return (
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

export async function workspacePath(
  cwd: string,
  file: string,
): Promise<string> {
  if (typeof file !== 'string' || !file || path.isAbsolute(file))
    throw new Error('Choose a workspace file.');
  const root = await fs.realpath(cwd);
  const target = await fs.realpath(path.resolve(root, file));
  if (!inside(root, target)) throw new Error('File is outside this workspace.');
  return target;
}

export async function readText(file: string): Promise<string> {
  const handle = await fs.open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_TEXT)
      throw new Error('Preview supports text files up to 1 MB.');
    const buffer = await handle.readFile();
    if (buffer.includes(0))
      throw new Error('Binary files cannot be previewed.');
    return buffer.toString('utf8');
  } finally {
    await handle.close();
  }
}

export async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec(
    'git',
    ['--no-pager', '-c', 'core.quotePath=false', ...args],
    {
      cwd,
      timeout: 15_000,
      maxBuffer: 8 * MAX_TEXT,
      encoding: 'utf8',
    },
  );
  return stdout;
}

export function parseNumstat(text: string, staged: boolean): GitChange[] {
  return text
    .split('\0')
    .filter(Boolean)
    .flatMap((record) => {
      const match = /^(\d+|-)\t(\d+|-)\t([\s\S]+)$/.exec(record);
      return match
        ? [
            {
              path: match[3],
              additions: Number(match[1]) || 0,
              deletions: Number(match[2]) || 0,
              staged,
              untracked: false,
            },
          ]
        : [];
    });
}

async function listFiles(cwd: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(relative: string, depth: number) {
    if (depth > 7 || files.length >= 3000) return;
    const entries = await fs.readdir(path.join(cwd, relative), {
      withFileTypes: true,
    });
    entries.sort(
      (a, b) =>
        Number(b.isDirectory()) - Number(a.isDirectory()) ||
        a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      if (
        OMIT.has(entry.name) ||
        entry.isSymbolicLink() ||
        files.length >= 3000
      )
        continue;
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(name, depth + 1).catch(() => {});
      else if (entry.isFile()) files.push(name);
    }
  }
  await walk('', 0);
  return files;
}

export async function inspectWorkspace(cwd: string): Promise<WorkspaceDetails> {
  const files = await listFiles(cwd);
  try {
    const [branch, working, staged, untracked] = await Promise.all([
      git(cwd, ['branch', '--show-current']),
      git(cwd, [
        'diff',
        '--no-ext-diff',
        '--no-textconv',
        '--no-renames',
        '--numstat',
        '-z',
        '--relative',
        '--',
        '.',
      ]),
      git(cwd, [
        'diff',
        '--cached',
        '--no-ext-diff',
        '--no-textconv',
        '--no-renames',
        '--numstat',
        '-z',
        '--relative',
        '--',
        '.',
      ]),
      git(cwd, ['ls-files', '--others', '--exclude-standard', '-z']),
    ]);
    return {
      branch: branch.trim(),
      files,
      changes: [
        ...parseNumstat(working, false),
        ...parseNumstat(staged, true),
        ...untracked
          .split('\0')
          .filter(Boolean)
          .map((file) => ({
            path: file,
            additions: 0,
            deletions: 0,
            staged: false,
            untracked: true,
          })),
      ],
    };
  } catch {
    return {
      branch: '',
      changes: [],
      files,
      gitError: 'Git changes are unavailable for this folder.',
    };
  }
}

export async function filePatch(
  cwd: string,
  file: string,
  staged: boolean,
  untracked: boolean,
): Promise<string> {
  // Deleted paths cannot be realpathed. Lexical containment still protects Git pathspecs.
  if (
    !file ||
    path.isAbsolute(file) ||
    !inside(path.resolve(cwd), path.resolve(cwd, file))
  )
    throw new Error('Invalid file path.');
  if (untracked) {
    await readText(await workspacePath(cwd, file));
    try {
      return await git(cwd, [
        'diff',
        '--no-index',
        '--no-ext-diff',
        '--no-textconv',
        '--',
        '/dev/null',
        file,
      ]);
    } catch (error) {
      // Git uses exit status 1 to report a valid patch with differences.
      const result = error as { code?: number; stdout?: string };
      if (result.code === 1 && typeof result.stdout === 'string')
        return result.stdout;
      throw error;
    }
  }
  return git(cwd, [
    '--literal-pathspecs',
    'diff',
    ...(staged ? ['--cached'] : []),
    '--no-ext-diff',
    '--no-textconv',
    '--relative',
    '--',
    file,
  ]);
}

export async function sessionPath(
  file: string,
  sessionsRoot = SESSIONS_ROOT,
): Promise<string> {
  const root = await fs.realpath(sessionsRoot);
  const target = await fs.realpath(file);
  if (!inside(root, target) || !target.endsWith('.jsonl'))
    throw new Error('Invalid session file.');
  return target;
}

export async function readSession(
  file: string,
  sessionsRoot = SESSIONS_ROOT,
): Promise<unknown[]> {
  const target = await sessionPath(file, sessionsRoot);
  const stat = await fs.stat(target);
  if (stat.size > 16 * MAX_TEXT)
    throw new Error(
      'This session is too large to preview. Resume it to continue.',
    );
  const records: {
    id?: string;
    parentId?: string;
    type?: string;
    message?: unknown;
  }[] = [];
  for (const line of (await fs.readFile(target, 'utf8')).split('\n')) {
    try {
      const record = JSON.parse(line);
      if (
        record &&
        typeof record === 'object' &&
        !Array.isArray(record) &&
        typeof record.id === 'string'
      )
        records.push(record);
    } catch {
      /* Partial final writes are expected. */
    }
  }
  // Follow the current branch rather than mixing messages from abandoned branches.
  const byId = new Map(records.filter((r) => r.id).map((r) => [r.id, r]));
  let current = records.at(-1);
  const branch: unknown[] = [];
  const seen = new Set<string>();
  while (current) {
    if (current.id && seen.has(current.id)) break;
    if (current.id) seen.add(current.id);
    if (current.type === 'message' && current.message)
      branch.unshift(current.message);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return branch;
}

export async function listSkills(cwd: string): Promise<SkillInfo[]> {
  const result: SkillInfo[] = [];
  const seen = new Set<string>();
  for (const [root, source] of [
    [path.join(os.homedir(), '.pi', 'agent', 'skills'), 'Global'],
    [path.join(os.homedir(), '.agents', 'skills'), 'Global'],
    [path.join(cwd, '.pi', 'skills'), 'Workspace'],
    [path.join(cwd, '.agents', 'skills'), 'Workspace'],
  ] as const) {
    async function walk(dir: string, depth: number) {
      if (depth > 4 || result.length >= 500) return;
      const real = await fs.realpath(dir);
      if (seen.has(real)) return;
      seen.add(real);
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        if (result.length >= 500) break;
        const file = path.join(dir, entry.name);
        try {
          if (
            entry.isDirectory() ||
            (entry.isSymbolicLink() && (await fs.stat(file)).isDirectory())
          )
            await walk(file, depth + 1);
          else if (entry.name === 'SKILL.md') {
            const text = await readText(file);
            const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            const field = (name: string) =>
              frontmatter?.[1]
                .match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1]
                .replace(/^["']|["']$/g, '') ?? '';
            result.push({
              name: field('name') || path.basename(dir),
              description: field('description'),
              file,
              source,
            });
          }
        } catch {
          // A missing link or invalid skill must not hide its siblings.
        }
      }
    }
    await walk(root, 0).catch(() => {});
  }
  return result;
}

export function validateDefaults(value: unknown): Defaults {
  const v = value as Partial<Defaults> | null;
  if (
    !v ||
    typeof v.model !== 'string' ||
    typeof v.provider !== 'string' ||
    !['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(
      v.thinking ?? '',
    )
  )
    throw new Error('Invalid session defaults.');
  return {
    model: v.model.slice(0, 200),
    provider: v.provider.slice(0, 100),
    thinking: v.thinking!,
  };
}
