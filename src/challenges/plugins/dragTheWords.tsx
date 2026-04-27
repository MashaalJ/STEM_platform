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
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 sm:px-8 py-12 overflow-y-auto">
      <div className="absolute inset-0 z-[-1] bg-[radial-gradient(circle_at_50%_35%,_#112a4a_0%,_#081a34_45%,_#030b1d_100%)]" />
      <div className="w-full max-w-4xl rounded-3xl border border-amber-400/25 bg-[rgba(13,28,50,0.68)] p-6 sm:p-8 shadow-[0_0_20px_rgba(255,178,4,0.18)] space-y-4">
        <p className="text-slate-100 text-sm">Choose words to fill each blank.</p>
        <div className="flex flex-wrap items-baseline gap-2 text-white text-base">
          {parts.map((p, i) => {
            if (p.startsWith('**') && p.endsWith('**')) {
              const idx = blankIdx++;
              return (
                <select
                  key={i}
                  value={filled[idx] ?? ''}
                  onChange={(e) => setBlank(idx, e.target.value)}
                  disabled={disabled}
                  className="min-w-[120px] px-3 py-2 bg-slate-900/80 border border-amber-400/35 rounded text-white text-sm"
                >
                  <option value="">--</option>
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
          className="px-6 py-3 rounded-xl bg-[#ffb204] text-[#0A192F] font-black text-sm uppercase disabled:opacity-50"
        >
          Check Answer
        </button>
      </div>
    </div>
  );
}
