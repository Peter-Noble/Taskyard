import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownMessage } from './markdown-message.js';

function renderMarkdown(text: string) {
  return renderToStaticMarkup(createElement(MarkdownMessage, { text }));
}

describe('MarkdownMessage', () => {
  it('renders Markdown, GitHub extensions, and Unicode emoji', () => {
    const html = renderMarkdown(
      '**Done** 🎉\n\n- first\n- second\n\n~~old~~\n\n| A | B |\n| - | - |\n| 1 | 2 |',
    );

    expect(html).toContain('<strong>Done</strong> 🎉');
    expect(html).toContain('<li>first</li>');
    expect(html).toContain('<del>old</del>');
    expect(html).toContain('<table>');
  });

  it('opens links safely in a new tab', () => {
    const html = renderMarkdown('[Taskyard](https://taskyard.app)');

    expect(html).toContain('href="https://taskyard.app"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });

  it('does not render raw HTML or remote images', () => {
    const html = renderMarkdown(
      'Hello <script>alert("no")</script>\n\n![Private image](https://example.com/track.png)',
    );

    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('track.png');
    expect(html).toContain('[Image: Private image]');
  });
});
