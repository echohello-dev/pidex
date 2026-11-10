import type { SessionTree } from '../main/session-tree';
import { useCallback, useEffect, useRef, useState } from 'react';
import { applyEvent, entriesFromMessages, type Entry } from './timeline';
import type {
  Defaults,
  ModelInfo,
  Result,
  SessionInfo,
  SlashCommand,
  WorkspaceDetails,
  WorkspaceInfo,
  WorkspaceGroup,
  GroupInput,
} from './api';

export type View =
  'new' | 'session' | 'changes' | 'history' | 'settings' | 'skills' | 'files';
export type SessionTab = {
  runtimeId: string;
  file?: string;
  startedAt?: string;
  cwd: string;
  title: string;
  model: string;
  entries: Entry[];
  commands: SlashCommand[];
  running: boolean;
  exited: boolean;
};
type Preview = {
  info: SessionInfo;
  entries: Entry[];
  tree?: SessionTree;
  entryId?: string | null;
  ready?: boolean;
  loaded?: boolean;
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
  const [groups, setGroups] = useState<WorkspaceGroup[]>([]);
  const [groupId, setGroupId] = useState('');
  const rootViews = useRef(
    new Map<
      string,
      { view: View; activeId: string | null; preview: Preview | null }
    >(),
  );
  const settingsDrafts = useRef(new Map<string, Defaults>());
  const generation = useRef(0);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [view, setView] = useState<View>('new');
  const [tabs, setTabs] = useState<SessionTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelError, setModelError] = useState('');
  const [defaults, setDefaults] = useState(DEFAULTS);
  const [defaultsRoot, setDefaultsRoot] = useState('');
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
      ? `preview:${preview?.info.file ?? ''}:${preview?.entryId ?? ''}`
      : active && view !== 'new'
        ? active.runtimeId
        : `new:${ws?.cwd ?? ''}`;
  const draft = drafts[draftKey] ?? '';
  currentCwd.current = ws?.cwd ?? '';
  const renderGeneration = generation.current;
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
      .workspaceCatalog()
      .then((catalog) => {
        if (cancelled) return;
        setWorkspaces(catalog.roots);
        setGroups(catalog.groups);
        const saved = catalog.selected ?? {
          groupId: catalog.groups[0]?.id ?? '',
          rootId: catalog.groups[0]?.rootIds[0] ?? '',
        };
        setGroupId(saved.groupId);
        setSelected(saved.rootId);
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
            ? {
                ...tab,
                entries: applyEvent(tab.entries, { type: 'agent_end' }).entries,
                running: false,
                exited: true,
              }
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
    setPreviewLoading(false);
    setModels([]);
    setModelsLoading(Boolean(ws));
    setModelError('');
    setDefaultsRoot('');
    previewSeq.current++;
    if (!ws || !api) return;
    api
      .sessions(ws.dirName)
      .then((s) => {
        if (!cancelled) setSessions(s);
      })
      .catch((error) => {
        if (!cancelled) report(error);
      });
    api
      .settings(ws.cwd)
      .then((r) => {
        if (!cancelled) {
          setDefaults(unwrap(r));
          setDefaultsRoot(ws.dirName);
        }
      })
      .catch((error) => {
        if (!cancelled) report(error);
      });
    if (ws.availability !== 'available') {
      setModelsLoading(false);
      return () => {
        cancelled = true;
      };
    }
    api
      .inspectWorkspace(ws.cwd)
      .then((r) => {
        if (!cancelled) setDetails(unwrap(r));
      })
      .catch((error) => {
        if (!cancelled) report(error);
      });
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
  }, [ws?.cwd, ws?.dirName, ws?.availability, api, report]);

  const refresh = useCallback(async () => {
    if (!ws) return;
    const token = generation.current;
    const catalog = await api.workspaceCatalog();
    if (token !== generation.current) return;
    const roots = catalog.roots;
    setGroups((prev) =>
      JSON.stringify(prev) === JSON.stringify(catalog.groups)
        ? prev
        : catalog.groups,
    );
    setWorkspaces((prev) =>
      JSON.stringify(prev) === JSON.stringify(roots) ? prev : roots,
    );
    const list = await api.sessions(ws.dirName);
    if (currentCwd.current === ws.cwd && token === generation.current)
      setSessions(list);
    if (ws.availability !== 'available') return;
    const result = await api.inspectWorkspace(ws.cwd);
    if (currentCwd.current === ws.cwd && token === generation.current)
      setDetails(unwrap(result));
  }, [api, ws]);
  useEffect(() => {
    if (!ws) return;
    const update = () => {
      const token = generation.current;
      void refresh().catch((error) => {
        if (token === generation.current) report(error);
      });
    };
    const interval = window.setInterval(update, 15_000);
    window.addEventListener('focus', update);
    update();
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', update);
    };
  }, [view, active?.running, refresh, report, ws]);

  const navigate = (next: View) => {
    generation.current++;
    setView(next);
    setError('');
  };
  const selectWorkspace = (workspace: WorkspaceInfo, targetGroup?: string) => {
    if (ws) rootViews.current.set(ws.dirName, { view, activeId, preview });
    generation.current++;
    currentCwd.current = workspace.cwd;
    previewSeq.current++;
    const group =
      targetGroup ??
      (
        groups.find(
          (g) => g.id === groupId && g.rootIds.includes(workspace.dirName),
        ) ?? groups.find((g) => g.rootIds.includes(workspace.dirName))
      )?.id;
    setSelected(workspace.dirName);
    setGroupId(group ?? '');
    const saved = rootViews.current.get(workspace.dirName);
    setView(saved?.view ?? 'new');
    setActiveId(saved?.activeId ?? null);
    setPreview(saved?.preview ?? null);
    setPreviewLoading(false);
    setError('');
    if (group) void api.selectWorkspace(group, workspace.dirName).catch(report);
  };
  const selectGroup = (id: string) => {
    const group = groups.find((g) => g.id === id);
    const root =
      workspaces.find(
        (w) => group?.rootIds.includes(w.dirName) && w.dirName === selected,
      ) ?? workspaces.find((w) => group?.rootIds.includes(w.dirName));
    if (root) selectWorkspace(root, id);
    else {
      if (ws) rootViews.current.set(ws.dirName, { view, activeId, preview });
      generation.current++;
      currentCwd.current = '';
      previewSeq.current++;
      setGroupId(id);
      setSelected('');
      setActiveId(null);
      setPreview(null);
      setView('new');
    }
  };
  const saveGroup = async (input: GroupInput) => {
    const token = generation.current;
    const catalog = await api.saveWorkspaceGroup(input);
    setGroups(catalog.groups);
    setWorkspaces(catalog.roots);
    const changed = catalog.groups.find((g) =>
      input.id ? g.id === input.id : !groups.some((old) => old.id === g.id),
    );
    if (!changed || token !== generation.current) return;
    const root =
      catalog.roots.find(
        (w) => w.dirName === selected && changed.rootIds.includes(w.dirName),
      ) ?? catalog.roots.find((w) => changed.rootIds.includes(w.dirName));
    if (root) selectWorkspace(root, changed.id);
    else {
      generation.current++;
      currentCwd.current = '';
      setGroupId(changed.id);
      setSelected('');
      setView('new');
      setActiveId(null);
      setPreview(null);
    }
  };
  const addWorkspace = async () => {
    try {
      setError('');
      const targetGroup = groupId;
      const token = generation.current;
      const result = await api.addWorkspace(targetGroup || undefined);
      if (result.error === 'cancelled') return;
      if (result.error) throw new Error(result.error);
      const catalog = await api.workspaceCatalog();
      setWorkspaces(catalog.roots);
      setGroups(catalog.groups);
      const added = catalog.roots.find((w) => w.cwd === result.cwd);
      if (added && token === generation.current)
        selectWorkspace(
          added,
          targetGroup ||
            catalog.groups.find((g) => g.rootIds.includes(added.dirName))?.id,
        );
    } catch (e) {
      report(e);
    }
  };
  const activateTab = (tab: SessionTab) => {
    const root = workspaces.find((w) => w.cwd === tab.cwd);
    if (!root) return;
    selectWorkspace(root);
    setActiveId(tab.runtimeId);
    setView('session');
  };

  const openSession = async (
    info?: SessionInfo,
    fork = false,
    entryId?: string | null,
  ): Promise<SessionTab | null> => {
    if (!ws || ws.availability !== 'available' || opening.current) return null;
    const token = generation.current;
    const existing =
      !fork &&
      info &&
      tabs.find((t) => t.cwd === ws.cwd && t.file === info.file && !t.exited);
    if (existing && entryId === undefined) {
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
        entryId,
      });
      if (result.error || !result.sessionId)
        throw new Error(result.error ?? 'Could not open this session.');
      const id = result.sessionId;
      const stillSelected =
        currentCwd.current === ws.cwd && token === generation.current;
      // Mount before loading commands so live events cannot be lost while that request runs.
      const tab: SessionTab = {
        runtimeId: id,
        cwd: result.cwd ?? ws.cwd,
        file: result.state?.sessionFile ?? info?.file,
        startedAt: entryId ?? undefined,
        title: info
          ? `${info.title}${fork || (result.state?.sessionFile && result.state.sessionFile !== info.file) ? ' (fork)' : ''}`
          : 'New session',
        model: result.state?.model?.id ?? info?.model ?? '',
        entries: entriesFromMessages(result.messages ?? []),
        commands: [],
        running: Boolean(result.state?.isStreaming),
        exited: exitedSessions.current.has(id),
      };
      setTabs((prev) =>
        prev.some((t) => t.runtimeId === id)
          ? prev.map((t) =>
              t.runtimeId === id
                ? t.file !== tab.file
                  ? tab
                  : {
                      ...t,
                      running: tab.running,
                      model: tab.model,
                      exited: tab.exited,
                    }
                : t,
            )
          : [...prev, tab],
      );
      if (stillSelected)
        rootViews.current.set(ws.dirName, {
          view: 'session',
          activeId: id,
          preview: null,
        });
      if (stillSelected) setActiveId(id);
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
      const token = generation.current;
      const tab = await openSession(info);
      if (tab && token === generation.current) setView('session');
    });
  const forkSession = () =>
    preview?.ready &&
    preview.tree?.canContinue &&
    run(async () => {
      const token = generation.current;
      const tab = await openSession(preview.info, true, preview.entryId);
      if (tab && token === generation.current) setView('session');
    });
  const showPreview = useCallback(
    async (info: SessionInfo, entryId?: string | null) => {
      const seq = ++previewSeq.current;
      setPreview({ info, entries: [], entryId });
      setPreviewLoading(true);
      setError('');
      try {
        const tree = unwrap(await api.sessionTree(info.file));
        const selectedId = entryId === undefined ? tree.leafId : entryId;
        if (previewSeq.current !== seq) return;
        setPreview({ info, tree, entryId: selectedId, entries: [] });
        const messages = unwrap(
          await api.previewSession(info.file, selectedId),
        );
        if (previewSeq.current === seq)
          setPreview({
            info,
            tree,
            entryId: selectedId,
            ready: tree.canContinue,
            loaded: true,
            entries: entriesFromMessages(messages),
          });
      } catch (e) {
        if (previewSeq.current === seq) {
          setPreview((current) =>
            current ? { ...current, loaded: true, ready: false } : current,
          );
          report(e);
        }
      } finally {
        if (previewSeq.current === seq) setPreviewLoading(false);
      }
    },
    [api, report],
  );
  useEffect(() => {
    if (view !== 'history' || previewLoading) return;
    if (preview && !preview.loaded)
      void showPreview(preview.info, preview.entryId);
    else if (!preview && sessions[0]) void showPreview(sessions[0]);
  }, [view, sessions, preview, previewLoading, showPreview]);

  const send = (raw?: string) =>
    run(async () => {
      const text = (raw ?? draft).trim();
      if (
        !text ||
        busy ||
        !ws ||
        sending.current ||
        (view === 'history' && !preview?.ready)
      )
        return;
      sending.current = true;
      const token = generation.current;
      try {
        let tab = view === 'new' ? null : active;
        if (view === 'history' && preview)
          tab = await openSession(
            preview.info,
            preview.entryId !== preview.tree?.leafId,
            preview.entryId,
          );
        else if (!tab || tab.exited) tab = await openSession();
        if (
          !tab ||
          tab.exited ||
          token !== generation.current ||
          currentCwd.current !== ws.cwd
        )
          return;
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
      } else if (ws) {
        const token = generation.current;
        const saved = unwrap(
          await api.saveSettings(ws.cwd, {
            ...defaults,
            model: chosen?.id ?? '',
            provider: chosen?.provider ?? '',
          }),
        );
        if (token === generation.current) setDefaults(saved);
      }
    });
  const useSkill = (text: string) => {
    setView('new');
    setDrafts((prev) => ({ ...prev, [`new:${ws?.cwd ?? ''}`]: text }));
  };
  const closeSession = () =>
    active &&
    run(async () => {
      const token = generation.current;
      await api.closeSession(active.runtimeId);
      setTabs((prev) => prev.filter((t) => t.runtimeId !== active.runtimeId));
      rootViews.current.delete(ws?.dirName ?? '');
      if (token === generation.current) {
        setActiveId(null);
        navigate('new');
      }
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
    groups,
    groupId,
    selectGroup,
    saveGroup,
    activateTab,
    settingsDrafts,
    ws,
    sessions,
    details,
    setDetails: (next: WorkspaceDetails) => {
      if (
        currentCwd.current === ws?.cwd &&
        generation.current === renderGeneration
      )
        setDetails(next);
    },
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
    defaultsRoot,
    setDefaults,
    setRootDefaults: (cwd: string, value: Defaults) => {
      const cached = settingsDrafts.current.get(cwd);
      if (
        cached &&
        cached.model === value.model &&
        cached.provider === value.provider &&
        cached.thinking === value.thinking
      )
        settingsDrafts.current.delete(cwd);
      if (currentCwd.current === cwd) setDefaults(value);
    },
    draft,
    onDraft,
    send,
    attach,
    changeModel,
    currentModel,
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
