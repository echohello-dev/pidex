import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const PI_MISSING =
  'Could not find the pi command. Install it, or set PIDEX_PI to the binary.';

type RpcEvent = Record<string, unknown> & { type: string };

type RpcResponse = {
  type: 'response';
  command: string;
  success: boolean;
  id?: string;
  data?: unknown;
  error?: string;
};

function piBinNames(): string[] {
  return process.platform === 'win32' ? ['pi.cmd', 'pi.exe', 'pi'] : ['pi'];
}

/** Directories a Finder launch does not inherit from the login shell. */
export function piPathDirs(home = os.homedir()): string[] {
  return [
    path.join(home, '.bun', 'bin'),
    path.join(home, '.local', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(home, '.local', 'share', 'mise', 'shims'),
  ];
}

function looksAbsolute(file: string): boolean {
  return path.isAbsolute(file);
}

export function resolvePi(
  env: NodeJS.ProcessEnv = process.env,
  exists: (file: string) => boolean = fs.existsSync,
  home = os.homedir(),
): string | null {
  const override = env.PIDEX_PI?.trim();
  if (override && looksAbsolute(override) && exists(override)) return override;

  for (const dir of piPathDirs(home)) {
    for (const name of piBinNames()) {
      const candidate = path.join(dir, name);
      if (exists(candidate)) return candidate;
    }
  }

  const pathEnv = env.PATH ?? '';
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    for (const name of piBinNames()) {
      const candidate = path.join(dir, name);
      if (exists(candidate)) return candidate;
    }
  }
  return null;
}

function childEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const current = (env.PATH ?? '').split(path.delimiter).filter(Boolean);
  const extra = piPathDirs().filter((dir) => !current.includes(dir));
  return { ...env, PATH: [...extra, ...current].join(path.delimiter) };
}

class RpcSession {
  readonly id: string;
  readonly cwd: string;
  private proc: ChildProcess;
  private buffer = '';
  private seq = 0;
  private closed = false;
  private failed: string | null = null;
  private pending = new Map<
    string,
    { resolve: (r: RpcResponse) => void; timer: NodeJS.Timeout }
  >();
  onEvent: (sessionId: string, event: RpcEvent) => void = () => {};
  onExit: (sessionId: string, code: number | null) => void = () => {};

  constructor(
    id: string,
    cwd: string,
    sessionFile?: string,
    ephemeral = false,
  ) {
    this.id = id;
    this.cwd = cwd;
    const bin = resolvePi();
    if (!bin) throw new Error(PI_MISSING);
    const args = ['--mode', 'rpc'];
    if (ephemeral) args.push('--no-session');
    if (sessionFile) args.push('--session', sessionFile);
    this.proc = spawn(bin, args, {
      cwd,
      env: childEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.proc.stdout!.setEncoding('utf8');
    this.proc.stdout!.on('data', (chunk) => this.handleChunk(chunk));
    this.proc.stderr!.setEncoding('utf8');
    this.proc.stderr!.on('data', () => {});
    this.proc.stdin?.on('error', () => {});
    this.proc.on('error', (err) => {
      const code = (err as NodeJS.ErrnoException).code;
      this.failed = code === 'ENOENT' ? PI_MISSING : err.message;
      this.close(null);
    });
    this.proc.on('exit', (code) => {
      this.failed ??= 'process exited';
      this.close(code);
    });
  }

  private close(code: number | null) {
    if (this.closed) return;
    this.closed = true;
    const error = this.failed ?? 'process exited';
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.resolve({ type: 'response', command: '', success: false, error });
    }
    this.pending.clear();
    this.onExit(this.id, code);
  }

  private handleChunk(chunk: string) {
    this.buffer += chunk;
    let idx: number;
    while ((idx = this.buffer.indexOf('\n')) !== -1) {
      let line = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.trim()) continue;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.type === 'response') {
        const response = msg as unknown as RpcResponse;
        if (response.id) {
          const p = this.pending.get(response.id);
          if (p) {
            clearTimeout(p.timer);
            this.pending.delete(response.id);
            p.resolve(response);
            continue;
          }
        }
      }
      this.onEvent(this.id, msg as RpcEvent);
    }
  }

  command(cmd: Record<string, unknown>): Promise<RpcResponse> {
    if (this.failed || this.closed) {
      return Promise.resolve({
        type: 'response',
        command: String(cmd.type ?? ''),
        success: false,
        error: this.failed ?? 'process exited',
      });
    }
    const id = `req-${++this.seq}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({
          type: 'response',
          command: String(cmd.type ?? ''),
          success: false,
          id,
          error: 'timeout',
        });
      }, 30000);
      this.pending.set(id, { resolve, timer });
      try {
        this.proc.stdin!.write(JSON.stringify({ id, ...cmd }) + '\n');
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        const message =
          err instanceof Error ? err.message : 'could not write to pi';
        resolve({
          type: 'response',
          command: String(cmd.type ?? ''),
          success: false,
          id,
          error: message,
        });
      }
    });
  }

  launchError(): string | null {
    return this.closed ? this.failed : null;
  }

  getState() {
    return this.command({ type: 'get_state' });
  }

  getMessages() {
    return this.command({ type: 'get_messages' });
  }

  getCommands() {
    return this.command({ type: 'get_commands' });
  }

  prompt(text: string, streaming: boolean) {
    const cmd: Record<string, unknown> = { type: 'prompt', message: text };
    if (streaming) cmd.streamingBehavior = 'steer';
    return this.command(cmd);
  }

  abort() {
    return this.command({ type: 'abort' });
  }

  dispose() {
    try {
      this.proc.kill('SIGTERM');
    } catch {
      /* already dead */
    }
  }
}

export { RpcSession };
export type { RpcEvent, RpcResponse };
