import { describe, expect, it } from 'vitest';
import type { Idea } from '@taskyard/protocol';
import {
  defaultIdeaRailFilter,
  filterAndSortIdeas,
  onlyIdeaStatus,
} from './idea-rail-filter.js';

function idea(input: Partial<Idea> & Pick<Idea, 'short_id' | 'title' | 'status'>): Idea {
  return {
    id: input.short_id,
    owner_id: 'person-1',
    description: '',
    archived_at: null,
    promoted_project_id: null,
    collections: [],
    can_write: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...input,
  };
}

describe('idea rail filtering and sorting', () => {
  const ideas = [
    idea({ short_id: 'IDEA-2', title: 'Beta', status: 'active', created_at: '2026-02-01T00:00:00.000Z' }),
    idea({ short_id: 'IDEA-1', title: 'Alpha', status: 'archived' }),
    idea({ short_id: 'IDEA-3', title: 'Gamma', status: 'promoted' }),
  ];

  it('shows active ideas by default and can isolate another lifecycle state', () => {
    expect(filterAndSortIdeas(ideas, defaultIdeaRailFilter()).map((item) => item.short_id)).toEqual(['IDEA-2']);
    expect(filterAndSortIdeas(ideas, onlyIdeaStatus('archived')).map((item) => item.short_id)).toEqual(['IDEA-1']);
  });

  it('sorts the visible ideas without changing the source array', () => {
    const source = [...ideas];
    const sorted = filterAndSortIdeas(source, {
      statuses: { active: true, archived: true, promoted: true },
      sort: 'title_asc',
    });
    expect(sorted.map((item) => item.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(source).toEqual(ideas);
  });
});
