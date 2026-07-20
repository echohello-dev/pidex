import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core';
import { resolve } from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const ROOT = resolve(__dirname, '../..');
const ELECTRON_BIN = `${ROOT}/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron`;

let app: ElectronApplication | null = null;
let win: Page | null = null;

async function findRendererWindow(): Promise<Page | null> {
  if (!app) return null;
  for (let i = 0; i < 40; i++) {
    const candidate = app.windows().find(w => w.url().includes('localhost:5173'));
    if (candidate) return candidate;
    await new Promise(r => setTimeout(r, 500));
  }
  return null;
}

async function seedCustomWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pidex-e2e-'));
  return dir;
}

describe('pidex electron app (e2e)', () => {
  let tmpCwd: string;

  beforeAll(async () => {
    tmpCwd = await seedCustomWorkspace();
    app = await electron.launch({
      args: ['.'],
      executablePath: ELECTRON_BIN,
      cwd: ROOT,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PIDEX_E2E_CWD: tmpCwd,
      },
    });
    win = await findRendererWindow();
    if (!win) throw new Error('renderer window not found');
    await win.waitForLoadState('load');
    await win.waitForTimeout(3000);
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
    if (tmpCwd) await fs.rm(tmpCwd, { recursive: true, force: true }).catch(() => {});
  });

  it('renders the renderer window with the app shell mounted', async () => {
    const shell = await win!.locator('.app-shell').count();
    expect(shell).toBe(1);
  });

  it('locks document scroll so only the timeline scrolls internally', async () => {
    const dims = await win!.evaluate(() => ({
      bodyScrollHeight: document.body.scrollHeight,
      innerHeight: window.innerHeight,
    }));
    expect(dims.bodyScrollHeight).toBeLessThanOrEqual(dims.innerHeight + 1);
  });

  it('exposes version metadata from the preload bridge', async () => {
    const versions = await win!.evaluate(() => ({
      electron: window.pidex?.versions?.electron,
      node: window.pidex?.versions?.node,
      hasWorkspaces: typeof window.pidex?.workspaces === 'function',
    }));
    expect(versions.electron).toMatch(/^\d+\.\d+\.\d+/);
    expect(versions.node).toMatch(/^\d+\.\d+\.\d+/);
    expect(versions.hasWorkspaces).toBe(true);
  });

  it('does not draw white button borders on tabs or workspace rows', async () => {
    const result = await win!.evaluate(() => {
      const targets = [
        document.querySelector('.tab'),
        document.querySelector('.ws-row'),
        document.querySelector('.session-row'),
      ].filter((n): n is Element => n !== null);
      (targets[0] as HTMLElement | null)?.focus();
      return targets.map(t => {
        const cs = getComputedStyle(t as Element);
        return {
          outline: cs.outlineWidth,
          border: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth],
        };
      });
    });
    for (const style of result) {
      expect(style.outline).toBe('0px');
      expect(style.border.join(' ')).toBe('0px 1px 0px 0px');
    }
  });
});