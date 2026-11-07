import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const SESSIONS_ROOT = process.env.PIDEX_SESSIONS_ROOT
  ? path.resolve(process.env.PIDEX_SESSIONS_ROOT)
  : path.join(os.homedir(), '.pi', 'agent', 'sessions');

type WorkspaceInfo = {
  dirName: string;
  name: string;
  cwd: string;
  branch: string;
  sessionCount: number;
  lastActive: string;
};

type SessionInfo = {
  id: string;
  file: string;
  cwd: string;
  title: string;
  model: string;
  timestamp: string;
  messageCount: number;
  parentSession?: string;
};

function readLines(file: string, maxBytes = 256 * 1024): string[] {
  const fd = fs.openSync(file, 'r');
  try {
    const { size } = fs.fstatSync(fd);
    const length = Math.min(size, maxBytes);
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, length, 0);
    return buf.toString('utf8').split('\n');
  } finally {
    fs.closeSync(fd);
  }
}

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .filter((p) => p && p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('\n');
}

function parseSession(file: string): SessionInfo | null {
  try {
    file = fs.realpathSync(file);
    const lines = readLines(file);
    let id = '';
    let cwd = '';
    let timestamp = '';
    let title = '';
    let model = '';
    let messageCount = 0;
    let parentSession: string | undefined;
    for (const line of lines) {
      if (!line) continue;
      let entry: Record<string, unknown>;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (entry.type === 'session') {
        id = String(entry.id ?? '');
        parentSession =
          typeof entry.parentSession === 'string'
            ? entry.parentSession
            : undefined;
        if (parentSession) {
          try {
            parentSession = fs.realpathSync(parentSession);
          } catch {
            /* A missing source remains visible. */
          }
        }
        cwd = String(entry.cwd ?? '');
        timestamp = String(entry.timestamp ?? '');
        continue;
      }
      if (entry.type === 'model_change' && typeof entry.modelId === 'string') {
        model = entry.modelId;
        continue;
      }
      if (entry.type === 'message') {
        messageCount += 1;
        const message = entry.message as
          { role?: string; content?: unknown } | undefined;
        if (!title && message?.role === 'user') {
          title = textOf(message.content)
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 90);
        }
      }
    }
    if (!id) return null;
    return {
      id,
      file,
      cwd,
      title: title || '(empty session)',
      model,
      timestamp,
      messageCount,
      parentSession,
    };
  } catch {
    return null;
  }
}

function gitBranch(cwd: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      'git',
      ['-C', cwd, 'branch', '--show-current'],
      { timeout: 2000 },
      (err, stdout) => {
        resolve(err ? '' : stdout.trim());
      },
    );
  });
}

/** Paths identify locators, not registry roots. Missing paths remain discoverable. */
function canonicalCwd(cwd: string): string {
  try {
    return fs.realpathSync(cwd);
  } catch {
    return path.resolve(cwd);
  }
}

const metadata = new Map<string, { stamp: string; info: SessionInfo | null }>();
function discoverSessions(root = SESSIONS_ROOT): SessionInfo[] {
  const result = new Map<string, SessionInfo>();
  const seen = new Set<string>();
  let canonicalRoot: string;
  try {
    canonicalRoot = fs.realpathSync(root);
  } catch {
    return [];
  }
  function scan(directory: string, descend: boolean) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory() && descend) {
        scan(file, false);
        continue;
      }
      if (!entry.isFile() || !file.endsWith('.jsonl')) continue;
      try {
        const canonical = fs.realpathSync(file);
        const relative = path.relative(canonicalRoot, canonical);
        if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
          continue;
        const stat = fs.statSync(canonical);
        const stamp = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}`;
        seen.add(canonical);
        const cached = metadata.get(canonical);
        const info =
          cached?.stamp === stamp ? cached.info : parseSession(canonical);
        metadata.set(canonical, { stamp, info });
        if (info && path.isAbsolute(info.cwd)) result.set(canonical, info);
      } catch {
        /* One unavailable archive must not hide its siblings. */
      }
    }
  }
  scan(root, true);
  for (const file of metadata.keys())
    if (!seen.has(file)) metadata.delete(file);
  return [...result.values()].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );
}

function matchingSessions(
  cwd: string,
  aliases: string[],
  archives: SessionInfo[],
): SessionInfo[] {
  const canonical = canonicalCwd(cwd);
  const known = new Set([cwd, ...aliases].map((alias) => path.resolve(alias)));
  return archives.filter(
    (s) => known.has(path.resolve(s.cwd)) || canonicalCwd(s.cwd) === canonical,
  );
}
function sessionsForRoot(
  cwd: string,
  root = SESSIONS_ROOT,
  aliases: string[] = [],
): SessionInfo[] {
  return matchingSessions(cwd, aliases, discoverSessions(root));
}

async function listWorkspaces(
  extraCwds: string[] = [],
): Promise<WorkspaceInfo[]> {
  const archives = discoverSessions();
  const cwds = new Set(
    [...extraCwds, ...archives.map((s) => s.cwd)].map(canonicalCwd),
  );
  const result: WorkspaceInfo[] = [];
  for (const cwd of cwds) {
    const owned = archives.filter((s) => canonicalCwd(s.cwd) === cwd);
    result.push({
      dirName: cwd,
      name: path.basename(cwd),
      cwd,
      branch: fs.existsSync(cwd) ? await gitBranch(cwd) : '',
      sessionCount: owned.length,
      lastActive: owned[0]?.timestamp ?? '',
    });
  }
  return result.sort((a, b) => b.lastActive.localeCompare(a.lastActive));
}

export {
  listWorkspaces,
  sessionsForRoot,
  matchingSessions,
  discoverSessions,
  canonicalCwd,
  parseSession,
  SESSIONS_ROOT,
};
export type { WorkspaceInfo, SessionInfo };
