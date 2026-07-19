import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';

const PI_CANDIDATES = ['pi', '/opt/homebrew/bin/pi', '/usr/local/bin/pi'];

type RpcEvent = Record<string, unknown> & { type: string };

type RpcResponse = {
  type: 'response';
  command: string;
  success: boolean;
  id?: string;
  data?: unknown;
  error?: string;
};

function resolvePi(): string {
  for (const candidate of PI_CANDIDATES) {
    if (candidate.includes('/')) {
      if (fs.existsSync(candidate)) return candidate;
    } else {
      return candidate;
    }
  }
  return 'pi';
}

class RpcSession {
  readonly id: string;
  readonly cwd: string;
  private proc: ChildProcess;
  private buffer = '';
  private seq = 0;
  private pending = new Map<string, { resolve: (r: RpcResponse) => void; timer: NodeJS.Timeout }>();
  onEvent: (sessionId: string, event: RpcEvent) => void = () => {};
  onExit: (sessionId: string, code: number | null) => void = () => {};

  constructor(id: string, cwd: string, sessionFile?: string) {
    this.id = id;
    this.cwd = cwd;
    const args = ['--mode', 'rpc'];
    if (sessionFile) args.push('--session', sessionFile);
    this.proc = spawn(resolvePi(), args, {
      cwd,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.proc.stdout!.setEncoding('utf8');
    this.proc.stdout!.on('data', chunk => this.handleChunk(chunk));
    this.proc.stderr!.setEncoding('utf8');
    this.proc.stderr!.on('data', () => {});
    this.proc.on('exit', code => {
      for (const [pid, p] of this.pending) {
        clearTimeout(p.timer);
        p.resolve({ type: 'response', command: '', success: false, id: pid, error: 'process exited' });
      }
      this.pending.clear();
      this.onExit(this.id, code);
    });
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
    const id = `req-${++this.seq}`;
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ type: 'response', command: String(cmd.type ?? ''), success: false, id, error: 'timeout' });
      }, 30000);
      this.pending.set(id, { resolve, timer });
      this.proc.stdin!.write(JSON.stringify({ id, ...cmd }) + '\n');
    });
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
