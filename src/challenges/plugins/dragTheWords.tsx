import React, { useState } from 'react';
import type { DragTheWordsContent, ChallengeContent } from '../types';

// Content format: text with **word** for each blank. Blanks array = order of correct words.
export const defaultContent = (): DragTheWordsContent => ({
  text: 'Ultrasonic sensors measure **distance** using **sound** waves.',
  blanks: ['distance', 'sound'],
});

function extractBlanks(text: string): string[] {
  const re = /\*\*([^*]+)\*\*/g;
  const out: string[] = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

export function evaluate(content: ChallengeContent, response: unknown): { score: number; correct: boolean } {
  const c = content as DragTheWordsContent;
  const user = Array.isArray(response) ? response : [];
  if (user.length !== c.blanks.length) return { score: 0, correct: false };
  let correct = 0;
  for (let i = 0; i < c.blanks.length; i++) {
    if (String(user[i]).trim().toLowerCase() === c.blanks[i].toLowerCase()) correct++;
  }
  const score = c.blanks.length ? correct / c.blanks.length : 0;
  return { score, correct: score >= 1 };
}

export function DragTheWordsEditor({
  content,
  onChange,
}: {
  content: ChallengeContent;
  onChange: (c: ChallengeContent) => void;
}) {
  const c = content as DragTheWordsContent;
  const blanks = c.blanks.length ? c.blanks : extractBlanks(c.text);
  const update = (patch: Partial<DragTheWordsContent>) => onChange({ ...c, ...patch });
  return (
    <div className="space-y-4">
      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Sentence (wrap draggable words in **word**)</label>
      <textarea
        value={c.text}
        onChange={(e) => {
          const text = e.target.value;
          update({ text, blanks: extractBlanks(text) });
        }}
        placeholder="Ultrasonic sensors measure **distance** using **sound** waves."
        className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-3 text-slate-100 min-h-[80px]"
        rows={2}
      />
      <p className="text-xs text-slate-500">Words in **double stars** become blank slots. Current blanks: {blanks.join(', ') || 'none'}</p>
    </div>
  );
}

export function DragTheWordsPlayer({
  content,
  onComplete,
  disabled,
}: {
  content: ChallengeContent;
  onComplete: (response: unknown) => void;
  disabled?: boolean;
}) {
  const c = content as DragTheWordsContent;
  const parts = c.text.split(/(\*\*[^*]+\*\*)/g);
  const blanks = c.blanks.length ? c.blanks : extractBlanks(c.text);
  const [filled, setFilled] = useState<string[]>(Array(blanks.length).fill(''));
  const [pool] = useState(() => [...blanks].sort(() => Math.random() - 0.5));
  const setBlank = (idx: number, word: string) => {
    const next = [...filled];
    next[idx] = word;
    setFilled(next);
  };
  let blankIdx = 0;
  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">Drag words into the blanks (or choose from dropdown).</p>
      <div className="flex flex-wrap items-baseline gap-1 text-slate-200">
        {parts.map((p, i) => {
          if (p.startsWith('**') && p.endsWith('**')) {
            const idx = blankIdx++;
            return (
              <select
                key={i}
                value={filled[idx] ?? ''}
                onChange={(e) => setBlank(idx, e.target.value)}
                disabled={disabled}
                className="min-w-[100px] px-2 py-1 bg-slate-700/60 border border-slate-500/50 rounded text-slate-100 text-sm"
              >
                <option value="">—</option>
                {pool.map((w, j) => (
                  <option key={j} value={w}>{w}</option>
                ))}
              </select>
            );
          }
          return <span key={i}>{p.replace(/\*\*/g, '')}</span>;
        })}
      </div>
      <button
        type="button"
        onClick={() => onComplete(filled)}
        disabled={disabled || filled.some((f) => !f)}
        className="px-4 py-2 rounded-xl bg-cyan-500 text-white font-black text-sm uppercase disabled:opacity-50"
      >
        Check
      </button>
    </div>
  );
}
