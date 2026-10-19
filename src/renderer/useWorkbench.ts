import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { prepare, layout } from '@chenglou/pretext';
import { applyEvent, entriesFromMessages, type Entry } from './timeline';
import type {
  Defaults,
  ModelInfo,
  Result,
  SessionInfo,
  SlashCommand,
  WorkspaceDetails,
  WorkspaceInfo,
} from './api';

export type View =
  'new' | 'session' | 'changes' | 'history' | 'settings' | 'skills' | 'files';
type SessionTab = {
  runtimeId: string;
  file?: string;
  cwd: string;
  title: string;
  model: string;
  entries: Entry[];
  commands: SlashCommand[];
  running: boolean;
  exited: boolean;
};
export const DEFAULTS: Defaults = {
  model: '',
  provider: '',
  thinking: 'medium',
};
const EMPTY_DETAILS: WorkspaceDetails = { branch: '', changes: [], files: [] };

export function timeAgo(iso: string): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return 'local';
  const seconds = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export function unwrap<T>(result: Result<T>): T {
  if (result.error) throw new Error(result.error);
  return result.data as T;
}

export function useWorkbench() {
  const api = window.pidex;
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [selected, setSelected] = useState('');
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [view, setView] = useState<View>('new');
  const [tabs, setTabs] = useState<SessionTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    info: SessionInfo;
    entries: Entry[];
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelError, setModelError] = useState('');
  const [defaults, setDefaults] = useState(DEFAULTS);
  const [fontReady, setFontReady] = useState(false);
  const currentCwd = useRef('');
  const previewSeq = useRef(0);
  const opening = useRef(false);
  const sending = useRef(false);
  const exitedSessions = useRef(new Set<string>());
  const ws = workspaces.find((w) => w.dirName === selected);
  const active =
    tabs.find((t) => t.runtimeId === activeId && t.cwd === ws?.cwd) ?? null;
  const draftKey =
    view === 'history'
      ? `preview:${preview?.info.file ?? ''}`
      : active && view !== 'new'
        ? active.runtimeId
        : `new:${ws?.cwd ?? ''}`;
  const draft = drafts[draftKey] ?? '';
  currentCwd.current = ws?.cwd ?? '';
  const onDraft = (value: string) =>
    setDrafts((prev) => ({ ...prev, [draftKey]: value }));
  const report = useCallback(
    (e: unknown) =>
      setError(e instanceof Error ? e.message : 'The action failed.'),
    [],
  );
  const run = (action: () => Promise<unknown>) => {
    setError('');
    void action().catch(report);
  };

  useEffect(() => {
    let cancelled = false;
    if (!api) {
      setError(
        'Open pidex in the desktop app to connect to your local workspaces.',
      );
      setLoading(false);
      return;
    }
    api
      .workspaces()
      .then((list) => {
        if (cancelled) return;
        setWorkspaces(list);
        setSelected(list[0]?.dirName ?? '');
      })
      .catch(report)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, report]);

  useEffect(() => {
    if (!api) return;
    const offEvent = api.onSessionEvent(({ sessionId, event }) => {
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.runtimeId !== sessionId) return tab;
          const next = applyEvent(tab.entries, event);
          return {
            ...tab,
            entries: next.entries,
            running: next.running ?? tab.running,
          };
        }),
      );
    });
    const offExit = api.onSessionExit(({ sessionId }) => {
      exitedSessions.current.add(sessionId);
      setTabs((prev) =>
        prev.map((tab) =>
          tab.runtimeId === sessionId
            ? { ...tab, running: false, exited: true }
            : tab,
        ),
      );
    });
    return () => {
      offEvent();
      offExit();
    };
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    setDetails(EMPTY_DETAILS);
    setSessions([]);
    setPreview(null);
    setModels([]);
    setModelsLoading(Boolean(ws));
    setModelError('');
    setDefaults(DEFAULTS);
    previewSeq.current++;
    if (!ws || !api) return;
    api
      .sessions(ws.dirName)
      .then((s) => {
        if (!cancelled) setSessions(s);
      })
      .catch(report);
    api
      .inspectWorkspace(ws.cwd)
      .then((r) => {
        if (!cancelled) setDetails(unwrap(r));
      })
      .catch(report);
    api
      .settings(ws.cwd)
      .then((r) => {
        if (!cancelled) setDefaults(unwrap(r));
      })
      .catch(report);
    api
      .models(ws.cwd)
      .then((r) => {
        if (!cancelled) setModels(unwrap(r));
      })
      .catch((e) => {
        if (!cancelled)
          setModelError(e instanceof Error ? e.message : 'Models unavailable.');
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ws?.cwd, ws?.dirName, api, report]);

  const refresh = useCallback(async () => {
    if (!ws) return;
    const result = await api.inspectWorkspace(ws.cwd);
    if (currentCwd.current === ws.cwd) setDetails(unwrap(result));
    const list = await api.sessions(ws.dirName);
    if (currentCwd.current === ws.cwd) setSessions(list);
  }, [api, ws]);
  useEffect(() => {
    if (!ws) return;
    const update = () => {
      void refresh().catch(report);
    };
    const interval = window.setInterval(update, 15_000);
    window.addEventListener('focus', update);
    update();
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', update);
    };
  }, [view, active?.running, refresh, report, ws]);

  useEffect(() => {
    if (!document.fonts?.load) {
      setFontReady(true);
      return;
    }
    void document.fonts.load('400 18px Newsreader').then(
      () => setFontReady(true),
      () => setFontReady(true),
    );
  }, []);
  const measuredRows = useMemo(
    () =>
      !fontReady
        ? 0
        : (active?.entries ?? []).reduce((rows, entry) => {
            if (entry.kind === 'tool' || !entry.text) return rows;
            return (
              rows +
              layout(prepare(entry.text, '400 18px Newsreader'), 780, 28)
                .lineCount
            );
          }, 0),
    [active?.entries, fontReady],
  );

  const navigate = (next: View) => {
    setView(next);
    setError('');
  };
  const selectWorkspace = (workspace: WorkspaceInfo) => {
    setSelected(workspace.dirName);
    setView('new');
    setActiveId(null);
    setError('');
  };
  const addWorkspace = async () => {
    try {
      setError('');
      const result = await api.addWorkspace();
      if (result.error === 'cancelled') return;
      if (result.error) throw new Error(result.error);
      const list = await api.workspaces();
      setWorkspaces(list);
      const added = list.find((w) => w.cwd === result.cwd);
      if (added) selectWorkspace(added);
    } catch (e) {
      report(e);
    }
  };

  const openSession = async (
    info?: SessionInfo,
    fork = false,
  ): Promise<SessionTab | null> => {
    if (!ws || opening.current) return null;
    const existing =
      !fork &&
      info &&
      tabs.find((t) => t.cwd === ws.cwd && t.file === info.file && !t.exited);
    if (existing) {
      setActiveId(existing.runtimeId);
      return existing;
    }
    opening.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await api.openSession({
        cwd: ws.cwd,
        sessionFile: info?.file,
        fork,
      });
      if (result.error || !result.sessionId)
        throw new Error(result.error ?? 'Could not open this session.');
      const id = result.sessionId;
      if (currentCwd.current !== ws.cwd) {
        await api.closeSession(id);
        return null;
      }
      // Mount before loading commands so live events cannot be lost while that request runs.
      const tab: SessionTab = {
        runtimeId: id,
        cwd: ws.cwd,
        file: fork
          ? result.state?.sessionFile
          : (info?.file ?? result.state?.sessionFile),
        title: info ? `${info.title}${fork ? ' (fork)' : ''}` : 'New session',
        model: result.state?.model?.id ?? info?.model ?? '',
        entries: entriesFromMessages(result.messages ?? []),
        commands: [],
        running: Boolean(result.state?.isStreaming),
        exited: exitedSessions.current.has(id),
      };
      setTabs((prev) => [...prev, tab]);
      setActiveId(id);
      void api
        .sessionCommands(id)
        .then((r) =>
          setTabs((prev) =>
            prev.map((t) =>
              t.runtimeId === id ? { ...t, commands: r.commands } : t,
            ),
          ),
        )
        .catch(report);
      return tab;
    } finally {
      opening.current = false;
      setBusy(false);
    }
  };
  const showSession = (info: SessionInfo) =>
    run(async () => {
      const tab = await openSession(info);
      if (tab) setView('session');
    });
  const forkSession = () =>
    preview &&
    run(async () => {
      const tab = await openSession(preview.info, true);
      if (tab) setView('session');
    });
  const showPreview = useCallback(
    async (info: SessionInfo) => {
      const seq = ++previewSeq.current;
      setPreview({ info, entries: [] });
      setPreviewLoading(true);
      setError('');
      try {
        const messages = unwrap(await api.previewSession(info.file));
        if (previewSeq.current === seq)
          setPreview({ info, entries: entriesFromMessages(messages) });
      } catch (e) {
        if (previewSeq.current === seq) report(e);
      } finally {
        if (previewSeq.current === seq) setPreviewLoading(false);
      }
    },
    [api, report],
  );
  useEffect(() => {
    if (view === 'history' && !preview && sessions[0])
      void showPreview(sessions[0]);
  }, [view, sessions, preview, showPreview]);

  const send = (raw?: string) =>
    run(async () => {
      const text = (raw ?? draft).trim();
      if (!text || busy || !ws || sending.current) return;
      sending.current = true;
      try {
        let tab = view === 'new' ? null : active;
        if (view === 'history' && preview)
          tab = await openSession(preview.info);
        else if (!tab || tab.exited) tab = await openSession();
        if (!tab || tab.exited) return;
        const key = `local-${crypto.randomUUID()}`;
        const id = tab.runtimeId;
        setDrafts((prev) => ({ ...prev, [draftKey]: '' }));
        setTabs((prev) =>
          prev.map((t) =>
            t.runtimeId === id
              ? {
                  ...t,
                  title:
                    t.title === 'New session' ? text.slice(0, 90) : t.title,
                  running: true,
                  entries: [...t.entries, { key, kind: 'user', text }],
                }
              : t,
          ),
        );
        setView('session');
        try {
          const result = await api.sendPrompt({
            sessionId: id,
            text,
            streaming: tab.running,
          });
          if (result.error || !result.success)
            throw new Error(result.error ?? 'Pi did not accept the prompt.');
        } catch (e) {
          setDrafts((prev) => ({ ...prev, [id]: prev[id] || text }));
          setTabs((prev) =>
            prev.map((t) =>
              t.runtimeId === id
                ? {
                    ...t,
                    running: tab!.running,
                    entries: t.entries.filter((entry) => entry.key !== key),
                  }
                : t,
            ),
          );
          throw e;
        }
      } finally {
        sending.current = false;
      }
    });
  const changeModel = (value: string) =>
    run(async () => {
      const chosen = models.find((m) => `${m.provider}/${m.id}` === value);
      if (active && view !== 'new' && chosen) {
        unwrap(
          await api.setModel(active.runtimeId, chosen.provider, chosen.id),
        );
        setTabs((prev) =>
          prev.map((t) =>
            t.runtimeId === active.runtimeId ? { ...t, model: chosen.id } : t,
          ),
        );
      } else if (ws)
        setDefaults(
          unwrap(
            await api.saveSettings(ws.cwd, {
              ...defaults,
              model: chosen?.id ?? '',
              provider: chosen?.provider ?? '',
            }),
          ),
        );
    });
  const useSkill = (text: string) => {
    setView('new');
    setDrafts((prev) => ({ ...prev, [`new:${ws?.cwd ?? ''}`]: text }));
  };
  const closeSession = () =>
    active &&
    run(async () => {
      await api.closeSession(active.runtimeId);
      setTabs((prev) => prev.filter((t) => t.runtimeId !== active.runtimeId));
      setActiveId(null);
      navigate('new');
    });
  const attach = () =>
    run(async () => {
      const files = unwrap(await api.attachFiles());
      if (files.length)
        onDraft(
          `${draft}${draft ? '\n' : ''}${files.map((f) => `@${f}`).join('\n')}`,
        );
    });
  const sessionModel =
    view === 'history' ? (preview?.info.model ?? '') : (active?.model ?? '');
  const currentModelInfo = models.find((m) => m.id === sessionModel);
  const currentModel =
    view === 'new' || (!active && view !== 'history')
      ? defaults.model
        ? `${defaults.provider}/${defaults.model}`
        : ''
      : currentModelInfo
        ? `${currentModelInfo.provider}/${sessionModel}`
        : sessionModel;

  return {
    api,
    workspaces,
    selected,
    ws,
    sessions,
    details,
    setDetails,
    view,
    navigate,
    tabs,
    active,
    setActiveId,
    preview,
    previewLoading,
    showPreview,
    busy,
    loading,
    error,
    setError,
    models,
    modelsLoading,
    modelError,
    defaults,
    setDefaults,
    draft,
    onDraft,
    send,
    attach,
    changeModel,
    currentModel,
    measuredRows,
    report,
    run,
    refresh,
    selectWorkspace,
    addWorkspace,
    showSession,
    closeSession,
    forkSession,
    useSkill,
  };
}
