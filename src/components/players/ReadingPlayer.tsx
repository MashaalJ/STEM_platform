/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Lightweight markdown → HTML (headers, bold, italic, lists, code). */
function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let inCode = false;
  let codeBuf: string[] = [];

  const flushLists = () => {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  };

  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1 text-sm text-[#0a2540]">$1</code>');

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('```')) {
      if (inCode) {
        out.push(`<pre class="my-4 overflow-x-auto rounded-lg bg-slate-100 p-4 text-sm text-[#0a2540]"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        flushLists();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(raw);
      continue;
    }

    if (/^###\s+/.test(line)) {
      flushLists();
      out.push(`<h3 class="mt-6 mb-2 text-lg font-bold text-[#0a2540]">${inline(line.replace(/^###\s+/, ''))}</h3>`);
      continue;
    }
    if (/^##\s+/.test(line)) {
      flushLists();
      out.push(`<h2 class="mt-8 mb-3 text-xl font-bold text-[#0a2540]">${inline(line.replace(/^##\s+/, ''))}</h2>`);
      continue;
    }
    if (/^#\s+/.test(line)) {
      flushLists();
      out.push(`<h1 class="mt-8 mb-3 text-2xl font-black text-[#0a2540]">${inline(line.replace(/^#\s+/, ''))}</h1>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inUl) {
        flushLists();
        out.push('<ul class="my-3 list-disc pl-6 space-y-1">');
        inUl = true;
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      if (!inOl) {
        flushLists();
        out.push('<ol class="my-3 list-decimal pl-6 space-y-1">');
        inOl = true;
      }
      out.push(`<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`);
      continue;
    }

    flushLists();
    if (!line.trim()) {
      out.push('<p class="my-3">&nbsp;</p>');
    } else {
      out.push(`<p class="my-3">${inline(line)}</p>`);
    }
  }

  flushLists();
  if (inCode && codeBuf.length) {
    out.push(`<pre class="my-4 overflow-x-auto rounded-lg bg-slate-100 p-4 text-sm text-[#0a2540]"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
  }

  return out.join('\n');
}

export default function ReadingPlayer({
  body,
  title,
  estimated_minutes,
  onComplete,
  onClose,
}: {
  body: string;
  title: string;
  estimated_minutes?: number;
  onComplete: () => void;
  onClose: () => void;
}) {
  const html = renderMarkdown(body || '');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-slate-200/90 p-2 text-[#0a2540] hover:bg-slate-300"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        <div className="overflow-y-auto px-8 pb-8 pt-14">
          <h1 className="text-2xl font-black text-[#0a2540]">{title}</h1>
          {estimated_minutes != null && estimated_minutes > 0 && (
            <p className="mt-1 text-sm text-slate-500">~{estimated_minutes} min read</p>
          )}

          <div
            className="prose-reading mx-auto mt-6 max-w-[680px] text-[#0a2540]"
            style={{ lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: html || '<p class="text-slate-500">No content.</p>' }}
          />

          <div className="mx-auto mt-10 max-w-[680px] border-t border-slate-200 pt-6">
            {/* TODO: enable only after scroll reaches bottom */}
            <button
              type="button"
              onClick={onComplete}
              className="rounded-xl bg-[#0a2540] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0d3a6b]"
            >
              I have read this
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
