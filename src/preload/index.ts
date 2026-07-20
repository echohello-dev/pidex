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
  sessions: (dirName: string) => ipcRenderer.invoke('pidex:sessions', dirName),
  openSession: (req: { cwd: string; sessionFile?: string }) =>
    ipcRenderer.invoke('pidex:session/open', req),
  sendPrompt: (req: { sessionId: string; text: string; streaming: boolean }) =>
    ipcRenderer.invoke('pidex:session/send', req),
  abortSession: (sessionId: string) => ipcRenderer.invoke('pidex:session/abort', sessionId),
  sessionCommands: (sessionId: string) =>
    ipcRenderer.invoke('pidex:session/commands', sessionId),
  closeSession: (sessionId: string) => ipcRenderer.invoke('pidex:session/close', sessionId),
  onSessionEvent: (cb: (payload: SessionEventPayload) => void) => {
    const listener = (_event: unknown, payload: SessionEventPayload) => cb(payload);
    ipcRenderer.on('pidex:session:event', listener);
    return () => ipcRenderer.removeListener('pidex:session:event', listener);
  },
  onSessionExit: (cb: (payload: { sessionId: string }) => void) => {
    const listener = (_event: unknown, payload: { sessionId: string }) => cb(payload);
    ipcRenderer.on('pidex:session:exit', listener);
    return () => ipcRenderer.removeListener('pidex:session:exit', listener);
  },
});
