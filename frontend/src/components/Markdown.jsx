import React, { useMemo } from 'react';

// 轻量 Markdown 渲染：只支持聊天常用语法，全部用 React 元素构造（不使用 innerHTML，避免 XSS）

const INLINE_PATTERNS = [
  { re: /^`([^`]+)`/, render: (m, key) => <code key={key} className="md-code">{m[1]}</code> },
  { re: /^\*\*([^*]+)\*\*/, render: (m, key) => <strong key={key}>{m[1]}</strong> },
  { re: /^\*([^*]+)\*/, render: (m, key) => <em key={key}>{m[1]}</em> },
  { re: /^~~([^~]+)~~/, render: (m, key) => <s key={key}>{m[1]}</s> },
  {
    re: /^\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/,
    render: (m, key) => (
      <a key={key} href={m[2]} target="_blank" rel="noreferrer noopener">{m[1]}</a>
    ),
  },
];

function parseInline(text) {
  const nodes = [];
  let rest = text;
  let plain = '';
  let key = 0;

  const flushPlain = () => {
    if (plain) {
      nodes.push(plain);
      plain = '';
    }
  };

  while (rest.length) {
    let matched = false;
    for (const pattern of INLINE_PATTERNS) {
      const m = rest.match(pattern.re);
      if (m) {
        flushPlain();
        nodes.push(pattern.render(m, key++));
        rest = rest.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const next = rest.slice(1).search(/[`*~[]/);
    if (next === -1) {
      plain += rest;
      rest = '';
    } else {
      plain += rest.slice(0, next + 1);
      rest = rest.slice(next + 1);
    }
  }
  flushPlain();
  return nodes;
}

function parseBlocks(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let list = null;
  let code = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'p', lines: paragraph });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (code) {
      if (line.trim().startsWith('```')) {
        blocks.push(code);
        code = null;
      } else {
        code.lines.push(raw);
      }
      continue;
    }

    if (line.trim().startsWith('```')) {
      flushParagraph();
      flushList();
      code = { type: 'code', lang: line.trim().slice(3).trim(), lines: [] };
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'quote', text: quote[1] });
      continue;
    }

    const item = line.match(/^\s*[-*]\s+(.*)$/);
    if (item) {
      flushParagraph();
      list = list || { type: 'list', items: [] };
      list.items.push(item[1]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  if (code) blocks.push(code);
  flushParagraph();
  flushList();
  return blocks;
}

export default function Markdown({ text }) {
  const blocks = useMemo(() => parseBlocks(text || ''), [text]);

  return (
    <div className="md">
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          return (
            <pre key={index} className="md-pre">
              {block.lang ? <span className="md-pre-lang">{block.lang}</span> : null}
              <code>{block.lines.join('\n')}</code>
            </pre>
          );
        }
        if (block.type === 'heading') {
          return React.createElement(
            `h${Math.min(block.level + 3, 6)}`,
            { key: index, className: 'md-heading' },
            parseInline(block.text),
          );
        }
        if (block.type === 'quote') {
          return <blockquote key={index} className="md-quote">{parseInline(block.text)}</blockquote>;
        }
        if (block.type === 'list') {
          return (
            <ul key={index} className="md-list">
              {block.items.map((item, i) => <li key={i}>{parseInline(item)}</li>)}
            </ul>
          );
        }
        return (
          <p key={index} className="md-p">
            {block.lines.map((line, i) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                {parseInline(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
