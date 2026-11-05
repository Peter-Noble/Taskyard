import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TaskLabelCreateFields, type TaskLabelValues } from './task-label-fields.js';

function renderCreateFields(overrides: Partial<TaskLabelValues> = {}) {
  return renderToStaticMarkup(
    createElement(TaskLabelCreateFields, {
      value: {
        taskType: 'feature',
        priority: 'medium',
        category: '',
        ...overrides,
      },
      onChange: () => {},
      categorySuggestions: ['Performance', 'UI'],
    }),
  );
}

describe('TaskLabelCreateFields', () => {
  it('shows a coloured swatch for the selected priority', () => {
    const html = renderCreateFields({ priority: 'high' });

    expect(html).toContain('ta35-priority-swatch priority-high');
  });

  it('keeps category suggestions hidden until the input is focused', () => {
    const html = renderCreateFields();

    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Category suggestions');
  });
});
