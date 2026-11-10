import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useWorkbench } from '../../src/renderer/useWorkbench';
import type { PidexApi, WorkspaceCatalog } from '../../src/renderer/api';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const catalog: WorkspaceCatalog = {
  roots: [
    {
      dirName: 'api',
      name: 'api',
      cwd: '/code/api',
      branch: 'main',
      sessionCount: 0,
      lastActive: '',
      availability: 'available',
    },
    {
      dirName: 'web',
      name: 'web',
      cwd: '/code/web',
      branch: 'web',
      sessionCount: 0,
      lastActive: '',
      availability: 'available',
    },
  ],
  groups: [{ id: 'commerce', name: 'Commerce', rootIds: ['api', 'web'] }],
  selected: { groupId: 'commerce', rootId: 'api' },
};
function apiFixture() {
  const fixture = {
    workspaceCatalog: vi
      .fn<PidexApi['workspaceCatalog']>()
      .mockResolvedValue(catalog),
    selectWorkspace: vi
      .fn<PidexApi['selectWorkspace']>()
      .mockResolvedValue(undefined),
    sessions: vi.fn<PidexApi['sessions']>().mockResolvedValue([]),
    settings: vi.fn<PidexApi['settings']>().mockResolvedValue({
      data: { model: '', provider: '', thinking: 'medium' },
    }),
    models: vi.fn<PidexApi['models']>().mockResolvedValue({ data: [] }),
    inspectWorkspace: vi
      .fn<PidexApi['inspectWorkspace']>()
      .mockResolvedValue({ data: { branch: '', files: [], changes: [] } }),
    sessionTree: vi.fn<PidexApi['sessionTree']>(),
    previewSession: vi.fn<PidexApi['previewSession']>(),
    onSessionEvent: vi.fn<PidexApi['onSessionEvent']>(() => () => {}),
    onSessionExit: vi.fn<PidexApi['onSessionExit']>(() => () => {}),
  } satisfies Partial<PidexApi>;
  vi.stubGlobal('pidex', fixture);
  return fixture;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('workbench root switching', () => {
  it('settles unfinished tool cards when their runtime exits', async () => {
    const fixture = apiFixture();
    const openSession = vi
      .fn<PidexApi['openSession']>()
      .mockResolvedValue({ sessionId: 'runtime' });
    const sessionCommands = vi
      .fn<PidexApi['sessionCommands']>()
      .mockResolvedValue({ commands: [] });
    Object.assign(fixture, { openSession, sessionCommands });
    const { result } = renderHook(useWorkbench);
    await waitFor(() => expect(result.current.ws?.name).toBe('api'));
    act(() =>
      result.current.showSession({
        cwd: '/code/api',
        id: 'archive',
        file: '/sessions/archive.jsonl',
        title: 'Build',
        model: '',
        timestamp: '',
        messageCount: 0,
      }),
    );
    await waitFor(() => expect(result.current.tabs).toHaveLength(1));
    const onEvent = fixture.onSessionEvent.mock.calls[0][0];
    const onExit = fixture.onSessionExit.mock.calls[0][0];
    act(() => {
      onEvent({
        sessionId: 'runtime',
        event: {
          type: 'tool_execution_start',
          toolCallId: 'build',
          toolName: 'bash',
          args: { command: 'build' },
        },
      });
      onEvent({
        sessionId: 'runtime',
        event: {
          type: 'tool_execution_update',
          toolCallId: 'build',
          partialResult: { content: [{ type: 'text', text: 'Partial build' }] },
        },
      });
      onExit({ sessionId: 'other-runtime' });
    });
    expect(result.current.tabs[0].entries[0]).toMatchObject({ running: true });
    act(() => onExit({ sessionId: 'runtime' }));
    expect(result.current.tabs[0]).toMatchObject({
      running: false,
      exited: true,
    });
    expect(result.current.tabs[0].entries[0]).toMatchObject({
      running: false,
      interrupted: true,
      output: 'Partial build',
    });
  });

  it('rejects late catalog, file, model and defaults results from a previous root', async () => {
    const fixture = apiFixture();
    const oldCatalog = deferred<WorkspaceCatalog>();
    const oldFiles =
      deferred<Awaited<ReturnType<PidexApi['inspectWorkspace']>>>();
    const oldModels = deferred<Awaited<ReturnType<PidexApi['models']>>>();
    const oldDefaults = deferred<Awaited<ReturnType<PidexApi['settings']>>>();
    fixture.inspectWorkspace.mockImplementation((cwd) =>
      cwd === '/code/api'
        ? oldFiles.promise
        : Promise.resolve({
            data: { branch: 'web', files: ['web-only.ts'], changes: [] },
          }),
    );
    fixture.models.mockImplementation((cwd) =>
      cwd === '/code/api'
        ? oldModels.promise
        : Promise.resolve({
            data: [{ id: 'web-model', name: 'Web model', provider: 'test' }],
          }),
    );
    fixture.settings.mockImplementation((cwd) =>
      cwd === '/code/api'
        ? oldDefaults.promise
        : Promise.resolve({
            data: { model: '', provider: '', thinking: 'low' },
          }),
    );
    const { result } = renderHook(useWorkbench);
    await waitFor(() => expect(result.current.ws?.name).toBe('api'));
    fixture.workspaceCatalog.mockImplementationOnce(() => oldCatalog.promise);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    act(() => result.current.selectWorkspace(catalog.roots[1]));
    await waitFor(() =>
      expect(result.current.details.files).toEqual(['web-only.ts']),
    );
    await act(async () => {
      oldCatalog.resolve({
        ...catalog,
        roots: catalog.roots.map((r) => ({ ...r, name: 'Stale root' })),
        groups: [{ ...catalog.groups[0], name: 'Stale group' }],
      });
      oldFiles.resolve({
        data: { branch: 'api', files: ['api-only.ts'], changes: [] },
      });
      oldModels.resolve({
        data: [{ id: 'api-model', name: 'API model', provider: 'test' }],
      });
      oldDefaults.resolve({
        data: { model: '', provider: '', thinking: 'high' },
      });
    });
    expect(result.current.ws?.name).toBe('web');
    expect(result.current.groups[0].name).toBe('Commerce');
    expect(result.current.details.files).toEqual(['web-only.ts']);
    expect(result.current.models.map((m) => m.id)).toEqual(['web-model']);
    expect(result.current.defaults.thinking).toBe('low');
  });

  it('ignores a delayed Git mutation result after switching roots, including a round trip', async () => {
    const fixture = apiFixture();
    fixture.inspectWorkspace.mockImplementation((cwd) =>
      Promise.resolve({
        data: {
          branch: cwd,
          changes: [],
          files: [cwd === '/code/api' ? 'api.ts' : 'web.ts'],
        },
      }),
    );
    const { result } = renderHook(useWorkbench);
    await waitFor(() =>
      expect(result.current.details.files).toEqual(['api.ts']),
    );
    act(() => result.current.navigate('changes'));
    const completeApiMutation = result.current.setDetails;
    act(() => result.current.selectWorkspace(catalog.roots[1]));
    act(() => result.current.navigate('changes'));
    await waitFor(() =>
      expect(result.current.details.files).toEqual(['web.ts']),
    );
    act(() =>
      completeApiMutation({
        branch: 'stale-api',
        changes: [],
        files: ['stale-api.ts'],
      }),
    );
    expect(result.current.details.files).toEqual(['web.ts']);
    act(() => result.current.selectWorkspace(catalog.roots[0]));
    await waitFor(() =>
      expect(result.current.details.files).toEqual(['api.ts']),
    );
    act(() =>
      completeApiMutation({
        branch: 'stale-api',
        changes: [],
        files: ['stale-api.ts'],
      }),
    );
    expect(result.current.details.files).toEqual(['api.ts']);
    act(() =>
      result.current.setDetails({
        branch: 'fresh-api',
        changes: [],
        files: ['fresh-api.ts'],
      }),
    );
    expect(result.current.details.files).toEqual(['fresh-api.ts']);
  });

  it.each(['tree', 'messages'])(
    'reloads the saved archive and entry after switching away during %s loading',
    async (phase) => {
      const fixture = apiFixture();
      const source = {
        cwd: '/code/api',
        id: 'archive',
        file: '/sessions/archive.jsonl',
        title: 'Saved selection',
        model: '',
        timestamp: '',
        messageCount: 1,
      };
      const tree = { leafId: 'selected-entry', canContinue: true, nodes: [] };
      const oldTree = deferred<Awaited<ReturnType<PidexApi['sessionTree']>>>();
      const oldMessages =
        deferred<Awaited<ReturnType<PidexApi['previewSession']>>>();
      fixture.sessionTree.mockResolvedValue({ data: tree });
      fixture.previewSession.mockResolvedValue({
        data: [
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'Reloaded selected history' }],
          },
        ],
      });
      if (phase === 'tree')
        fixture.sessionTree.mockImplementationOnce(() => oldTree.promise);
      else
        fixture.previewSession.mockImplementationOnce(
          () => oldMessages.promise,
        );
      const { result } = renderHook(useWorkbench);
      await waitFor(() => expect(result.current.ws?.name).toBe('api'));
      let original!: Promise<void>;
      act(() => {
        result.current.navigate('history');
        original = result.current.showPreview(source);
      });
      await waitFor(() => expect(result.current.previewLoading).toBe(true));
      if (phase === 'messages')
        await waitFor(() =>
          expect(fixture.previewSession).toHaveBeenCalledOnce(),
        );
      act(() => result.current.selectWorkspace(catalog.roots[1]));
      await waitFor(() => expect(result.current.ws?.name).toBe('web'));
      act(() => result.current.selectWorkspace(catalog.roots[0]));
      await waitFor(() => expect(result.current.preview?.ready).toBe(true));
      expect(result.current.previewLoading).toBe(false);
      expect(result.current.preview?.entryId).toBe('selected-entry');
      expect(fixture.previewSession).toHaveBeenLastCalledWith(
        source.file,
        'selected-entry',
      );
      await act(async () => {
        oldTree.resolve({ data: tree });
        oldMessages.resolve({
          data: [
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'Stale history' }],
            },
          ],
        });
        await original;
      });
      expect(JSON.stringify(result.current.preview?.entries)).toContain(
        'Reloaded selected history',
      );
      expect(JSON.stringify(result.current.preview?.entries)).not.toContain(
        'Stale history',
      );
    },
  );

  it.each(['error', 'noncontinuable'])(
    'does not retry a completed %s preview on root restoration',
    async (kind) => {
      const fixture = apiFixture();
      const source = {
        cwd: '/code/api',
        id: 'archive',
        file: '/sessions/archive.jsonl',
        title: 'Unavailable continuation',
        model: '',
        timestamp: '',
        messageCount: 0,
      };
      if (kind === 'error')
        fixture.sessionTree.mockRejectedValue(new Error('Archive unavailable'));
      else
        fixture.sessionTree.mockResolvedValue({
          data: { leafId: null, canContinue: false, nodes: [] },
        });
      fixture.previewSession.mockResolvedValue({ data: [] });
      const { result } = renderHook(useWorkbench);
      await waitFor(() => expect(result.current.ws?.name).toBe('api'));
      await act(async () => {
        result.current.navigate('history');
        await result.current.showPreview(source, null);
      });
      expect(result.current.preview?.ready).toBe(false);
      act(() => result.current.selectWorkspace(catalog.roots[1]));
      act(() => result.current.selectWorkspace(catalog.roots[0]));
      expect(result.current.previewLoading).toBe(false);
      expect(fixture.sessionTree).toHaveBeenCalledOnce();
      if (kind === 'noncontinuable')
        expect(fixture.previewSession).toHaveBeenCalledWith(source.file, null);
    },
  );

  it('restores independent drafts and views without starting or closing runtimes', async () => {
    const fixture = apiFixture();
    const { result } = renderHook(useWorkbench);
    await waitFor(() => expect(result.current.ws?.name).toBe('api'));
    act(() => result.current.onDraft('API draft'));
    act(() => result.current.navigate('files'));
    act(() => result.current.selectWorkspace(catalog.roots[1]));
    expect(result.current.draft).toBe('');
    act(() => result.current.onDraft('Web draft'));
    act(() => result.current.selectWorkspace(catalog.roots[0]));
    expect(result.current.view).toBe('files');
    expect(result.current.draft).toBe('API draft');
    act(() => result.current.selectWorkspace(catalog.roots[1]));
    expect(result.current.view).toBe('new');
    expect(result.current.draft).toBe('Web draft');
    expect(result.current.tabs).toHaveLength(0);
    expect(fixture.selectWorkspace).toHaveBeenCalledWith('commerce', 'web');
  });
});
