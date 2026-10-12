import { describe, expect, it } from 'vitest';
import { projectsInCollection, threadsInCollection, type CollectionSummary } from './active-collection';

const work: CollectionSummary = { id: 'work', name: 'Work', project_ids: ['b', 'a'] };

describe('collection filter', () => {
  it('keeps every project when no collection is active and orders members when one is', () => {
    const projects = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(projectsInCollection(projects, null).map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(projectsInCollection(projects, work).map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('hides threads whose project is outside the collection', () => {
    const threads = [
      { id: '1', project_id: 'a' },
      { id: '2', project_id: 'c' },
      { id: '3', project_id: null },
    ];
    expect(threadsInCollection(threads, null)).toHaveLength(3);
    expect(threadsInCollection(threads, work).map((item) => item.id)).toEqual(['1']);
  });
});
