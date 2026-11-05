import {
  forkArchive,
  loadArchive,
  selectedPath,
  runtimeMatchesSelection,
} from './session-tree';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { listSessions, listWorkspaces } from './sessions';
import { sessionPath } from './workbench';
import { RpcSession } from './rpc';
import { registerWorkbench, sessionDefaults } from './workbench-ipc';

const isDev = !app.isPackaged;
if (isDev && process.env.PIDEX_E2E_USER_DATA)
  app.setPath('userData', process.env.PIDEX_E2E_USER_DATA);
const sessions = new Map<string, RpcSession>();
let sessionSeq = 0;
let mainWindow: BrowserWindow | null = null;

function customWorkspacesFile(): string {
  return path.join(app.getPath('userData'), 'workspaces.json');
}

function readCustomWorkspaces(): string[] {
  if (process.env.PIDEX_E2E_CWD) return [process.env.PIDEX_E2E_CWD];
  try {
    const raw = fs.readFileSync(customWorkspacesFile(), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((p): p is string => typeof p === 'string')
      : [];
  } catch {
    return [];
  }
}

function addCustomWorkspace(cwd: string): void {
  const existing = readCustomWorkspaces();
  if (!existing.includes(cwd)) {
    fs.writeFileSync(
      customWorkspacesFile(),
      JSON.stringify([...existing, cwd], null, 2),
    );
  }
}

function sendToRenderer(channel: string, payload: unknown) {
  mainWindow?.webContents.send(channel, payload);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: 'pidex',
    icon: path.join(app.getAppPath(), 'assets', 'icon.png'),
    backgroundColor: '#0d1116',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(
      (process.env.PIDEX_E2E_CWD && process.env.PIDEX_E2E_RENDERER_URL) ||
        'http://localhost:5173',
    );
    if (!process.env.PIDEX_E2E_CWD)
      mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('pidex:workspaces', () =>
  listWorkspaces(readCustomWorkspaces()),
);

registerWorkbench(() => mainWindow, readCustomWorkspaces, sessions);

ipcMain.handle('pidex:workspace:add', async () => {
  if (!mainWindow) return { error: 'no window' };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Add workspace',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0)
    return { error: 'cancelled' };
  const cwd = result.filePaths[0];
  addCustomWorkspace(cwd);
  return { cwd };
});

ipcMain.handle('pidex:sessions', (_e, dirName: string) => {
  if (typeof dirName !== 'string') return [];
  return listSessions(dirName);
});

ipcMain.handle(
  'pidex:session/open',
  async (
    _e,
    req: {
      cwd: string;
      sessionFile?: string;
      entryId?: string | null;
      fork?: boolean;
    },
  ) => {
    const cwd = typeof req?.cwd === 'string' ? req.cwd : '';
    let sessionFile =
      typeof req?.sessionFile === 'string' ? req.sessionFile : undefined;
    if (!cwd || !fs.existsSync(cwd)) {
      return { error: 'workspace path does not exist' };
    }
    let expectedEntryId: string | null | undefined;
    let extractedFork = false;
    if (sessionFile) {
      try {
        sessionFile = await sessionPath(sessionFile);
        const archive = await loadArchive(sessionFile);
        if (!archive.header || archive.header.version !== 3 || archive.damaged)
          throw new Error(
            'Continuing requires an intact Pi v3 archive. Open older archives in Pi to migrate them first.',
          );
        if (
          req.entryId !== undefined &&
          req.entryId !== null &&
          typeof req.entryId !== 'string'
        )
          throw new Error('Invalid selected entry.');
        const selected = selectedPath(archive, req.entryId).at(-1)?.id;
        expectedEntryId = selected ?? null;
        if (req.fork && !selected)
          throw new Error('This session has no entry to fork.');
        if (selected && (req.fork || selected !== archive.entries.at(-1)?.id)) {
          sessionFile = await forkArchive(sessionFile, selected);
          extractedFork = true;
        }
      } catch (error) {
        return {
          error:
            error instanceof Error ? error.message : 'Session unavailable.',
        };
      }
    }

    // Archive ownership is authoritative here, rather than inferred from a
    // renderer snapshot that becomes stale as soon as a prompt advances Pi.
    async function readRuntime(runtime: RpcSession, reused = false) {
      const state = await runtime.getState();
      if (!state.success || runtime.launchError())
        return {
          error:
            state.error ??
            runtime.launchError() ??
            'Could not read Pi session state.',
        };
      if (sessionFile && runtime.archiveFile !== sessionFile)
        return {
          error:
            'The open runtime switched archives. Select this archive again.',
        };
      if (
        reused &&
        (state.data as { isStreaming?: boolean } | undefined)?.isStreaming
      )
        return {
          error:
            'This archive is running in an open tab. Stop it before resuming, or fork this selection.',
        };
      if (expectedEntryId !== undefined) {
        const position = await runtime.command({
          type: 'get_entries',
          ...(expectedEntryId ? { since: expectedEntryId } : {}),
        });
        if (
          !position.success ||
          !runtimeMatchesSelection(expectedEntryId, position.data)
        )
          return {
            error:
              position.error ??
              'The runtime branch moved since selection. Refresh history and select the branch again, or fork this entry.',
          };
      }
      const messages = await runtime.getMessages();
      if (!messages.success)
        return { error: messages.error ?? 'Could not read Pi history.' };
      return {
        sessionId: runtime.id,
        state: state.data,
        messages:
          (messages.data as { messages?: unknown[] } | undefined)?.messages ??
          [],
      };
    }
    if (sessionFile && !extractedFork) {
      for (const runtime of sessions.values()) {
        // Extension commands can switch a runtime's archive. Refresh its real
        // state before deciding whether this file already has a live owner.
        const state = await runtime.getState();
        if (state.success && runtime.archiveFile === sessionFile)
          return readRuntime(runtime, true);
      }
    }

    const id = `s${++sessionSeq}`;
    let session: RpcSession;
    try {
      session = new RpcSession(id, cwd, sessionFile);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'could not start pi';
      return { error: message };
    }
    session.onEvent = (sessionId, event) =>
      sendToRenderer('pidex:session:event', { sessionId, event });
    session.onExit = (sessionId) => {
      sessions.delete(sessionId);
      sendToRenderer('pidex:session:exit', { sessionId });
    };
    sessions.set(id, session);

    if (!sessionFile) {
      const defaults = await sessionDefaults(cwd);
      if (defaults.model && defaults.provider) {
        const changed = await session.command({
          type: 'set_model',
          provider: defaults.provider,
          modelId: defaults.model,
        });
        if (!changed.success) {
          sessions.delete(id);
          session.dispose();
          return {
            error: changed.error ?? 'Could not apply the default model.',
          };
        }
      }
      const thinking = await session.command({
        type: 'set_thinking_level',
        level: defaults.thinking,
      });
      if (!thinking.success) {
        sessions.delete(id);
        session.dispose();
        return { error: thinking.error ?? 'Could not apply reasoning effort.' };
      }
    }

    const result = await readRuntime(session);
    if ('error' in result) {
      sessions.delete(id);
      session.dispose();
    }
    return result;
  },
);

ipcMain.handle(
  'pidex:session/send',
  async (_e, req: { sessionId: string; text: string; streaming: boolean }) => {
    const session = sessions.get(req?.sessionId ?? '');
    if (!session) return { error: 'no such session' };
    const response = await session.prompt(
      String(req.text ?? ''),
      Boolean(req.streaming),
    );
    return { success: response.success, error: response.error };
  },
);

ipcMain.handle('pidex:session/abort', (_e, sessionId: string) => {
  sessions.get(sessionId)?.abort();
});

ipcMain.handle('pidex:session/commands', async (_e, sessionId: string) => {
  const session = sessions.get(sessionId);
  if (!session) return { commands: [] };
  const response = await session.getCommands();
  const data = response.data as { commands?: unknown[] } | undefined;
  return { commands: response.success ? (data?.commands ?? []) : [] };
});

ipcMain.handle('pidex:session/close', (_e, sessionId: string) => {
  const session = sessions.get(sessionId);
  if (session) {
    sessions.delete(sessionId);
    session.dispose();
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  for (const session of sessions.values()) session.dispose();
  sessions.clear();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  for (const session of sessions.values()) session.dispose();
  sessions.clear();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
