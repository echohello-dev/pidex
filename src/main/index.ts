import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { listSessions, listWorkspaces, SESSIONS_ROOT } from './sessions';
import { RpcSession } from './rpc';

const isDev = !app.isPackaged;
const sessions = new Map<string, RpcSession>();
let sessionSeq = 0;
let mainWindow: BrowserWindow | null = null;

function customWorkspacesFile(): string {
  return path.join(app.getPath('userData'), 'workspaces.json');
}

function readCustomWorkspaces(): string[] {
  try {
    const raw = fs.readFileSync(customWorkspacesFile(), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

function addCustomWorkspace(cwd: string): void {
  const existing = readCustomWorkspaces();
  if (!existing.includes(cwd)) {
    fs.writeFileSync(customWorkspacesFile(), JSON.stringify([...existing, cwd], null, 2));
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
    title: 'OpenPi',
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
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('openpi:workspaces', () => listWorkspaces(readCustomWorkspaces()));

ipcMain.handle('openpi:workspace:add', async () => {
  if (!mainWindow) return { error: 'no window' };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Add workspace',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return { error: 'cancelled' };
  const cwd = result.filePaths[0];
  addCustomWorkspace(cwd);
  return { cwd };
});

ipcMain.handle('openpi:sessions', (_e, dirName: string) => {
  if (typeof dirName !== 'string') return [];
  return listSessions(dirName);
});

ipcMain.handle(
  'openpi:session/open',
  async (_e, req: { cwd: string; sessionFile?: string }) => {
    const cwd = typeof req?.cwd === 'string' ? req.cwd : '';
    const sessionFile = typeof req?.sessionFile === 'string' ? req.sessionFile : undefined;
    if (!cwd || !fs.existsSync(cwd)) {
      return { error: 'workspace path does not exist' };
    }
    if (sessionFile && !path.resolve(sessionFile).startsWith(SESSIONS_ROOT)) {
      return { error: 'session file outside pi sessions root' };
    }

    const id = `s${++sessionSeq}`;
    const session = new RpcSession(id, cwd, sessionFile);
    session.onEvent = (sessionId, event) => sendToRenderer('openpi:session:event', { sessionId, event });
    session.onExit = sessionId => sendToRenderer('openpi:session:exit', { sessionId });
    sessions.set(id, session);

    const [state, messages] = await Promise.all([session.getState(), session.getMessages()]);
    return {
      sessionId: id,
      state: state.success ? state.data : null,
      messages: messages.success ? (messages.data as { messages?: unknown[] })?.messages ?? [] : [],
    };
  },
);

ipcMain.handle(
  'openpi:session/send',
  async (_e, req: { sessionId: string; text: string; streaming: boolean }) => {
    const session = sessions.get(req?.sessionId ?? '');
    if (!session) return { error: 'no such session' };
    const response = await session.prompt(String(req.text ?? ''), Boolean(req.streaming));
    return { success: response.success, error: response.error };
  },
);

ipcMain.handle('openpi:session/abort', (_e, sessionId: string) => {
  sessions.get(sessionId)?.abort();
});

ipcMain.handle('openpi:session/commands', async (_e, sessionId: string) => {
  const session = sessions.get(sessionId);
  if (!session) return { commands: [] };
  const response = await session.getCommands();
  const data = response.data as { commands?: unknown[] } | undefined;
  return { commands: response.success ? data?.commands ?? [] : [] };
});

ipcMain.handle('openpi:session/close', (_e, sessionId: string) => {
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
