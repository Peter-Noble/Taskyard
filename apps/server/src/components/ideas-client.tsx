'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Idea, IdeaDetail, PromoteIdeaResponse } from '@taskyard/protocol';
import { AppShell } from '@/components/app-shell';
import { useCollections } from '@/components/collection-provider';
import { useTestData } from '@/lib/hooks/use-test-data';
import { ChatCommentComposer, ChatMessage } from '@/components/chat-message';
import {
  defaultIdeaRailFilter,
  filterAndSortIdeas,
  IdeaRailFilterButton,
  onlyIdeaStatus,
} from '@/components/idea-rail-filter';
import { useSessionPerson } from '@/components/providers';

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export function IdeasClient({ initialIdeaId }: { initialIdeaId: string | null }) {
  const { active, collections, select } = useCollections();
  const { useTestData: testDataOn } = useTestData();
  const person = useSessionPerson();
  const [filter, setFilter] = useState(defaultIdeaRailFilter);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selected, setSelected] = useState<IdeaDetail | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsEditing, setDetailsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCollections, setNewCollections] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const visibleIdeas = useMemo(() => filterAndSortIdeas(ideas, filter), [ideas, filter]);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/ideas/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(await readError(res));
    const data = (await res.json()) as { idea: IdeaDetail };
    setSelected(data.idea);
    return data.idea;
  }, []);

  const loadIdeas = useCallback(async () => {
    if (testDataOn) {
      setIdeas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (active) params.set('collection_id', active.id);
      const res = await fetch(`/api/ideas?${params.toString()}`);
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { ideas: Idea[] };
      setIdeas(data.ideas);
      setError(null);
      const initialIdeas = filterAndSortIdeas(data.ideas, defaultIdeaRailFilter());
      if (!selected && !initialIdeaId && initialIdeas[0]) await loadDetail(initialIdeas[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ideas');
    } finally {
      setLoading(false);
    }
  }, [active, initialIdeaId, loadDetail, selected, testDataOn]);

  useEffect(() => {
    void loadIdeas();
  }, [active?.id, testDataOn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialIdeaId && !testDataOn) {
      void loadDetail(initialIdeaId).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load idea');
      });
    }
  }, [initialIdeaId, loadDetail, testDataOn]);

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title);
    setDescription(selected.description);
    setCollectionIds(selected.collections.map((item) => item.id));
    setProjectName(selected.title);
  }, [selected]);

  useEffect(() => {
    setDetailsOpen(false);
    setDetailsEditing(false);
  }, [selected?.id]);

  async function createIdea(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, description: newDescription, collection_ids: newCollections }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { idea: IdeaDetail };
      setSelected(data.idea);
      setFilter(defaultIdeaRailFilter());
      setNewTitle('');
      setNewDescription('');
      setNewCollections([]);
      setCreateOpen(false);
      await loadIdeas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create idea');
    } finally {
      setBusy(false);
    }
  }

  async function saveIdea(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/ideas/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, collection_ids: collectionIds }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { idea: IdeaDetail };
      setSelected(data.idea);
      setDetailsEditing(false);
      await loadIdeas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update idea');
    } finally {
      setBusy(false);
    }
  }

  async function archiveIdea(restore: boolean) {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ideas/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !restore }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { idea: IdeaDetail };
      setSelected(data.idea);
      setFilter(onlyIdeaStatus(data.idea.status));
      await loadIdeas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive idea');
    } finally {
      setBusy(false);
    }
  }

  async function addComment(event: FormEvent) {
    event.preventDefault();
    if (!selected || !comment.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ideas/${encodeURIComponent(selected.id)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: comment }),
      });
      if (!res.ok) throw new Error(await readError(res));
      setComment('');
      await loadDetail(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setBusy(false);
    }
  }

  async function promote(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/ideas/${encodeURIComponent(selected.id)}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          repo_url: repoUrl.trim() || null,
          default_branch: defaultBranch,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as PromoteIdeaResponse;
      setSelected(data.idea);
      setPromoteOpen(false);
      setFilter(onlyIdeaStatus('promoted'));
      await loadIdeas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to promote idea');
    } finally {
      setBusy(false);
    }
  }

  function toggleCollection(id: string, values: string[], update: (next: string[]) => void) {
    update(values.includes(id) ? values.filter((item) => item !== id) : [...values, id]);
  }

  return (
    <AppShell>
      <div className="ideas-page">
        <aside className="ideas-list-panel">
          <header className="panel-head task-rail-head ideas-list-head ta35-filter-head">
            <span className="task-rail-head-label">Ideas</span>
            <div className="task-rail-project-wrap">
              <select
                className="form-select task-rail-project"
                aria-label="Collection"
                value={active?.id ?? ''}
                onChange={(event) => select(event.target.value || null)}
              >
                <option value="">All</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </div>
            <IdeaRailFilterButton
              value={filter}
              onChange={(next) => {
                setFilter(next);
                setSelected(null);
              }}
            />
            <button
              type="button"
              className="btn btn-primary btn-rail-new"
              disabled={testDataOn}
              onClick={() => {
                setNewCollections(active ? [active.id] : []);
                setCreateOpen(true);
              }}
            >
              New idea
            </button>
          </header>
          <div className="ideas-list-body">
            {loading ? <p className="empty-state">Loading ideas…</p> : null}
            {!loading && visibleIdeas.length === 0 ? (
              <p className="empty-state">
                {testDataOn ? 'Ideas are unavailable in test-data mode.' : `No ideas match the current filters${active ? ` in ${active.name}` : ''}.`}
              </p>
            ) : null}
            <ul className="ideas-list">
              {visibleIdeas.map((idea) => (
                <li key={idea.id}>
                  <button
                    type="button"
                    className={selected?.id === idea.id ? 'is-selected' : ''}
                    onClick={() => void loadDetail(idea.id)}
                  >
                    <span className="idea-short-id">{idea.short_id}</span>
                    <strong>{idea.title}</strong>
                    <span>{idea.collections.map((item) => item.name).join(' · ') || 'No collections'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="stream-panel idea-detail-panel" aria-label="Idea detail">
          <header className="panel-head stream-header" aria-label="Selected idea">
            <div className="stream-header-view">
              <div className="stream-header-main">
                <h2 className="stream-title">{selected?.title ?? 'Select an idea'}</h2>
                <p className="stream-sub">
                  {selected
                    ? `${selected.short_id} · ${selected.status} · ${selected.collections.map((item) => item.name).join(' · ') || 'No collections'}`
                    : 'Choose an idea from the rail or capture a new one'}
                </p>
              </div>
              {selected ? (
                <div className="stream-header-actions">
                  <button
                    type="button"
                    className="task-view-details-toggle"
                    aria-expanded={detailsOpen}
                    onClick={() => {
                      setDetailsOpen((open) => !open);
                      setDetailsEditing(false);
                    }}
                  >
                    Details
                  </button>
                  {selected.promoted_project_id ? (
                    <Link className="btn btn-primary btn-sm" href={`/projects?origin=${selected.id}`}>
                      View project
                    </Link>
                  ) : null}
                  {selected.can_write && selected.status === 'active' ? (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setPromoteOpen(true)}>
                      Promote to project
                    </button>
                  ) : null}
                  {selected.can_write && selected.status !== 'promoted' ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void archiveIdea(selected.status === 'archived')}>
                      {selected.status === 'archived' ? 'Restore' : 'Archive'}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </header>
          <div className="stream-body">
            {error ? <p className="form-error idea-error">{error}</p> : null}
            {!selected ? (
              <div className="empty-state idea-empty">Select an idea or capture a new one.</div>
            ) : (
              <div className="idea-content">
                {detailsOpen ? (
                  <section className="idea-details" aria-label="Idea details">
                    {detailsEditing && selected.can_write ? (
                      <form className="idea-brief-form" onSubmit={(event) => void saveIdea(event)}>
                        <label className="form-field">
                          <span className="form-label">Title</span>
                          <input className="form-input" value={title} required onChange={(event) => setTitle(event.target.value)} />
                        </label>
                        <label className="form-field">
                          <span className="form-label">Brief</span>
                          <textarea className="form-textarea" rows={6} value={description} onChange={(event) => setDescription(event.target.value)} />
                        </label>
                        <fieldset className="idea-collections">
                          <legend className="form-label">Collections</legend>
                          {collections.map((collection) => (
                            <label key={collection.id}>
                              <input
                                type="checkbox"
                                checked={collectionIds.includes(collection.id)}
                                onChange={() => toggleCollection(collection.id, collectionIds, setCollectionIds)}
                              />
                              {collection.name}
                            </label>
                          ))}
                        </fieldset>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Update</button>
                      </form>
                    ) : (
                      <div className="task-view-details">
                        <div className="task-view-detail-block">
                          <div className="task-view-detail-label-row">
                            <span className="form-label">Title</span>
                            {selected.can_write ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                  setTitle(selected.title);
                                  setDescription(selected.description);
                                  setCollectionIds(selected.collections.map((item) => item.id));
                                  setDetailsEditing(true);
                                }}
                              >
                                Edit
                              </button>
                            ) : null}
                          </div>
                          <p className="task-view-brief">{selected.title}</p>
                        </div>
                        <div className="task-view-detail-block">
                          <span className="form-label">Brief</span>
                          <div className="task-view-brief">{selected.description || 'No brief yet.'}</div>
                        </div>
                        <div className="task-view-detail-block">
                          <span className="form-label">Collections</span>
                          <p className="task-view-brief">{selected.collections.map((item) => item.name).join(' · ') || 'No collections'}</p>
                        </div>
                      </div>
                    )}
                  </section>
                ) : null}
                <div className="chat-thread idea-history" role="log" aria-live="polite" aria-label="Idea history">
                  <div className="chat-scroll">
                    {selected.activity.map((item, index) => (
                      item.type === 'comment' ? (
                        <ChatMessage
                          key={`${item.created_at}-${index}`}
                          role={item.actor.trim().toLowerCase() === person?.displayName.trim().toLowerCase() ? 'user' : 'assistant'}
                          header={<>{item.actor} · {new Date(item.created_at).toLocaleString()}</>}
                        >
                          {item.text}
                        </ChatMessage>
                      ) : (
                        <ChatMessage key={`${item.created_at}-${index}`}>
                          {item.actor} {item.summary}
                          {item.detail ? (
                            <div className="task-view-action-detail task-view-brief-detail">{item.detail}</div>
                          ) : null}
                        </ChatMessage>
                      )
                    ))}
                  </div>
                  {selected.can_write ? (
                    <footer className="task-compose-footer">
                      <ChatCommentComposer
                        id="idea-comment"
                        value={comment}
                        onChange={setComment}
                        onSubmit={addComment}
                        busy={busy}
                      />
                    </footer>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {createOpen ? (
        <div className="modal-overlay" role="presentation" onClick={() => setCreateOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-idea-title" onClick={(event) => event.stopPropagation()}>
            <header className="modal-head"><h2 id="new-idea-title">New project idea</h2></header>
            <form onSubmit={(event) => void createIdea(event)}>
              <div className="modal-body">
                <label className="form-field"><span className="form-label">Title</span><input className="form-input" value={newTitle} required onChange={(event) => setNewTitle(event.target.value)} /></label>
                <label className="form-field"><span className="form-label">Brief</span><textarea className="form-textarea" rows={7} value={newDescription} onChange={(event) => setNewDescription(event.target.value)} /></label>
                <fieldset className="idea-collections"><legend className="form-label">Collections</legend>{collections.map((collection) => <label key={collection.id}><input type="checkbox" checked={newCollections.includes(collection.id)} onChange={() => toggleCollection(collection.id, newCollections, setNewCollections)} />{collection.name}</label>)}</fieldset>
              </div>
              <footer className="modal-foot"><button type="button" className="btn btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy}>Create idea</button></footer>
            </form>
          </div>
        </div>
      ) : null}

      {promoteOpen && selected ? (
        <div className="modal-overlay" role="presentation" onClick={() => setPromoteOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="promote-idea-title" onClick={(event) => event.stopPropagation()}>
            <header className="modal-head"><h2 id="promote-idea-title">Promote {selected.short_id}</h2></header>
            <form onSubmit={(event) => void promote(event)}>
              <div className="modal-body">
                <p className="form-help">The idea and its complete history will remain linked from the project. No initial task is created automatically.</p>
                <label className="form-field"><span className="form-label">Project name</span><input className="form-input" value={projectName} required onChange={(event) => setProjectName(event.target.value)} /></label>
                <label className="form-field"><span className="form-label">Repository (HTTPS, optional)</span><input className="form-input spec-mono" type="url" value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} /></label>
                <label className="form-field"><span className="form-label">Default branch</span><input className="form-input spec-mono" value={defaultBranch} required onChange={(event) => setDefaultBranch(event.target.value)} /></label>
              </div>
              <footer className="modal-foot"><button type="button" className="btn btn-ghost" onClick={() => setPromoteOpen(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy}>Create project</button></footer>
            </form>
          </div>
        </div>
      ) : null}

    </AppShell>
  );
}
