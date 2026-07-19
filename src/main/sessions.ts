import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const SESSIONS_ROOT = path.join(os.homedir(), '.pi', 'agent', 'sessions');

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
  title: string;
  model: string;
  timestamp: string;
  messageCount: number;
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
    .filter(p => p && p.type === 'text' && typeof p.text === 'string')
    .map(p => p.text as string)
    .join('\n');
}

function parseSession(file: string): SessionInfo | null {
  try {
    const lines = readLines(file);
    let id = '';
    let timestamp = '';
    let title = '';
    let model = '';
    let messageCount = 0;
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
        timestamp = String(entry.timestamp ?? '');
        continue;
      }
      if (entry.type === 'model_change' && typeof entry.modelId === 'string') {
        model = entry.modelId;
        continue;
      }
      if (entry.type === 'message') {
        messageCount += 1;
        const message = entry.message as { role?: string; content?: unknown } | undefined;
        if (!title && message?.role === 'user') {
          title = textOf(message.content).replace(/\s+/g, ' ').trim().slice(0, 90);
        }
      }
    }
    if (!id) return null;
    return { id, file, title: title || '(empty session)', model, timestamp, messageCount };
  } catch {
    return null;
  }
}

function gitBranch(cwd: string): Promise<string> {
  return new Promise(resolve => {
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

async function listWorkspaces(): Promise<WorkspaceInfo[]> {
  if (!fs.existsSync(SESSIONS_ROOT)) return [];
  const dirs = fs
    .readdirSync(SESSIONS_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const workspaces: WorkspaceInfo[] = [];
  for (const dirName of dirs) {
    const dirPath = path.join(SESSIONS_ROOT, dirName);
    const files = fs
      .readdirSync(dirPath)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => path.join(dirPath, f));
    if (files.length === 0) continue;

    let cwd = '';
    let lastActive = '';
    for (const file of files) {
      const stat = fs.statSync(file);
      if (stat.mtime.toISOString() > lastActive) lastActive = stat.mtime.toISOString();
      if (!cwd) {
        for (const line of readLines(file, 64 * 1024)) {
          if (!line) continue;
          try {
            const entry = JSON.parse(line);
            if (entry.type === 'session' && typeof entry.cwd === 'string') {
              cwd = entry.cwd;
              break;
            }
          } catch {
            break;
          }
        }
      }
    }
    if (!cwd) continue;
    const branch = fs.existsSync(cwd) ? await gitBranch(cwd) : '';
    workspaces.push({
      dirName,
      name: path.basename(cwd),
      cwd,
      branch,
      sessionCount: files.length,
      lastActive,
    });
  }
  workspaces.sort((a, b) => b.lastActive.localeCompare(a.lastActive));
  return workspaces;
}

function listSessions(dirName: string): SessionInfo[] {
  const dirPath = path.join(SESSIONS_ROOT, dirName);
  if (!dirPath.startsWith(SESSIONS_ROOT) || !fs.existsSync(dirPath)) return [];
  const sessions = fs
    .readdirSync(dirPath)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => parseSession(path.join(dirPath, f)))
    .filter((s): s is SessionInfo => s !== null);
  sessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return sessions;
}

export { listWorkspaces, listSessions, SESSIONS_ROOT };
export type { WorkspaceInfo, SessionInfo };
