import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { SessionInfo } from '../api';
import type { SessionTree as Tree } from '../../main/session-tree';

function treeKeys(event: KeyboardEvent<HTMLDivElement>) {
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="treeitem"]',
    ),
  ];
  const index = items.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    event.key === 'ArrowDown'
      ? index + 1
      : event.key === 'ArrowUp'
        ? index - 1
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : -1;
  if (next >= 0 && next < items.length) {
    event.preventDefault();
    items[next].focus();
  }
}

export function sessionForest(sessions: SessionInfo[]) {
  const byFile = new Map(sessions.map((s) => [s.file, s]));
  const rows: {
    info: SessionInfo;
    depth: number;
    missing: boolean;
    cyclic: boolean;
  }[] = [];
  const seen = new Set<string>();
  const children = new Map<string, SessionInfo[]>();
  for (const s of sessions) {
    if (s.parentSession && byFile.has(s.parentSession)) {
      const list = children.get(s.parentSession) ?? [];
      list.push(s);
      children.set(s.parentSession, list);
    }
  }
  const walk = (root: SessionInfo) => {
    const stack = [{ info: root, depth: 0 }];
    while (stack.length) {
      const row = stack.pop()!;
      if (seen.has(row.info.file)) continue;
      seen.add(row.info.file);
      const chain = new Set<string>();
      let ancestor: SessionInfo | undefined = row.info;
      while (ancestor && !chain.has(ancestor.file)) {
        chain.add(ancestor.file);
        ancestor = ancestor.parentSession
          ? byFile.get(ancestor.parentSession)
          : undefined;
      }
      rows.push({
        ...row,
        cyclic: Boolean(ancestor),
        missing: Boolean(
          row.info.parentSession && !byFile.has(row.info.parentSession),
        ),
      });
      for (const child of [...(children.get(row.info.file) ?? [])].reverse())
        stack.push({ info: child, depth: row.depth + 1 });
    }
  };
  for (const s of sessions)
    if (!s.parentSession || !byFile.has(s.parentSession)) walk(s);
  for (const s of sessions) if (!seen.has(s.file)) walk(s);
  return rows;
}

export function SessionTree({
  sessions,
  query = '',
  limit,
  selectedFile,
  onSelect,
}: {
  sessions: SessionInfo[];
  query?: string;
  limit?: number;
  selectedFile?: string;
  onSelect: (info: SessionInfo) => void;
}) {
  const included = new Set<string>();
  const byFile = new Map(sessions.map((s) => [s.file, s]));
  for (const info of sessions
    .filter((s) =>
      `${s.title} ${s.model}`.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, limit)) {
    let current: SessionInfo | undefined = info;
    while (current && !included.has(current.file)) {
      included.add(current.file);
      current = current.parentSession
        ? byFile.get(current.parentSession)
        : undefined;
    }
  }
  return (
    <div role="tree" aria-label="Session archives" onKeyDown={treeKeys}>
      {sessionForest(sessions)
        .filter((row) => included.has(row.info.file))
        .map(({ info, depth, missing, cyclic }) => (
          <button
            key={info.file}
            type="button"
            role="treeitem"
            aria-level={depth + 1}
            aria-selected={selectedFile === info.file}
            className={`wb-session-item${selectedFile === info.file ? ' is-active' : ''}`}
            style={{ paddingLeft: 12 + Math.min(depth, 6) * 14 }}
            onClick={() => onSelect(info)}
          >
            <span>
              {info.parentSession ? '↳ ' : ''}
              {info.title}
            </span>
            <small>
              {info.id.slice(0, 8)} / {info.messageCount} msgs
              {selectedFile === info.file ? ' / Selected' : ''}
              {missing ? ' / Source unavailable' : ''}
              {cyclic ? ' / Cyclic source lineage' : ''}
            </small>
          </button>
        ))}
    </div>
  );
}

export function EntryTree({
  tree,
  selectedId,
  onSelect,
}: {
  tree: Tree;
  selectedId?: string | null;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const virtual = useVirtualizer({
    count: tree.nodes.length,
    getScrollElement: () => ref.current,
    estimateSize: () => 54,
    overscan: 8,
    enabled: tree.nodes.length > 200,
  });
  useEffect(() => {
    if (tree.nodes.length > 200) {
      const index = tree.nodes.findIndex((node) => node.id === selectedId);
      if (index >= 0) virtual.scrollToIndex(index, { align: 'auto' });
    }
  }, [selectedId, tree.nodes, virtual]);
  const render = (index: number) => {
    const node = tree.nodes[index];
    return (
      <button
        type="button"
        role="treeitem"
        aria-level={node.depth + 1}
        aria-selected={selectedId === node.id}
        title={`${node.label} (${node.id})`}
        className={`wb-entry-node${selectedId === node.id ? ' is-active' : ''}`}
        style={{ paddingLeft: 10 + Math.min(node.depth, 8) * 12 }}
        onClick={() => onSelect(node.id)}
      >
        <span>
          {node.depth ? '↳ ' : ''}
          {node.label}
        </span>
        <small>
          {node.id.slice(0, 8)}
          {node.tip ? ' / Branch tip' : ''}
          {tree.leafId === node.id ? ' / Archive tip' : ''}
          {selectedId === node.id ? ' / Selected' : ''}
          {!node.valid ? ' / Invalid lineage' : ''}
        </small>
      </button>
    );
  };
  return (
    <div className="wb-entry-tree">
      <label className="wb-meta">
        Branch tip
        <select
          aria-label="Branch tip"
          value={
            tree.nodes.find((n) => n.id === selectedId)?.tip
              ? (selectedId ?? '')
              : ''
          }
          onChange={(e) => e.target.value && onSelect(e.target.value)}
        >
          <option value="">Select a branch tip…</option>
          {tree.nodes
            .filter((n) => n.tip)
            .map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
                {n.id === tree.leafId ? ' / Archive tip' : ''}
              </option>
            ))}
        </select>
      </label>
      <div
        ref={ref}
        className="wb-entry-scroll"
        role="tree"
        aria-label="Session entries"
        onKeyDown={treeKeys}
      >
        {tree.nodes.length > 200 ? (
          <div style={{ height: virtual.getTotalSize(), position: 'relative' }}>
            {virtual.getVirtualItems().map((row) => (
              <div
                key={tree.nodes[row.index].id}
                style={{
                  position: 'absolute',
                  top: row.start,
                  width: '100%',
                  height: row.size,
                }}
              >
                {render(row.index)}
              </div>
            ))}
          </div>
        ) : (
          tree.nodes.map((node, index) => (
            <div key={node.id}>{render(index)}</div>
          ))
        )}
        {!tree.nodes.length && (
          <p className="wb-meta">
            Empty session. Resume to start its first branch.
          </p>
        )}
      </div>
    </div>
  );
}
