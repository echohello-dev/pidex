type WorkspaceInfo = {
  dirName: string;
  name: string;
  cwd: string;
  branch: string;
  sessionCount: number;
  lastActive: string;
};

type SessionInfo = {
  id: string;
  file: string;
  title: string;
  model: string;
  timestamp: string;
  messageCount: number;
};

type SessionState = {
  model?: { id?: string; name?: string } | null;
  sessionFile?: string;
  sessionId?: string;
  isStreaming?: boolean;
  messageCount?: number;
};

type OpenResult = {
  sessionId?: string;
  state?: SessionState | null;
  messages?: unknown[];
  error?: string;
};

type SlashCommand = {
  name: string;
  description?: string;
  source?: string;
  location?: string;
};

type SessionEventPayload = {
  sessionId: string;
  event: Record<string, unknown> & { type: string };
};

type OpenPiApi = {
  platform: string;
  versions: { electron: string; node: string };
  workspaces: () => Promise<WorkspaceInfo[]>;
  addWorkspace: () => Promise<{ cwd?: string; error?: string }>;
  sessions: (dirName: string) => Promise<SessionInfo[]>;
  openSession: (req: { cwd: string; sessionFile?: string }) => Promise<OpenResult>;
  sendPrompt: (req: { sessionId: string; text: string; streaming: boolean }) => Promise<{ success?: boolean; error?: string }>;
  abortSession: (sessionId: string) => Promise<void>;
  sessionCommands: (sessionId: string) => Promise<{ commands: SlashCommand[] }>;
  closeSession: (sessionId: string) => Promise<void>;
  onSessionEvent: (cb: (payload: SessionEventPayload) => void) => () => void;
  onSessionExit: (cb: (payload: { sessionId: string }) => void) => () => void;
};

declare global {
  interface Window {
    pidex: OpenPiApi;
  }
}

export type { WorkspaceInfo, SessionInfo, SessionState, OpenResult, SessionEventPayload, OpenPiApi, SlashCommand };
