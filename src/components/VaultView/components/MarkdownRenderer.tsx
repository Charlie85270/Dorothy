'use client';

import React from 'react';

function resolveLocalSrc(src: string): string {
  if (src.startsWith('/') || /^[A-Z]:\\/.test(src)) {
    return `http://127.0.0.1:31415/api/local-file?path=${encodeURIComponent(src)}`;
  }
  return src;
}

// Render inline markdown (bold, italic, code, images, links)
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(<code key={key++} className="px-1 py-0.5 text-xs bg-secondary rounded font-mono">{codeMatch[1]}</code>);
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      parts.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Image ![alt](src) — check before links
    if (remaining.startsWith('![')) {
      const closeBracket = remaining.indexOf(']', 2);
      if (closeBracket !== -1 && remaining[closeBracket + 1] === '(') {
        const closeParen = remaining.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          const alt = remaining.slice(2, closeBracket);
          const src = resolveLocalSrc(remaining.slice(closeBracket + 2, closeParen));
          parts.push(
            <img key={key++} src={src} alt={alt} className="max-w-full rounded my-2 inline-block" />
          );
          remaining = remaining.slice(closeParen + 1);
          continue;
        }
      }
    }

    // Link [text](url)
    if (remaining.startsWith('[')) {
      const closeBracket = remaining.indexOf(']', 1);
      if (closeBracket !== -1 && remaining[closeBracket + 1] === '(') {
        const closeParen = remaining.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          const linkText = remaining.slice(1, closeBracket);
          const href = remaining.slice(closeBracket + 2, closeParen);
          parts.push(
            <a key={key++} href={href} className="text-primary underline hover:text-primary/80" target="_blank" rel="noopener noreferrer">
              {linkText}
            </a>
          );
          remaining = remaining.slice(closeParen + 1);
          continue;
        }
      }
    }

    // Regular text — advance to next special character
    const nextSpecial = remaining.search(/[`*\[!]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      // Special char didn't match any pattern above — emit as text
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return <>{parts}</>;
}

export function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactElement[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={i} className="bg-secondary/80 border border-border rounded-lg p-3 my-2 overflow-x-auto text-xs">
            <code>{codeBlockContent.join('\n')}</code>
          </pre>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Empty lines
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-3" />);
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-2xl font-bold text-foreground mt-4 mb-2">{renderInline(line.slice(2))}</h1>);
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-xl font-bold text-foreground mt-3 mb-2">{renderInline(line.slice(3))}</h2>);
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-lg font-semibold text-foreground mt-3 mb-1">{renderInline(line.slice(4))}</h3>);
      continue;
    }

    // Horizontal rule
    if (line.match(/^-{3,}$/) || line.match(/^\*{3,}$/)) {
      elements.push(<hr key={i} className="border-border my-4" />);
      continue;
    }

    // Bullet list
    if (line.match(/^\s*[-*]\s/)) {
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      const text = line.replace(/^\s*[-*]\s/, '');
      elements.push(
        <div key={i} className="flex gap-2 my-0.5" style={{ paddingLeft: `${indent * 8 + 8}px` }}>
          <span className="text-muted-foreground mt-1.5 shrink-0">&#8226;</span>
          <span className="text-sm text-foreground">{renderInline(text)}</span>
        </div>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\s*\d+\.\s/)) {
      const match = line.match(/^(\s*)(\d+)\.\s(.*)$/);
      if (match) {
        const indent = match[1].length;
        elements.push(
          <div key={i} className="flex gap-2 my-0.5" style={{ paddingLeft: `${indent * 8 + 8}px` }}>
            <span className="text-muted-foreground shrink-0">{match[2]}.</span>
            <span className="text-sm text-foreground">{renderInline(match[3])}</span>
          </div>
        );
        continue;
      }
    }

    // Image on its own line (use trim to handle trailing whitespace/\r)
    const trimmed = line.trim();
    if (trimmed.startsWith('![')) {
      const closeBracket = trimmed.indexOf(']', 2);
      if (closeBracket !== -1 && trimmed[closeBracket + 1] === '(') {
        const closeParen = trimmed.indexOf(')', closeBracket + 2);
        if (closeParen !== -1 && closeParen === trimmed.length - 1) {
          const alt = trimmed.slice(2, closeBracket);
          const src = resolveLocalSrc(trimmed.slice(closeBracket + 2, closeParen));
          elements.push(
            <div key={i} className="my-2">
              <img src={src} alt={alt} className="max-w-full rounded" />
            </div>
          );
          continue;
        }
      }
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-primary/50 pl-3 my-1 text-sm text-muted-foreground italic">
          {renderInline(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Regular paragraph
    elements.push(<p key={i} className="text-sm text-foreground my-0.5">{renderInline(line)}</p>);
  }

  // Close any open code block
  if (inCodeBlock && codeBlockContent.length > 0) {
    elements.push(
      <pre key="final-code" className="bg-secondary/80 border border-border rounded-lg p-3 my-2 overflow-x-auto text-xs">
        <code>{codeBlockContent.join('\n')}</code>
      </pre>
    );
  }

  return <div>{elements}</div>;
}
