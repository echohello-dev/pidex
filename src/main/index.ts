import {
  forkArchive,
  loadArchive,
  selectedPath,
  runtimeMatchesSelection,
} from './session-tree';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  sessionsForRoot,
  matchingSessions,
  discoverSessions,
  listWorkspaces,
  canonicalCwd,
  parseSession,
} from './sessions';
import { WorkspaceRegistry, availability } from './workspaces';
import { sessionPath } from './workbench';
import { RpcSession } from './rpc';
import { registerWorkbench } from './workbench-ipc';

const isDev = !app.isPackaged;
if (isDev && process.env.PIDEX_E2E_USER_DATA)
  app.setPath('userData', process.env.PIDEX_E2E_USER_DATA);
const sessions = new Map<string, RpcSession>();
let sessionSeq = 0;
let mainWindow: BrowserWindow | null = null;

let registry: WorkspaceRegistry | undefined;
function workspaceRegistry(): WorkspaceRegistry {
  registry ??= new WorkspaceRegistry(
    app.getPath('userData'),
    discoverSessions(),
    process.env.PIDEX_E2E_CWD ? [process.env.PIDEX_E2E_CWD] : [],
  );
  return registry;
}
async function catalog() {
  const registry = workspaceRegistry();
  const archives = discoverSessions();
  registry.discover(archives.map((s) => s.cwd));
  const state = registry.snapshot();
  const summaries = await listWorkspaces(state.roots.map((r) => r.path));
  return {
    groups: state.groups,
    selected: state.selected,
    roots: state.roots.map((r) => ({
      ...summaries.find((w) => w.cwd === canonicalCwd(r.path))!,
      sessionCount: matchingSessions(r.path, r.aliases, archives).filter(
        (s) => registry.resolve(s.cwd, false).id === r.id,
      ).length,
      dirName: r.id,
      cwd: r.path,
      availability: availability(r.path),
    })),
  };
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
      (process.env.PIDEX_E2E_USER_DATA && process.env.PIDEX_E2E_RENDERER_URL) ||
        'http://localhost:5173',
    );
    if (!process.env.PIDEX_E2E_USER_DATA)
      mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('pidex:workspaces', async () => (await catalog()).roots);
ipcMain.handle('pidex:workspace:catalog', () => catalog());
ipcMain.handle('pidex:workspace:group', async (_e, req) => {
  workspaceRegistry().saveGroup(
    req?.id,
    req?.name,
    req?.rootIds,
    req?.expectedRoots,
  );
  return catalog();
});
ipcMain.handle('pidex:workspace:select', (_e, groupId, rootId) => {
  workspaceRegistry().select(groupId, rootId);
});
registerWorkbench(() => mainWindow, workspaceRegistry, sessions, runtimeRoot);

ipcMain.handle('pidex:workspace:add', async (_e, groupId?: string) => {
  if (!mainWindow) return { error: 'no window' };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Add root',
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0)
    return { error: 'cancelled' };
  try {
    const root = workspaceRegistry().add(result.filePaths[0], groupId);
    return { cwd: root.path };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not add root.',
    };
  }
});
ipcMain.handle('pidex:sessions', (_e, rootId: string) => {
  const root = workspaceRegistry().resolve(rootId, false);
  return sessionsForRoot(root.path, undefined, root.aliases).filter(
    (s) => workspaceRegistry().resolve(s.cwd, false).id === root.id,
  );
});

// Serialize opens so concurrent IPC requests cannot start two writers for one archive.
let openingSession: Promise<unknown> = Promise.resolve();
async function runtimeRoot(runtime: RpcSession) {
  const state = await runtime.getState();
  if (!state.success)
    throw new Error(state.error ?? 'Could not verify session ownership.');
  const owner = workspaceRegistry().resolve(runtime.cwd);
  if (runtime.archiveFile) {
    const header = parseSession(runtime.archiveFile);
    if (!header && runtime.hasUnpersistedArchive()) return;
    if (
      !header ||
      canonicalCwd(header.cwd) !== runtime.cwd ||
      workspaceRegistry().resolve(header.cwd, false).id !== owner.id
    )
      throw new Error(
        'The runtime changed execution roots. Close this tab and resume from its owner root.',
      );
  }
}

ipcMain.handle(
  'pidex:session/open',
  (
    _e,
    req: {
      cwd: string;
      sessionFile?: string;
      entryId?: string | null;
      fork?: boolean;
    },
  ) => {
    const operation = openingSession.then(async () => {
      let cwd: string;
      let rootId: string;
      try {
        const root = workspaceRegistry().resolve(req?.cwd);
        cwd = root.path;
        rootId = root.id;
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Unknown root.',
        };
      }
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
          if (
            !archive.header ||
            archive.header.version !== 3 ||
            archive.damaged
          )
            throw new Error(
              'Continuing requires an intact Pi v3 archive. Open older archives in Pi to migrate them first.',
            );
          if (
            typeof archive.header.cwd !== 'string' ||
            canonicalCwd(archive.header.cwd) !== cwd ||
            workspaceRegistry().resolve(archive.header.cwd, false).id !== rootId
          )
            throw new Error(
              'This archive belongs to another root. Select its original folder before resuming or forking.',
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
          if (
            selected &&
            (req.fork || selected !== archive.entries.at(-1)?.id)
          ) {
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
        try {
          await runtimeRoot(runtime);
        } catch (error) {
          return {
            error:
              error instanceof Error
                ? error.message
                : 'Session ownership changed.',
          };
        }
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
          if (!state.success) {
            if (runtime.launchError()) continue;
            return {
              error: `Could not verify archive ownership. Close the unresponsive session tab before resuming. ${state.error ?? ''}`,
            };
          }
          if (runtime.archiveFile === sessionFile)
            return readRuntime(runtime, true);
        }
      }

      const id = `s${++sessionSeq}`;
      let session: RpcSession;
      try {
        session = new RpcSession(id, cwd, sessionFile);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'could not start pi';
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
        const defaults = workspaceRegistry().resolve(cwd).defaults;
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
          return {
            error: thinking.error ?? 'Could not apply reasoning effort.',
          };
        }
      }

      const result = await readRuntime(session);
      if ('error' in result) {
        sessions.delete(id);
        session.dispose();
      }
      return { ...result, cwd };
    });
    openingSession = operation.catch(() => {});
    return operation;
  },
);

ipcMain.handle(
  'pidex:session/send',
  async (_e, req: { sessionId: string; text: string; streaming: boolean }) => {
    const session = sessions.get(req?.sessionId ?? '');
    if (!session) return { error: 'no such session' };
    try {
      await runtimeRoot(session);
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : 'Session ownership changed.',
      };
    }
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
