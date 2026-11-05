'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { SearchResponse, SearchResult } from '@taskyard/protocol';

type SearchDialogProps = {
  entity: 'task' | 'idea';
  scopeId: string | null;
  scopeLabel: string;
  disabled?: boolean;
  onSelect: (result: SearchResult) => void;
};

// D-013 — search scope is page-local; no app-wide current-project state is introduced.
// D-015 — the selected UI is the centered command palette, with no alternate layouts.
export function SearchDialog({
  entity,
  scopeId,
  scopeLabel,
  disabled = false,
  onSelect,
}: SearchDialogProps) {
  const designParam = useSearchParams().get('ta-20-design');
  const design = designParam === 'B' || designParam === 'C' ? designParam : 'A';
  const [open, setOpen] = useState(design === 'B' || design === 'C');
  const [query, setQuery] = useState('');
  const [searchAll, setSearchAll] = useState(!scopeId);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeResultRef = useRef<HTMLButtonElement>(null);
  const entityLabel = entity === 'task' ? 'tasks' : 'ideas';
  const narrowScopeLabel = entity === 'task' ? 'This project' : 'This collection';
  const allScopeLabel = entity === 'task' ? 'All projects' : 'All collections';

  const openSearch = useCallback(() => {
    if (disabled) return;
    setSearchAll(!scopeId);
    setError(null);
    setOpen(true);
  }, [disabled, scopeId]);

  const closeSearch = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        if (disabled) return;
        event.preventDefault();
        openSearch();
      }
    }
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, [disabled, openSearch]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([]);
      setActiveIndex(0);
      setLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ q: query.trim(), type: entity, limit: '20' });
      if (entity === 'task') {
        if (searchAll || !scopeId) params.set('all_projects', '1');
        else params.set('project_id', scopeId);
      } else if (!searchAll && scopeId) {
        params.set('collection_id', scopeId);
      }
      try {
        const res = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as SearchResponse & { error?: string };
        if (!res.ok) throw new Error(data.error || `Search failed (${res.status})`);
        setResults(data.results);
        setActiveIndex(0);
        setLoading(false);
      } catch (err) {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(err instanceof Error ? err.message : 'Search failed');
        setLoading(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [entity, open, query, scopeId, searchAll]);

  useEffect(() => {
    activeResultRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function selectResult(result: SearchResult) {
    onSelect(result);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
    } else if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      selectResult(results[activeIndex]);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="search-trigger"
        onClick={openSearch}
        disabled={disabled}
        aria-label={`Search ${entityLabel}`}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.25" />
          <path d="m12.5 12.5 4 4" />
        </svg>
        <span>Search</span>
        <kbd>Ctrl P</kbd>
      </button>
      {open ? (
        <div className="search-overlay" role="presentation" onClick={closeSearch}>
          <section
            className={`search-dialog search-design-${design}`}
            role="dialog"
            aria-modal="true"
            aria-label={`Search ${entityLabel}`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="search-head">
              <div className="search-heading">
                <span className="search-eyebrow">{entity === 'task' ? 'Task search' : 'Idea search'}</span>
                <span className="search-scope-name">{searchAll || !scopeId ? allScopeLabel : scopeLabel}</span>
              </div>
              <div className="search-input-row">
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <circle cx="8.5" cy="8.5" r="5.25" />
                  <path d="m12.5 12.5 4 4" />
                </svg>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleInputKey}
                  placeholder={entity === 'task'
                    ? 'Search titles, briefs, comments, decisions…'
                    : 'Search titles, briefs, and comments…'}
                  aria-label={`Search ${entityLabel}`}
                  aria-controls="search-results"
                  aria-activedescendant={results[activeIndex] ? `search-result-${activeIndex}` : undefined}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="button" className="search-close" onClick={closeSearch}>Esc</button>
              </div>
              <div className="search-scopes" aria-label="Search scope">
                {scopeId ? (
                  <>
                    <button
                      type="button"
                      className={!searchAll ? 'is-active' : undefined}
                      onClick={() => setSearchAll(false)}
                    >
                      {narrowScopeLabel}
                    </button>
                    <button
                      type="button"
                      className={searchAll ? 'is-active' : undefined}
                      onClick={() => setSearchAll(true)}
                    >
                      {allScopeLabel}
                    </button>
                  </>
                ) : (
                  <span>{allScopeLabel}</span>
                )}
              </div>
            </header>

            <div className="search-body">
              {!query.trim() ? (
                <div className="search-empty">
                  <strong>Find {entityLabel} by word, prefix, or ID.</strong>
                  <span>Results include archived and completed items.</span>
                </div>
              ) : null}
              {loading ? <p className="search-status">Searching…</p> : null}
              {error ? <p className="search-status is-error">{error}</p> : null}
              {!loading && !error && query.trim() && results.length === 0 ? (
                <p className="search-status">No {entityLabel} match “{query.trim()}”.</p>
              ) : null}
              <div className="search-results" id="search-results" role="listbox" aria-label="Search results">
                {results.map((result, index) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    ref={index === activeIndex ? activeResultRef : undefined}
                    id={`search-result-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`search-result${index === activeIndex ? ' is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectResult(result)}
                  >
                    <span className="search-result-topline">
                      <span className="search-result-id">{result.short_id}</span>
                      <span className="search-result-status">{result.status.replaceAll('_', ' ')}</span>
                    </span>
                    <strong className="search-result-title">{result.title}</strong>
                    <span className="search-result-snippet">
                      {result.snippet.map((part, partIndex) => part.match ? (
                        <mark key={partIndex}>{part.text}</mark>
                      ) : (
                        <span key={partIndex}>{part.text}</span>
                      ))}
                    </span>
                    <span className="search-result-meta">
                      {result.type === 'task' ? result.project_name : 'Idea'}
                      <span aria-hidden="true">↵</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <footer className="search-footer">
              <span><kbd>↑</kbd><kbd>↓</kbd> Navigate <kbd>↵</kbd> Open</span>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
