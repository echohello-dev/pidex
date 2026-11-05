import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { sessionPath } from './workbench';
import { SESSIONS_ROOT } from './sessions';

type ArchiveEntry = Record<string, unknown> & {
  id: string;
  type: string;
  parentId?: unknown;
};
export type EntryNode = {
  id: string;
  parentId: string | null;
  depth: number;
  label: string;
  tip: boolean;
  valid: boolean;
};
export type SessionTree = {
  nodes: EntryNode[];
  leafId: string | null;
  warning?: string;
  canContinue: boolean;
};
export type Archive = {
  header?: ArchiveEntry;
  entries: ArchiveEntry[];
  damaged: boolean;
};

export function parseArchive(text: string): Archive {
  const entries: ArchiveEntry[] = [];
  let header: ArchiveEntry | undefined;
  let damaged = false;
  const ids = new Set<string>();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line);
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        typeof value.id !== 'string' ||
        !value.id ||
        typeof value.type !== 'string'
      ) {
        damaged = true;
        continue;
      }
      if (value.type === 'session') {
        if (header) damaged = true;
        header ??= value;
        continue;
      }
      if (ids.has(value.id)) {
        damaged = true;
        continue;
      }
      ids.add(value.id);
      entries.push(value);
    } catch {
      damaged = true;
    }
  }
  return { header, entries, damaged };
}

export function selectedPath(
  archive: Archive,
  entryId?: string | null,
): ArchiveEntry[] {
  if (entryId === null) {
    if (archive.entries.length)
      throw new Error(
        'This empty session has advanced. Select its branch again.',
      );
    return [];
  }
  const byId = new Map(archive.entries.map((e) => [e.id, e]));
  let current =
    entryId === undefined ? archive.entries.at(-1) : byId.get(entryId);
  if (entryId !== undefined && !current)
    throw new Error('Selected entry no longer exists. Select it again.');
  const result: ArchiveEntry[] = [];
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current.id))
      throw new Error('This branch has cyclic lineage.');
    seen.add(current.id);
    result.push(current);
    if (current.parentId === null) break;
    if (typeof current.parentId !== 'string' || !byId.has(current.parentId))
      throw new Error('This branch has missing lineage.');
    current = byId.get(current.parentId);
  }
  return result.reverse();
}

function label(entry: ArchiveEntry): string {
  const message = entry.message as
    { role?: string; content?: unknown } | undefined;
  const content = message?.content;
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .filter((p) => p?.type === 'text')
            .map((p) => p.text)
            .join(' ')
        : '';
  return `${message?.role ?? entry.type}: ${String(
    text || entry.summary || entry.name || entry.modelId || '',
  )
    .replace(/\s+/g, ' ')
    .slice(0, 80)}`.replace(/: $/, '');
}

export function archiveTree(archive: Archive): SessionTree {
  const byId = new Map(archive.entries.map((e) => [e.id, e]));
  const children = new Map<string, ArchiveEntry[]>();
  const roots: ArchiveEntry[] = [];
  for (const entry of archive.entries) {
    if (typeof entry.parentId === 'string' && byId.has(entry.parentId)) {
      const group = children.get(entry.parentId) ?? [];
      group.push(entry);
      children.set(entry.parentId, group);
    } else roots.push(entry);
  }
  const nodes: EntryNode[] = [];
  const seen = new Set<string>();
  const walk = (root: ArchiveEntry, valid: boolean) => {
    const stack = [{ entry: root, depth: 0 }];
    while (stack.length) {
      const { entry, depth } = stack.pop()!;
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      nodes.push({
        id: entry.id,
        parentId: typeof entry.parentId === 'string' ? entry.parentId : null,
        depth,
        label: label(entry),
        tip: !children.has(entry.id),
        valid,
      });
      for (const child of [...(children.get(entry.id) ?? [])].reverse())
        stack.push({ entry: child, depth: depth + 1 });
    }
  };
  for (const root of roots) walk(root, root.parentId === null);
  for (const entry of archive.entries)
    if (!seen.has(entry.id)) walk(entry, false);
  return {
    nodes,
    canContinue: archive.header?.version === 3 && !archive.damaged,
    leafId: archive.entries.at(-1)?.id ?? null,
    warning:
      archive.damaged || nodes.some((n) => !n.valid)
        ? 'Archive has incomplete or invalid lineage. Invalid branches cannot be continued; damaged archives cannot be continued.'
        : archive.header?.version !== 3
          ? 'Continuation requires Pi v3. Open this archive in Pi to migrate it first.'
          : undefined,
  };
}

export async function loadArchive(
  file: string,
  root = SESSIONS_ROOT,
): Promise<Archive> {
  const target = await sessionPath(file, root);
  if ((await fs.stat(target)).size > 16 * 1024 * 1024)
    throw new Error('This session is too large to browse.');
  return parseArchive(await fs.readFile(target, 'utf8'));
}

export async function readSessionTree(file: string): Promise<SessionTree> {
  return archiveTree(await loadArchive(file));
}

/** Pi RPC cannot navigate an arbitrary entry. Extract a native v3 branch archive,
 * retaining entry IDs and every record type (including compaction/tool metadata).
 * Never rewrite the source. Opening this file uses Pi's supported --session flag. */
export async function forkArchive(
  file: string,
  entryId: string,
  root = SESSIONS_ROOT,
): Promise<string> {
  const source = await sessionPath(file, root);
  const archive = await loadArchive(source, root);
  if (!archive.header || archive.header.version !== 3 || archive.damaged)
    throw new Error(
      'Forking requires an intact Pi v3 archive. Open older archives in Pi to migrate them first.',
    );
  const entries = selectedPath(archive, entryId);
  if (!entries.length) throw new Error('This session has no entry to fork.');
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const target = path.join(
    path.dirname(source),
    `${timestamp.replace(/[:.]/g, '-')}_${id}.jsonl`,
  );
  await fs.writeFile(
    target,
    [{ ...archive.header, id, timestamp, parentSession: source }, ...entries]
      .map((e) => JSON.stringify(e))
      .join('\n') + '\n',
    { flag: 'wx' },
  );
  return target;
}

/** Pi initializes model/thinking settings on open. Those entries may advance the
 * leaf without changing the selected conversation. Reject all other movement,
 * including messages, branching metadata, unknown records and broken chains. */
export function runtimeMatchesSelection(
  entryId: string | null,
  data: unknown,
): boolean {
  if (!data || typeof data !== 'object') return false;
  const position = data as { entries?: unknown; leafId?: unknown };
  if (!Array.isArray(position.entries)) return false;
  let parent = entryId;
  for (const value of position.entries) {
    if (!value || typeof value !== 'object') return false;
    const entry = value as { type?: unknown; id?: unknown; parentId?: unknown };
    if (
      (entry.type !== 'model_change' &&
        entry.type !== 'thinking_level_change') ||
      typeof entry.id !== 'string' ||
      !entry.id ||
      entry.parentId !== parent
    )
      return false;
    parent = entry.id;
  }
  return position.leafId === parent;
}
