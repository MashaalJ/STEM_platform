import React, { useState } from 'react';
import { Image, Video, Mic, Check, Circle, Trash2 } from 'lucide-react';
import type { MultipleChoiceContent, ChallengeContent } from '../types';

export const defaultContent = (): MultipleChoiceContent => ({
  question: '',
  multiple: false,
  options: [
    { text: '', correct: false },
    { text: '', correct: false },
  ],
  partialScoring: false,
});

export function evaluate(content: ChallengeContent, response: unknown): { score: number; correct: boolean } {
  const c = content as MultipleChoiceContent;
  const ans = Array.isArray(response) ? response : response === null || response === undefined ? [] : [response];
  const correctIndices = c.options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0);
  const selected = new Set(ans.map((a: unknown) => Number(a)));
  const correctSet = new Set(correctIndices);
  if (c.partialScoring && c.multiple) {
    let score = 0;
    correctIndices.forEach((i) => {
      if (selected.has(i)) score += 1;
    });
    const wrongSelected = [...selected].filter((i) => !correctSet.has(i)).length;
    const partial = correctIndices.length ? Math.max(0, score / correctIndices.length - wrongSelected * 0.25) : 0;
    return { score: Math.min(1, partial), correct: partial >= 1 };
  }
  if (selected.size !== correctSet.size) return { score: 0, correct: false };
  const allCorrect = correctIndices.every((i) => selected.has(i)) && [...selected].every((i) => correctSet.has(i));
  return { score: allCorrect ? 1 : 0, correct: allCorrect };
}

const POD_LETTERS = 'ABCDEFGHIJ';

export function MultipleChoiceEditor({
  content,
  onChange,
  xpReward,
  onXpRewardChange,
  timeLimitSec,
  onTimeLimitSecChange,
}: {
  content: ChallengeContent;
  onChange: (c: ChallengeContent) => void;
  xpReward?: number;
  onXpRewardChange?: (v: number) => void;
  timeLimitSec?: number;
  onTimeLimitSecChange?: (v: number) => void;
}) {
  const c = content as MultipleChoiceContent;
  const update = (patch: Partial<MultipleChoiceContent>) => onChange({ ...c, ...patch });
  const [linkedImage, setLinkedImage] = useState<string | null>(null);

  const setCorrect = (index: number) => {
    const opts = c.options.map((o, j) => ({ ...o, correct: j === index }));
    update({ options: opts });
  };

  const removeOption = (index: number) => {
    if (c.options.length <= 2) return;
    const opts = c.options.filter((_, i) => i !== index);
    update({ options: opts });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left: Prompt + Rewards (mockup MCQ) */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        <div className="bg-slate-900/50 border border-[#2d3548] rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-[#256af4]">
              <span className="text-xl">Challenge Prompt</span>
            </h3>
            <div className="flex gap-2">
              <button type="button" className="p-2 rounded-lg bg-slate-800 text-slate-500 hover:text-[#256af4] transition-colors" title="Add image">
                <Image className="w-5 h-5" />
              </button>
              <button type="button" className="p-2 rounded-lg bg-slate-800 text-slate-500 hover:text-[#256af4] transition-colors" title="Add video">
                <Video className="w-5 h-5" />
              </button>
              <button type="button" className="p-2 rounded-lg bg-slate-800 text-slate-500 hover:text-[#256af4] transition-colors" title="Add audio">
                <Mic className="w-5 h-5" />
              </button>
            </div>
          </div>
          <textarea
            value={c.question}
            onChange={(e) => update({ question: e.target.value })}
            placeholder="Enter the scientific question students must solve..."
            className="w-full min-h-[160px] bg-slate-950 border border-[#2d3548] rounded-xl p-4 text-lg text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-[#256af4]/50 focus:border-[#256af4] outline-none resize-none"
            rows={4}
          />
          {linkedImage && (
            <div className="mt-6 flex items-center gap-4 p-4 rounded-xl bg-[#256af4]/5 border border-dashed border-[#256af4]/30">
              <div className="size-20 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700">
                <Image className="w-10 h-10 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-200 truncate">Linked Visual Asset</p>
                <p className="text-xs text-slate-500">Optional</p>
              </div>
              <button type="button" onClick={() => setLinkedImage(null)} className="text-slate-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          )}
          <div className="mt-4 flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input type="checkbox" checked={c.multiple} onChange={(e) => update({ multiple: e.target.checked })} className="rounded border-slate-500 text-[#256af4]" />
              Allow multiple answers
            </label>
            {c.multiple && (
              <label className="flex items-center gap-2 text-sm text-slate-400">
                <input type="checkbox" checked={c.partialScoring ?? false} onChange={(e) => update({ partialScoring: e.target.checked })} className="rounded border-slate-500 text-[#256af4]" />
                Partial scoring
              </label>
            )}
          </div>
        </div>

        {/* Challenge Rewards (mockup) */}
        <div className="bg-slate-900/50 border border-[#2d3548] rounded-xl p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Challenge Rewards</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-[#2d3548] flex flex-col gap-2">
              <div className="flex items-center gap-2 text-amber-500">
                <span className="font-bold text-sm">XP Bonus</span>
              </div>
              <input
                type="number"
                min={0}
                value={xpReward ?? 250}
                onChange={(e) => onXpRewardChange?.(Number(e.target.value) || 0)}
                className="bg-transparent border-0 p-0 text-2xl font-bold text-slate-100 focus:ring-0 w-full"
              />
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-[#2d3548] flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[#256af4]">
                <span className="font-bold text-sm">Energy Cost</span>
              </div>
              <input type="number" min={0} defaultValue={15} className="bg-transparent border-0 p-0 text-2xl font-bold text-slate-100 focus:ring-0 w-full" readOnly />
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-[#2d3548] flex flex-col gap-2">
              <div className="flex items-center gap-2 text-emerald-500">
                <span className="font-bold text-sm">Time Limit</span>
              </div>
              <div className="flex items-baseline gap-1">
                <input
                  type="number"
                  min={0}
                  value={timeLimitSec ?? 45}
                  onChange={(e) => onTimeLimitSecChange?.(Number(e.target.value) || 0)}
                  className="bg-transparent border-0 p-0 text-2xl font-bold text-slate-100 focus:ring-0 w-14"
                />
                <span className="text-xs text-slate-500">sec</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Data Pods (Answers) - mockup */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <h3 className="text-lg font-bold flex items-center gap-2 text-[#256af4] px-1">
          Data Pods (Answers)
        </h3>
        {c.options.map((opt, i) => {
          const isCorrect = opt.correct;
          const podLabel = `Pod ${POD_LETTERS[i]}`;
          return (
            <div
              key={i}
              className={`relative rounded-xl p-5 transition-all cursor-pointer group ${
                isCorrect
                  ? 'bg-slate-900 border-2 border-emerald-500 shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-900 border border-[#2d3548] hover:border-[#256af4]/50'
              }`}
            >
              {isCorrect && <div className="absolute inset-0 bg-emerald-500/5 blur-xl rounded-xl pointer-events-none" />}
              <div className="relative flex items-start justify-between mb-2">
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                    isCorrect ? 'bg-emerald-500 text-slate-900' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {podLabel} {isCorrect ? '✓ Right answer' : ''}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCorrect(i)}
                    className={`size-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isCorrect ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-[#256af4]'
                    }`}
                    title={isCorrect ? 'Correct answer' : 'Set as correct'}
                  >
                    {isCorrect ? <Check className="w-3.5 h-3.5 text-slate-900" /> : <Circle className="w-3.5 h-3.5 text-slate-500" />}
                  </button>
                  {c.options.length > 2 && (
                    <button type="button" onClick={() => removeOption(i)} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Remove">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <input
                type="text"
                value={opt.text}
                onChange={(e) => {
                  const opts = [...c.options];
                  opts[i] = { ...opts[i], text: e.target.value };
                  update({ options: opts });
                }}
                placeholder={`Option ${i + 1}`}
                className="relative w-full bg-transparent border-0 p-0 text-xl font-bold text-slate-100 focus:ring-0 placeholder:text-slate-500"
              />
              <div className={`mt-3 h-1 w-full rounded-full overflow-hidden ${isCorrect ? 'bg-emerald-500/30' : 'bg-slate-800'}`}>
                <div className={`h-full ${isCorrect ? 'bg-emerald-500 w-full' : 'bg-slate-600 w-0 group-hover:w-1/3'} transition-all`} />
              </div>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => update({ options: [...c.options, { text: '', correct: false }] })}
          className="flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-slate-600 rounded-xl text-slate-500 hover:border-[#256af4] hover:text-[#256af4] transition-all font-bold"
        >
          <span className="text-xl">+</span>
          Add Alternative Pod
        </button>
      </div>
    </div>
  );
}

export function MultipleChoicePlayer({
  content,
  onComplete,
  disabled,
}: {
  content: ChallengeContent;
  onComplete: (response: unknown) => void;
  disabled?: boolean;
}) {
  const c = content as MultipleChoiceContent;
  const [selected, setSelected] = useState<number[]>([]);
  const handleSubmit = () => {
    onComplete(c.multiple ? selected : selected[0]);
  };
  const toggle = (i: number) => {
    if (c.multiple) setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
    else setSelected([i]);
  };
  return (
    <div className="space-y-4">
      <p className="text-slate-200 font-medium">{c.question}</p>
      <div className="space-y-2">
        {c.options.map((opt, i) => (
          <label
            key={i}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              selected.includes(i) ? 'border-[#256af4]/60 bg-[#256af4]/10' : 'border-[#2d3548] bg-slate-800/40 hover:border-slate-500'
            } ${disabled ? 'opacity-70 pointer-events-none' : ''}`}
          >
            <input
              type={c.multiple ? 'checkbox' : 'radio'}
              name="mcq"
              checked={selected.includes(i)}
              onChange={() => toggle(i)}
              className="rounded border-slate-500 text-[#256af4]"
            />
            <span className="text-slate-200">{opt.text}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || (c.multiple ? false : selected.length === 0)}
        className="px-4 py-2 rounded-xl bg-[#256af4] text-white font-bold text-sm disabled:opacity-50"
      >
        Check
      </button>
    </div>
  );
}
