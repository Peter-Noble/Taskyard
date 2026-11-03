import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownMessage({ text }: { text: string }) {
  // D-012
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, title, children }) {
            return (
              <a href={href} title={title} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
          img({ alt }) {
            return <span>[Image: {alt || 'no description'}]</span>;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
