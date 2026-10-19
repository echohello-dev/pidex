import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { RpcSession } from './rpc';
import { listWorkspaces } from './sessions';
import {
  DEFAULTS,
  filePatch,
  git,
  inside,
  inspectWorkspace,
  listSkills,
  readSession,
  readText,
  validateDefaults,
  workspacePath,
  type Defaults,
} from './workbench';

export function registerWorkbench(
  getWindow: () => BrowserWindow | null,
  customWorkspaces: () => string[],
  sessions: Map<string, RpcSession>,
) {
  const settingsFile = () =>
    path.join(app.getPath('userData'), 'session-defaults.json');
  async function knownWorkspace(cwd: unknown): Promise<string> {
    if (typeof cwd !== 'string') throw new Error('Choose a workspace first.');
    const known = await listWorkspaces(customWorkspaces());
    if (!known.some((w) => w.cwd === cwd))
      throw new Error('Unknown workspace.');
    return cwd;
  }
  async function readDefaults(): Promise<Record<string, Defaults>> {
    try {
      const parsed = JSON.parse(await fs.readFile(settingsFile(), 'utf8'));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }
  const handle = (
    channel: string,
    fn: (...args: any[]) => Promise<unknown>,
  ) => {
    ipcMain.handle(`pidex:${channel}`, async (_event, ...args) => {
      try {
        return { data: await fn(...args) };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'The action failed.',
        };
      }
    });
  };
  handle('workspace:inspect', async (cwd) =>
    inspectWorkspace(await knownWorkspace(cwd)),
  );
  handle('workspace:read', async (cwd, file) =>
    readText(await workspacePath(await knownWorkspace(cwd), file)),
  );
  handle('workspace:patch', async (cwd, file, staged, untracked) =>
    filePatch(
      await knownWorkspace(cwd),
      file,
      Boolean(staged),
      Boolean(untracked),
    ),
  );
  handle('workspace:git', async (cwd, action, file) => {
    cwd = await knownWorkspace(cwd);
    if (action === 'stage' || action === 'unstage') {
      if (
        typeof file !== 'string' ||
        !file ||
        path.isAbsolute(file) ||
        !inside(path.resolve(cwd), path.resolve(cwd, file))
      )
        throw new Error('Invalid workspace file.');
    }
    if (action === 'stage') {
      await workspacePath(cwd, file).catch(async () => {
        // A deleted tracked file is still a valid staging target.
        await git(cwd, [
          '--literal-pathspecs',
          'ls-files',
          '--error-unmatch',
          '--',
          file,
        ]);
      });
      await git(cwd, ['--literal-pathspecs', 'add', '--', file]);
    } else if (action === 'stage-all')
      await git(cwd, ['add', '--all', '--', '.']);
    else if (action === 'unstage') {
      // git restore --staged also handles paths containing glob metacharacters.
      await git(cwd, [
        '--literal-pathspecs',
        'restore',
        '--staged',
        '--',
        file,
      ]);
    } else if (action === 'commit') {
      if (typeof file !== 'string' || !file.trim())
        throw new Error('Enter a commit message.');
      await git(cwd, ['commit', '-m', file.trim()]);
    } else throw new Error('Unsupported Git action.');
    return inspectWorkspace(cwd);
  });
  handle('session:preview', async (file) => readSession(file));
  handle('workspace:skills', async (cwd) =>
    listSkills(await knownWorkspace(cwd)),
  );
  handle('workspace:open', async (cwd) => {
    const error = await shell.openPath(await knownWorkspace(cwd));
    if (error) throw new Error(error);
  });
  handle('workspace:attach', async () => {
    const win = getWindow();
    if (!win) return [];
    const result = await dialog.showOpenDialog(win, {
      title: 'Reference files in your prompt',
      properties: ['openFile', 'multiSelections'],
    });
    return result.canceled ? [] : result.filePaths;
  });
  handle(
    'settings:get',
    async (cwd) =>
      (await readDefaults())[await knownWorkspace(cwd)] ?? DEFAULTS,
  );
  handle('settings:save', async (cwd, value) => {
    cwd = await knownWorkspace(cwd);
    const settings = await readDefaults();
    const defaults = validateDefaults(value);
    settings[cwd] = defaults;
    await fs.mkdir(app.getPath('userData'), { recursive: true });
    const tmp = `${settingsFile()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(settings, null, 2));
    await fs.rename(tmp, settingsFile());
    return defaults;
  });
  handle('settings:providers', async () => {
    const dir = path.join(os.homedir(), '.pi', 'agent');
    await fs.mkdir(dir, { recursive: true });
    const error = await shell.openPath(dir);
    if (error) throw new Error(error);
  });
  handle('models:list', async (cwd) => {
    cwd = await knownWorkspace(cwd);
    const existing = [...sessions.values()].find((s) => s.cwd === cwd);
    const runtime =
      existing ?? new RpcSession('model-probe', cwd, undefined, true);
    try {
      const response = await runtime.command({ type: 'get_available_models' });
      if (!response.success)
        throw new Error(response.error ?? 'Could not load models.');
      const data = response.data as {
        models?: {
          id: string;
          name?: string;
          provider: string;
          contextWindow?: number;
          reasoning?: boolean;
        }[];
      };
      return (data.models ?? []).map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        provider: m.provider,
        contextWindow: m.contextWindow,
        reasoning: m.reasoning,
      }));
    } finally {
      if (!existing) runtime.dispose();
    }
  });
  handle('session:model', async (id, provider, modelId) => {
    const runtime = sessions.get(id);
    if (!runtime) throw new Error('Resume the session to change its model.');
    const result = await runtime.command({
      type: 'set_model',
      provider,
      modelId,
    });
    if (!result.success)
      throw new Error(result.error ?? 'Could not change model.');
  });
}

export async function sessionDefaults(cwd: string): Promise<Defaults> {
  try {
    const all = JSON.parse(
      await fs.readFile(
        path.join(app.getPath('userData'), 'session-defaults.json'),
        'utf8',
      ),
    );
    return validateDefaults(all[cwd] ?? DEFAULTS);
  } catch {
    return DEFAULTS;
  }
}
