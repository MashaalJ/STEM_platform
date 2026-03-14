import React, { useState } from 'react';
import type { ShortAnswerContent, ChallengeContent } from '../types';

export const defaultContent = (): ShortAnswerContent => ({
  question: '',
  accept: [''],
  caseSensitive: false,
});

export function evaluate(content: ChallengeContent, response: unknown): { score: number; correct: boolean } {
  const c = content as ShortAnswerContent;
  const ans = String(response ?? '').trim();
  const accept = (c.accept || []).map((a) => (c.caseSensitive ? a : a.toLowerCase()));
  const normalized = c.caseSensitive ? ans : ans.toLowerCase();
  const correct = accept.some((a) => a && normalized === a);
  return { score: correct ? 1 : 0, correct };
}

export function ShortAnswerEditor({ content, onChange }: { content: ChallengeContent; onChange: (c: ChallengeContent) => void }) {
  const c = content as ShortAnswerContent;
  const update = (patch: Partial<ShortAnswerContent>) => onChange({ ...c, ...patch });
  return (
    <div className="space-y-4">
      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Question</label>
      <textarea
        value={c.question}
        onChange={(e) => update({ question: e.target.value })}
        placeholder="Enter the question..."
        className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-3 text-slate-100 min-h-[80px]"
        rows={2}
      />
      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Acceptable answers (one per line)</label>
      <textarea
        value={c.accept?.join('\n') ?? ''}
        onChange={(e) => update({ accept: e.target.value.split(/\n/).map((s) => s.trim()).filter(Boolean) })}
        placeholder="answer1"
        className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-3 text-slate-100 font-mono text-sm"
        rows={3}
      />
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={c.caseSensitive ?? false} onChange={(e) => update({ caseSensitive: e.target.checked })} className="rounded border-slate-500" />
        <span className="text-sm text-slate-300">Case sensitive</span>
      </label>
    </div>
  );
}

export function ShortAnswerPlayer({ content, onComplete, disabled }: { content: ChallengeContent; onComplete: (response: unknown) => void; disabled?: boolean }) {
  const c = content as ShortAnswerContent;
  const [value, setValue] = useState('');
  return (
    <div className="space-y-4">
      <p className="text-slate-200 font-medium">{c.question}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Your answer..."
        className="w-full bg-slate-700/60 border border-slate-600/50 rounded-xl px-4 py-3 text-slate-100"
        disabled={disabled}
      />
      <button type="button" onClick={() => onComplete(value)} disabled={disabled || !value.trim()} className="px-4 py-2 rounded-xl bg-cyan-500 text-white font-black text-sm uppercase disabled:opacity-50">
        Check
      </button>
    </div>
  );
}
