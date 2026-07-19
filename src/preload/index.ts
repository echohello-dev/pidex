import { contextBridge, ipcRenderer } from 'electron';

type SessionEventPayload = {
  sessionId: string;
  event: Record<string, unknown> & { type: string };
};

contextBridge.exposeInMainWorld('openpi', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
  },
  workspaces: () => ipcRenderer.invoke('openpi:workspaces'),
  sessions: (dirName: string) => ipcRenderer.invoke('openpi:sessions', dirName),
  openSession: (req: { cwd: string; sessionFile?: string }) =>
    ipcRenderer.invoke('openpi:session/open', req),
  sendPrompt: (req: { sessionId: string; text: string; streaming: boolean }) =>
    ipcRenderer.invoke('openpi:session/send', req),
  abortSession: (sessionId: string) => ipcRenderer.invoke('openpi:session/abort', sessionId),
  closeSession: (sessionId: string) => ipcRenderer.invoke('openpi:session/close', sessionId),
  onSessionEvent: (cb: (payload: SessionEventPayload) => void) => {
    const listener = (_event: unknown, payload: SessionEventPayload) => cb(payload);
    ipcRenderer.on('openpi:session:event', listener);
    return () => ipcRenderer.removeListener('openpi:session:event', listener);
  },
  onSessionExit: (cb: (payload: { sessionId: string }) => void) => {
    const listener = (_event: unknown, payload: { sessionId: string }) => cb(payload);
    ipcRenderer.on('openpi:session:exit', listener);
    return () => ipcRenderer.removeListener('openpi:session:exit', listener);
  },
});
