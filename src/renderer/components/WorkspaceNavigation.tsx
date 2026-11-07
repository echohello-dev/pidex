import { useState, type FormEvent } from 'react';
import type { GroupInput, WorkspaceGroup, WorkspaceInfo } from '../api';

export function WorkspaceNavigation({
  roots,
  groups,
  groupId,
  rootId,
  onGroup,
  onRoot,
  onSave,
  onAdd,
}: {
  roots: WorkspaceInfo[];
  groups: WorkspaceGroup[];
  groupId: string;
  rootId: string;
  onGroup: (id: string) => void;
  onRoot: (root: WorkspaceInfo) => void;
  onSave: (input: GroupInput) => Promise<void>;
  onAdd: () => void;
}) {
  const [editing, setEditing] = useState<GroupInput | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const group = groups.find((g) => g.id === groupId);
  const edit = (current?: WorkspaceGroup) => {
    setError('');
    setEditing(
      current
        ? { ...current, expectedRoots: [...current.rootIds] }
        : { name: '', rootIds: rootId ? [rootId] : [] },
    );
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave(editing);
      setEditing(null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not save workspace.',
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="wb-root-navigation" aria-label="Workspace roots">
      <label className="wb-root-group">
        Workspace
        <select
          aria-label="Workspace group"
          value={groupId}
          onChange={(e) => onGroup(e.target.value)}
        >
          {!group && <option value="">Choose a workspace</option>}
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <div className="wb-group-actions">
        <button type="button" onClick={() => edit()}>
          Create workspace
        </button>
        <button type="button" disabled={!group} onClick={() => edit(group)}>
          Edit workspace
        </button>
      </div>
      {editing && (
        <form
          onSubmit={save}
          className="wb-group-editor"
          aria-label="Workspace settings"
        >
          <label>
            Workspace name
            <input
              autoFocus
              aria-label="Workspace name"
              maxLength={100}
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </label>
          <fieldset disabled={saving}>
            <legend>Roots</legend>
            {roots.map((root) => (
              <label key={root.dirName}>
                <input
                  type="checkbox"
                  checked={editing.rootIds.includes(root.dirName)}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      rootIds: e.target.checked
                        ? [...editing.rootIds, root.dirName]
                        : editing.rootIds.filter((id) => id !== root.dirName),
                    })
                  }
                />
                <span>
                  {root.name}
                  <small>{root.cwd}</small>
                </span>
              </label>
            ))}
          </fieldset>
          {error && <p role="alert">{error}</p>}
          <div className="wb-group-actions">
            <button type="submit" disabled={saving || !editing.name.trim()}>
              {saving ? 'Saving workspace…' : 'Save workspace'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {(group?.rootIds.length !== 1 ||
        roots.find((r) => r.dirName === group?.rootIds[0])?.availability !==
          'available') && (
        <div className="wb-root-list">
          {(group?.rootIds ?? [])
            .map((id) => roots.find((root) => root.dirName === id))
            .filter((root): root is WorkspaceInfo => Boolean(root))
            .map((root) => (
              <button
                key={root.dirName}
                type="button"
                aria-current={rootId === root.dirName ? 'location' : undefined}
                title={root.cwd}
                onClick={() => onRoot(root)}
              >
                <span>{root.name}</span>
                <small>{root.cwd}</small>
                {root.availability !== 'available' && (
                  <small>
                    {root.availability === 'missing'
                      ? 'Missing folder'
                      : 'Folder unavailable'}
                  </small>
                )}
              </button>
            ))}
        </div>
      )}
      <button className="wb-add-root" type="button" onClick={onAdd}>
        Add root
      </button>
    </section>
  );
}
