import React, { useRef, useState } from 'react';
import { Image, Video, Mic, Check, Circle, Trash2, Link, Upload } from 'lucide-react';
import type { MultipleChoiceContent, ChallengeContent, MediaType } from '../types';

export const defaultContent = (): MultipleChoiceContent => ({
  question: '',
  multiple: false,
  options: [
    { text: '', correct: false },
    { text: '', correct: false },
  ],
  partialScoring: false,
  time_limit_sec: 45,
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
  const [showMediaInput, setShowMediaInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const applyMediaFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      update({ mediaType: 'image', mediaUrl: result });
      setShowMediaInput(true);
    };
    reader.readAsDataURL(file);
  };

  const handleMediaPaste = (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const files: File[] = Array.from(e.clipboardData.files || []);
    const image = files.find((f) => f.type.startsWith('image/'));
    if (!image) return;
    e.preventDefault();
    applyMediaFile(image);
  };

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
      {/* Left: Prompt + Rewards (mockup MCQ) - wider for readability */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        <div className="bg-slate-900/50 border border-[#2d3548] rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-lg font-bold flex items-center gap-2 text-[#256af4]">
              <span className="text-xl">Challenge Prompt</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Media (optional)</span>
              {(['image', 'video', 'audio'] as MediaType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setShowMediaInput(true); update({ mediaType: type, mediaUrl: c.mediaType === type ? c.mediaUrl : '' }); }}
                  className={`p-2 rounded-lg transition-colors ${c.mediaType === type ? 'bg-[#256af4]/20 text-[#256af4]' : 'bg-slate-800 text-slate-500 hover:text-[#256af4]'}`}
                  title={`Add ${type}`}
                >
                  {type === 'image' && <Image className="w-5 h-5" />}
                  {type === 'video' && <Video className="w-5 h-5" />}
                  {type === 'audio' && <Mic className="w-5 h-5" />}
                </button>
              ))}
              {c.mediaUrl && (
                <button type="button" onClick={() => update({ mediaUrl: undefined, mediaType: undefined })} className="p-2 rounded-lg text-slate-400 hover:text-red-500 transition-colors" title="Remove media">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) applyMediaFile(file);
                  e.currentTarget.value = '';
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-[#256af4] transition-colors"
                title="Upload image"
              >
                <Upload className="w-5 h-5" />
              </button>
            </div>
          </div>
          {(showMediaInput || c.mediaType) && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Link className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="url"
                value={c.mediaUrl ?? ''}
                onChange={(e) => update({ mediaUrl: e.target.value.trim() || undefined })}
                onPaste={handleMediaPaste}
                placeholder="Paste image, video, or audio URL..."
                className="flex-1 min-w-[200px] bg-slate-950 border border-[#2d3548] rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-[#256af4]/50 focus:border-[#256af4] outline-none"
              />
              <button type="button" onClick={() => setShowMediaInput(false)} className="text-slate-300 hover:text-white text-xs font-bold">Done</button>
            </div>
          )}
          {c.mediaUrl && (
            <div className="mb-4 rounded-xl overflow-hidden border border-[#2d3548] bg-slate-950">
              {c.mediaType === 'image' && (
                <img src={c.mediaUrl} alt="Question media" className="w-full max-h-64 object-contain" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
              {c.mediaType === 'video' && (
                <video src={c.mediaUrl} controls className="w-full max-h-64" />
              )}
              {c.mediaType === 'audio' && (
                <div className="p-4">
                  <audio src={c.mediaUrl} controls className="w-full" />
                </div>
              )}
            </div>
          )}
          <textarea
            value={c.question}
            onChange={(e) => update({ question: e.target.value })}
            onPaste={handleMediaPaste}
            placeholder="Enter the scientific question students must solve..."
            className="w-full min-h-[160px] bg-slate-950 border border-[#2d3548] rounded-xl p-4 text-lg text-white placeholder:text-slate-300 focus:ring-2 focus:ring-[#256af4]/50 focus:border-[#256af4] outline-none resize-none"
            rows={4}
          />
          <div className="mt-4 flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input type="checkbox" checked={c.multiple} onChange={(e) => update({ multiple: e.target.checked })} className="rounded border-slate-500 text-[#256af4]" />
              Allow multiple answers
            </label>
            {c.multiple && (
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={c.partialScoring ?? false} onChange={(e) => update({ partialScoring: e.target.checked })} className="rounded border-slate-500 text-[#256af4]" />
                Partial scoring
              </label>
            )}
          </div>
        </div>

        {/* Challenge Rewards (mockup) */}
        <div className="bg-slate-900/50 border border-[#2d3548] rounded-xl p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-4">Challenge Rewards</h3>
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
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    onTimeLimitSecChange?.(v);
                    update({ time_limit_sec: v });
                  }}
                  className="bg-transparent border-0 p-0 text-2xl font-bold text-slate-100 focus:ring-0 w-14"
                />
                <span className="text-xs text-slate-300">sec</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Data Pods (Answers) - mockup */}
      <div className="lg:col-span-4 flex flex-col gap-4">
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
                    isCorrect ? 'bg-emerald-500 text-slate-900' : 'bg-slate-800 text-slate-300'
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
  const configuredLimit = Math.max(5, Number(c.time_limit_sec || 20));
  const [selected, setSelected] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(configuredLimit);
  const podStyles = [
    { border: 'border-l-rose-400', glow: 'hover:bg-rose-500/15', badge: 'bg-rose-500', symbol: '▲' },
    { border: 'border-l-sky-400', glow: 'hover:bg-sky-500/15', badge: 'bg-sky-500', symbol: '◆' },
    { border: 'border-l-amber-400', glow: 'hover:bg-amber-500/15', badge: 'bg-amber-500', symbol: '⬡' },
    { border: 'border-l-emerald-400', glow: 'hover:bg-emerald-500/15', badge: 'bg-emerald-500', symbol: '●' },
  ];

  React.useEffect(() => {
    if (disabled) return;
    setTimeLeft(configuredLimit);
  }, [configuredLimit, disabled]);

  React.useEffect(() => {
    if (disabled) return;
    const t = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(t);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [disabled, configuredLimit]);

  const handleSubmit = () => {
    onComplete(c.multiple ? selected : selected[0]);
  };
  const toggle = (i: number) => {
    if (c.multiple) setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
    else setSelected([i]);
  };
  return (
    <div className="relative min-h-screen w-full text-white overflow-y-auto px-4 sm:px-10 lg:px-[40px] pt-[72px] pb-12">
      <div className="fixed inset-0 z-[-1] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,_#112a4a_0%,_#081a34_45%,_#030b1d_100%)]" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_22%,_rgba(255,178,4,0.16)_0%,_transparent_34%),radial-gradient(circle_at_78%_72%,_rgba(37,99,235,0.20)_0%,_transparent_36%),radial-gradient(circle_at_52%_48%,_rgba(125,211,252,0.08)_0%,_transparent_45%)]" />
        <div className="absolute top-1/4 left-1/4 w-[28rem] h-[28rem] bg-[#ffb204]/10 blur-[130px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-blue-500/12 blur-[140px] rounded-full" />
      </div>

      <main className="relative min-h-[calc(100vh-72px)] flex flex-col justify-center items-center gap-8">
        <div className="w-full max-w-7xl flex justify-between items-center">
          <div className="bg-[rgba(13,28,50,0.6)] backdrop-blur-[20px] border border-[rgba(255,178,4,0.24)] shadow-[0_0_15px_rgba(255,178,4,0.3)] px-8 py-4 rounded-xl border-l-4 border-l-[#ffb204] flex flex-col items-center">
            <span className="text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[#ffb204]">Current streak</span>
            <span className="text-[48px] sm:text-[56px] leading-[1.1] tracking-[-0.02em] font-bold italic text-[#ffb204] drop-shadow-[0_0_8px_rgba(255,178,4,0.55)]">
              {Math.max(1, selected.length)}X COMBO!
            </span>
          </div>

          <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
            <svg viewBox="0 0 128 128" className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="64" cy="64" r="58" stroke="rgb(30 41 59)" strokeWidth="8" fill="transparent" />
              <circle
                cx="64"
                cy="64"
                r="58"
                stroke="rgb(255 178 4)"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={364}
                strokeDashoffset={364 - (timeLeft / configuredLimit) * 364}
                className="drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]"
              />
            </svg>
            <div className="w-24 h-24 rounded-full bg-[rgba(13,28,50,0.6)] backdrop-blur-[20px] border border-[rgba(255,178,4,0.24)] shadow-[0_0_15px_rgba(255,178,4,0.3)] flex flex-col items-center justify-center">
              <span className="text-[32px] leading-none tracking-[-0.01em] font-semibold text-[#ffb204]">{timeLeft}</span>
              <span className="text-[10px] font-bold text-[#ffb204]/75 tracking-[0.12em] uppercase">Flux</span>
            </div>
          </div>
        </div>

        <div className="w-full max-w-4xl text-center">
          <div className="bg-[rgba(13,28,50,0.62)] backdrop-blur-[20px] border border-[rgba(255,178,4,0.24)] shadow-[0_0_15px_rgba(255,178,4,0.3)] p-8 sm:p-12 rounded-[2rem] relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#ffb204] text-slate-950 px-6 py-1 text-[12px] leading-none tracking-[0.1em] uppercase font-bold rounded-b-xl">
              Mission Objective 04
            </div>
            <h1 className="text-white text-[30px] sm:text-[48px] leading-[1.15] tracking-[-0.02em] font-bold mt-4">
              {c.question}
            </h1>
          </div>
        </div>

        {c.mediaUrl && (
          <div className="w-full max-w-5xl rounded-xl overflow-hidden border border-slate-600 bg-slate-800/50">
            {c.mediaType === 'image' && (
              <img src={c.mediaUrl} alt="" className="w-full max-h-72 object-contain" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            {c.mediaType === 'video' && <video src={c.mediaUrl} controls className="w-full max-h-72" />}
            {c.mediaType === 'audio' && (
              <div className="p-4"><audio src={c.mediaUrl} controls className="w-full" /></div>
            )}
          </div>
        )}

        <div className="w-full max-w-7xl flex gap-6 items-end">
          <aside className="hidden lg:flex flex-col w-72 bg-[rgba(13,28,50,0.6)] backdrop-blur-[20px] border border-[rgba(255,178,4,0.24)] shadow-[0_0_15px_rgba(255,178,4,0.3)] rounded-xl p-6">
            <h3 className="text-[24px] leading-[1.3] font-semibold text-[#ffb204] mb-4 uppercase">Top explorers</h3>
            <div className="space-y-4">
              {['Nova_01', 'CyberGhost', 'StarDust'].map((name, idx) => (
                <div key={name} className={`flex items-center gap-3 p-3 rounded-lg ${idx === 0 ? 'bg-[#ffb204]/12 border border-[#ffb204]/24' : 'border border-white/5'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${idx === 0 ? 'bg-[#ffb204] text-slate-950' : 'bg-slate-800 text-white'}`}>{idx + 1}</div>
                  <div className="flex-1">
                    <p className="text-white text-[16px] leading-[1.5] font-bold">{name}</p>
                    <p className={`text-xs ${idx === 0 ? 'text-[#ffb204]' : 'text-slate-300'}`}>{[2840, 2150, 1980][idx].toLocaleString()} XP</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            {c.options.map((opt, i) => {
              const style = podStyles[i % podStyles.length];
              const active = selected.includes(i);
              return (
                <label
                  key={i}
                  className={`group bg-[rgba(13,28,50,0.6)] backdrop-blur-[20px] border border-[rgba(255,178,4,0.24)] shadow-[0_0_15px_rgba(255,178,4,0.3)] p-6 rounded-xl border-l-4 cursor-pointer transition-all flex items-center gap-6 text-left ${
                    active ? `${style.border} ${style.glow}` : `${style.border} ${style.glow}`
                  } ${disabled ? 'opacity-70 pointer-events-none' : ''}`}
                >
                  <div
                    className={`w-12 h-12 ${style.badge} text-slate-950 flex items-center justify-center text-3xl`}
                    style={
                      i % 4 === 0
                        ? { clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }
                        : i % 4 === 2
                          ? { clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)" }
                          : i % 4 === 1
                            ? { transform: "rotate(45deg)" }
                            : undefined
                    }
                  >
                    <span style={i % 4 === 1 ? { transform: "rotate(-45deg)" } : undefined}>{style.symbol}</span>
                  </div>
                  <input
                    type={c.multiple ? 'checkbox' : 'radio'}
                    name="mcq"
                    checked={active}
                    onChange={() => toggle(i)}
                    className="sr-only"
                  />
                  <span className="text-[24px] leading-[1.3] font-semibold text-white">{opt.text}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="w-full max-w-7xl flex justify-center">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || selected.length === 0}
            className="px-8 py-3 rounded-lg bg-[#ffb204] text-slate-950 font-bold shadow-[0_0_15px_rgba(255,178,4,0.45)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Lock answer
          </button>
        </div>
      </main>
    </div>
  );
}
