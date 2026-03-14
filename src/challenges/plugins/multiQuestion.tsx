import React, { useMemo, useState } from 'react';
import type { ChallengeContent, ChallengeType, MultiQuestionContent } from '../types';
import { getAllChallengeTypes, getChallengeType, getDefaultContent, evaluateResponse } from '../registry';

export const defaultContent = (): MultiQuestionContent => ({
  questions: [
    { type: 'multiple_choice', content: getDefaultContent('multiple_choice') || {} },
  ],
});

export function evaluate(content: ChallengeContent, response: unknown): { score: number; correct: boolean } {
  const c = content as MultiQuestionContent;
  const answers = Array.isArray(response) ? response : [];
  const qs = c.questions || [];
  if (qs.length === 0) return { score: 0, correct: false };
  let correctCount = 0;
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    const r = evaluateResponse(q.type as ChallengeType, q.content, answers[i]);
    if (r.correct) correctCount += 1;
  }
  const score = qs.length ? correctCount / qs.length : 0;
  return { score, correct: score >= 1 };
}

export function MultiQuestionEditor({
  content,
  onChange,
}: {
  content: ChallengeContent;
  onChange: (c: ChallengeContent) => void;
}) {
  const c = content as MultiQuestionContent;
  const questions = c.questions || [];

  const types = useMemo(() => getAllChallengeTypes().filter((t) => t.meta.id !== 'multi_question'), []);

  const update = (patch: Partial<MultiQuestionContent>) => onChange({ ...c, ...patch });

  const add = (type: Exclude<ChallengeType, 'multi_question'>) => {
    update({ questions: [...questions, { type, content: getDefaultContent(type) || {} }] });
  };

  const updateContentAt = (i: number, cc: ChallengeContent) => {
    const next = [...questions];
    next[i] = { ...next[i], content: cc };
    update({ questions: next });
  };

  const changeTypeAt = (i: number, type: Exclude<ChallengeType, 'multi_question'>) => {
    const next = [...questions];
    next[i] = { type, content: getDefaultContent(type) || {} };
    update({ questions: next });
  };

  const removeAt = (i: number) => update({ questions: questions.filter((_, idx) => idx !== i) });

  const move = (i: number, dir: number) => {
    const to = i + dir;
    if (to < 0 || to >= questions.length) return;
    const next = [...questions];
    [next[i], next[to]] = [next[to], next[i]];
    update({ questions: next });
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">
        This challenge contains multiple questions. Students will complete them sequentially.
      </p>

      <div className="space-y-3">
        {questions.map((q, i) => {
          const plugin = getChallengeType(q.type as ChallengeType);
          const Editor = plugin?.Editor;
          return (
            <div key={i} className="rounded-2xl border border-slate-600/50 bg-slate-800/40 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Question {i + 1}</span>
                  <select
                    value={q.type}
                    onChange={(e) => changeTypeAt(i, e.target.value as any)}
                    className="bg-slate-800/60 border border-slate-600/50 rounded-lg px-2 py-1 text-[10px] font-black uppercase outline-none"
                  >
                    {types.map((t) => (
                      <option key={t.meta.id} value={t.meta.id}>
                        {t.meta.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-xs text-slate-400 hover:text-cyan-400 font-black uppercase disabled:opacity-30">
                    Up
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === questions.length - 1} className="text-xs text-slate-400 hover:text-cyan-400 font-black uppercase disabled:opacity-30">
                    Down
                  </button>
                  <button type="button" onClick={() => removeAt(i)} className="text-xs text-rose-400 hover:text-rose-300 font-black uppercase">
                    Delete
                  </button>
                </div>
              </div>
              {Editor ? (
                <Editor content={q.content} onChange={(cc) => updateContentAt(i, cc)} />
              ) : (
                <div className="text-slate-500 text-sm">Editor not available for this type.</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {types.map((t) => (
          <button
            key={t.meta.id}
            type="button"
            onClick={() => add(t.meta.id as any)}
            className="px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 text-xs font-black uppercase hover:border-cyan-500/40 hover:text-cyan-400"
          >
            + {t.meta.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MultiQuestionPlayer({
  content,
  onComplete,
  disabled,
}: {
  content: ChallengeContent;
  onComplete: (response: unknown) => void;
  disabled?: boolean;
}) {
  const c = content as MultiQuestionContent;
  const questions = c.questions || [];
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<unknown[]>([]);

  if (questions.length === 0) {
    return <div className="text-slate-400">No questions in this challenge.</div>;
  }

  const q = questions[idx];
  const plugin = getChallengeType(q.type as ChallengeType);
  const Player = plugin?.Player;

  const handle = (resp: unknown) => {
    const next = [...answers];
    next[idx] = resp;
    setAnswers(next);
    if (idx < questions.length - 1) setIdx((i) => i + 1);
    else onComplete(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase font-black text-slate-500">
          Question {idx + 1} of {questions.length}
        </span>
        {idx > 0 && (
          <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={disabled} className="text-xs text-slate-400 hover:text-cyan-400 font-black uppercase">
            Back
          </button>
        )}
      </div>
      {Player ? (
        <Player content={q.content} onComplete={handle} disabled={disabled} />
      ) : (
        <div className="text-slate-400">Unsupported question type: {q.type}</div>
      )}
    </div>
  );
}

