import { contextBridge, ipcRenderer } from 'electron';

type SessionEventPayload = {
  sessionId: string;
  event: Record<string, unknown> & { type: string };
};

contextBridge.exposeInMainWorld('pidex', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
  },
  workspaces: () => ipcRenderer.invoke('pidex:workspaces'),
  addWorkspace: () => ipcRenderer.invoke('pidex:workspace:add'),
  inspectWorkspace: (cwd: string) =>
    ipcRenderer.invoke('pidex:workspace:inspect', cwd),
  readFile: (cwd: string, file: string) =>
    ipcRenderer.invoke('pidex:workspace:read', cwd, file),
  filePatch: (cwd: string, file: string, staged: boolean, untracked: boolean) =>
    ipcRenderer.invoke('pidex:workspace:patch', cwd, file, staged, untracked),
  gitAction: (cwd: string, action: string, file?: string) =>
    ipcRenderer.invoke('pidex:workspace:git', cwd, action, file),
  previewSession: (file: string) =>
    ipcRenderer.invoke('pidex:session:preview', file),
  skills: (cwd: string) => ipcRenderer.invoke('pidex:workspace:skills', cwd),
  openProject: (cwd: string) => ipcRenderer.invoke('pidex:workspace:open', cwd),
  attachFiles: () => ipcRenderer.invoke('pidex:workspace:attach'),
  settings: (cwd: string) => ipcRenderer.invoke('pidex:settings:get', cwd),
  saveSettings: (cwd: string, value: unknown) =>
    ipcRenderer.invoke('pidex:settings:save', cwd, value),
  manageProviders: () => ipcRenderer.invoke('pidex:settings:providers'),
  models: (cwd: string) => ipcRenderer.invoke('pidex:models:list', cwd),
  setModel: (id: string, provider: string, model: string) =>
    ipcRenderer.invoke('pidex:session:model', id, provider, model),
  sessions: (dirName: string) => ipcRenderer.invoke('pidex:sessions', dirName),
  openSession: (req: { cwd: string; sessionFile?: string; fork?: boolean }) =>
    ipcRenderer.invoke('pidex:session/open', req),
  sendPrompt: (req: { sessionId: string; text: string; streaming: boolean }) =>
    ipcRenderer.invoke('pidex:session/send', req),
  abortSession: (sessionId: string) =>
    ipcRenderer.invoke('pidex:session/abort', sessionId),
  sessionCommands: (sessionId: string) =>
    ipcRenderer.invoke('pidex:session/commands', sessionId),
  closeSession: (sessionId: string) =>
    ipcRenderer.invoke('pidex:session/close', sessionId),
  onSessionEvent: (cb: (payload: SessionEventPayload) => void) => {
    const listener = (_event: unknown, payload: SessionEventPayload) =>
      cb(payload);
    ipcRenderer.on('pidex:session:event', listener);
    return () => ipcRenderer.removeListener('pidex:session:event', listener);
  },
  onSessionExit: (cb: (payload: { sessionId: string }) => void) => {
    const listener = (_event: unknown, payload: { sessionId: string }) =>
      cb(payload);
    ipcRenderer.on('pidex:session:exit', listener);
    return () => ipcRenderer.removeListener('pidex:session:exit', listener);
  },
});
