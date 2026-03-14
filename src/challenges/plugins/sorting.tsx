import React, { useState } from 'react';
import type { SortingContent, ChallengeContent } from '../types';

export const defaultContent = (): SortingContent => ({
  items: ['Step 1', 'Step 2', 'Step 3'],
  correctOrder: ['Step 1', 'Step 2', 'Step 3'],
});

export function evaluate(content: ChallengeContent, response: unknown): { score: number; correct: boolean } {
  const c = content as SortingContent;
  const user = Array.isArray(response) ? response : [];
  const correct = c.correctOrder || c.items;
  if (user.length !== correct.length) return { score: 0, correct: false };
  let match = 0;
  for (let i = 0; i < correct.length; i++) {
    if (String(user[i]).trim() === String(correct[i]).trim()) match++;
  }
  const score = correct.length ? match / correct.length : 0;
  return { score, correct: score >= 1 };
}

export function SortingEditor({
  content,
  onChange,
}: {
  content: ChallengeContent;
  onChange: (c: ChallengeContent) => void;
}) {
  const c = content as SortingContent;
  const items = c.items || [];
  const update = (patch: Partial<SortingContent>) => onChange({ ...c, ...patch });
  const setItem = (i: number, v: string) => {
    const next = [...items];
    next[i] = v;
    update({ items: next, correctOrder: next });
  };
  return (
    <div className="space-y-4">
      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Items (correct order)</label>
      <p className="text-xs text-slate-500">List items in the order students should arrange them.</p>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-slate-500 w-6">{i + 1}.</span>
          <input
            type="text"
            value={item}
            onChange={(e) => setItem(i, e.target.value)}
            placeholder={`Item ${i + 1}`}
            className="flex-1 bg-slate-800/60 border border-slate-600/50 rounded-lg px-3 py-2 text-slate-100 text-sm"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => update({ items: [...items, ''], correctOrder: [...items, ''] })}
        className="text-xs text-cyan-400 font-black uppercase"
      >
        + Add item
      </button>
    </div>
  );
}

export function SortingPlayer({
  content,
  onComplete,
  disabled,
}: {
  content: ChallengeContent;
  onComplete: (response: unknown) => void;
  disabled?: boolean;
}) {
  const c = content as SortingContent;
  const [order, setOrder] = useState<string[]>(() => [...(c.items || [])].sort(() => Math.random() - 0.5));
  const move = (from: number, to: number) => {
    const next = [...order];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    setOrder(next);
  };
  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">Arrange the items in the correct order.</p>
      <div className="space-y-2">
        {order.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/50 border border-slate-600/50"
          >
            <span className="text-slate-500 font-mono text-sm w-6">{i + 1}</span>
            <span className="flex-1 text-slate-200">{item}</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => move(i, Math.max(0, i - 1))}
                disabled={disabled || i === 0}
                className="p-1 rounded bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, Math.min(order.length - 1, i + 1))}
                disabled={disabled || i === order.length - 1}
                className="p-1 rounded bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30"
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onComplete(order)}
        disabled={disabled}
        className="px-4 py-2 rounded-xl bg-cyan-500 text-white font-black text-sm uppercase disabled:opacity-50"
      >
        Check order
      </button>
    </div>
  );
}
