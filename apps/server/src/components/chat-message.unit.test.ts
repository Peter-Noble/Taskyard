import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChatCommentComposer } from './chat-message.js';

function renderComposer(busy = false) {
  return renderToStaticMarkup(
    createElement(ChatCommentComposer, {
      id: 'task-comment',
      value: 'A comment',
      onChange: () => {},
      onSubmit: () => {},
      busy,
    }),
  );
}

describe('ChatCommentComposer', () => {
  it('uses a single-row textarea with browser suggestions disabled', () => {
    const html = renderComposer();

    expect(html).toContain('<textarea');
    expect(html).toContain('rows="1"');
    expect(html).toContain('autoComplete="off"');
  });

  it('disables submission and shows pending feedback while busy', () => {
    const html = renderComposer(true);

    expect(html).toContain('disabled=""');
    expect(html).toContain('Posting…');
  });
});
