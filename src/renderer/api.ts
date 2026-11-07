import type { WorkspaceGroup, Availability } from '../main/workspaces';
import type { SessionTree } from '../main/session-tree';
import type {
  Defaults,
  GitChange,
  SkillInfo,
  WorkspaceDetails,
} from '../main/workbench';

type Result<T> = { data?: T; error?: string };
type ModelInfo = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
};

type WorkspaceInfo = {
  availability: Availability;
  dirName: string;
  name: string;
  cwd: string;
  branch: string;
  sessionCount: number;
  lastActive: string;
};

type SessionInfo = {
  cwd: string;
  id: string;
  file: string;
  title: string;
  model: string;
  timestamp: string;
  messageCount: number;
  parentSession?: string;
};

type SessionState = {
  model?: { id?: string; name?: string } | null;
  sessionFile?: string;
  sessionId?: string;
  isStreaming?: boolean;
  messageCount?: number;
};

type OpenResult = {
  cwd?: string;
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

type WorkspaceCatalog = {
  roots: WorkspaceInfo[];
  groups: WorkspaceGroup[];
  selected?: { groupId: string; rootId: string };
};
type GroupInput = {
  id?: string;
  name: string;
  rootIds: string[];
  expectedRoots?: string[];
};
type PidexApi = {
  platform: string;
  versions: { electron: string; node: string };
  workspaces: () => Promise<WorkspaceInfo[]>;
  workspaceCatalog: () => Promise<WorkspaceCatalog>;
  saveWorkspaceGroup: (group: GroupInput) => Promise<WorkspaceCatalog>;
  selectWorkspace: (groupId: string, rootId: string) => Promise<void>;
  addWorkspace: (groupId?: string) => Promise<{ cwd?: string; error?: string }>;
  inspectWorkspace: (cwd: string) => Promise<Result<WorkspaceDetails>>;
  readFile: (cwd: string, file: string) => Promise<Result<string>>;
  filePatch: (
    cwd: string,
    file: string,
    staged: boolean,
    untracked: boolean,
  ) => Promise<Result<string>>;
  gitAction: (
    cwd: string,
    action: 'stage' | 'stage-all' | 'unstage' | 'commit',
    file?: string,
  ) => Promise<Result<WorkspaceDetails>>;
  sessionTree: (file: string) => Promise<Result<SessionTree>>;
  previewSession: (
    file: string,
    entryId?: string | null,
  ) => Promise<Result<unknown[]>>;
  skills: (cwd: string) => Promise<Result<SkillInfo[]>>;
  openProject: (cwd: string) => Promise<Result<void>>;
  attachFiles: () => Promise<Result<string[]>>;
  settings: (cwd: string) => Promise<Result<Defaults>>;
  saveSettings: (cwd: string, value: Defaults) => Promise<Result<Defaults>>;
  manageProviders: () => Promise<Result<void>>;
  models: (cwd: string) => Promise<Result<ModelInfo[]>>;
  setModel: (
    id: string,
    provider: string,
    model: string,
  ) => Promise<Result<void>>;
  sessions: (dirName: string) => Promise<SessionInfo[]>;
  openSession: (req: {
    cwd: string;
    sessionFile?: string;
    entryId?: string | null;
    fork?: boolean;
  }) => Promise<OpenResult>;
  sendPrompt: (req: {
    sessionId: string;
    text: string;
    streaming: boolean;
  }) => Promise<{ success?: boolean; error?: string }>;
  abortSession: (sessionId: string) => Promise<void>;
  sessionCommands: (sessionId: string) => Promise<{ commands: SlashCommand[] }>;
  closeSession: (sessionId: string) => Promise<void>;
  onSessionEvent: (cb: (payload: SessionEventPayload) => void) => () => void;
  onSessionExit: (cb: (payload: { sessionId: string }) => void) => () => void;
};

declare global {
  interface Window {
    pidex: PidexApi;
  }
}

export type {
  WorkspaceInfo,
  WorkspaceCatalog,
  WorkspaceGroup,
  GroupInput,
  SessionInfo,
  SessionState,
  OpenResult,
  SessionEventPayload,
  PidexApi,
  SlashCommand,
};
export type {
  Defaults,
  GitChange,
  SkillInfo,
  WorkspaceDetails,
  ModelInfo,
  Result,
};
