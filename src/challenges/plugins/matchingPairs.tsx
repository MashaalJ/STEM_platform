import React, { useState } from 'react';
import { Image, Type, PlusCircle, GripVertical } from 'lucide-react';
import type { MatchingPairsContent, ChallengeContent } from '../types';

export const defaultContent = (): MatchingPairsContent => ({
  pairs: [
    { left: 'Sensor', right: 'Detects distance' },
    { left: 'Motor', right: 'Creates movement' },
  ],
});

export function evaluate(content: ChallengeContent, response: unknown): { score: number; correct: boolean } {
  const c = content as MatchingPairsContent;
  const user = (response as Record<string, string> | undefined) ?? {};
  let correct = 0;
  for (const p of c.pairs) {
    if (user[p.left] === p.right) correct++;
  }
  const score = c.pairs.length ? correct / c.pairs.length : 0;
  return { score, correct: score >= 1 };
}

export function MatchingPairsEditor({
  content,
  onChange,
}: {
  content: ChallengeContent;
  onChange: (c: ChallengeContent) => void;
}) {
  const c = content as MatchingPairsContent;
  const update = (patch: Partial<MatchingPairsContent>) => onChange({ ...c, ...patch });
  const [glowIntensity, setGlowIntensity] = useState(85);
  const [autoSnap, setAutoSnap] = useState(true);

  const addPair = () => update({ pairs: [...c.pairs, { left: '', right: '' }] });
  const removePair = (i: number) => {
    if (c.pairs.length <= 1) return;
    update({ pairs: c.pairs.filter((_, j) => j !== i) });
  };

  return (
    <div className="space-y-6">
      {/* Tabs: Editor | Logic & Settings | Theme (mockup) */}
      <div className="flex border-b border-[#2d3548] overflow-x-auto">
        <button type="button" className="flex items-center gap-2 px-6 py-4 border-b-2 border-[#256af4] text-[#256af4] font-bold">
          <GripVertical className="w-4 h-4" />
          Editor
        </button>
        <button type="button" className="flex items-center gap-2 px-6 py-4 border-b-2 border-transparent text-slate-500 hover:text-slate-300 font-medium">
          Logic & Settings
        </button>
        <button type="button" className="flex items-center gap-2 px-6 py-4 border-b-2 border-transparent text-slate-500 hover:text-slate-300 font-medium">
          Theme Styles
        </button>
      </div>

      {/* Options strip — no nested left sidebar; lives inside builder center panel */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-slate-900/50 border border-[#2d3548] mb-4">
        <span className="text-xs font-bold text-slate-400 uppercase">Components</span>
        <div className="flex items-center gap-2">
          <div className="group flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-[#2d3548] cursor-grab hover:border-[#256af4] transition-colors">
            <Image className="w-4 h-4 text-slate-400 group-hover:text-[#256af4]" />
            <span className="text-sm font-medium">Image</span>
          </div>
          <div className="group flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-[#2d3548] cursor-grab hover:border-[#256af4] transition-colors">
            <Type className="w-4 h-4 text-slate-400 group-hover:text-[#256af4]" />
            <span className="text-sm font-medium">Text</span>
          </div>
        </div>
        <span className="text-slate-600">|</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Glow</span>
          <input
            type="range"
            min={0}
            max={100}
            value={glowIntensity}
            onChange={(e) => setGlowIntensity(Number(e.target.value))}
            className="w-24 h-1.5 bg-slate-800 rounded-full appearance-none accent-[#256af4]"
          />
          <span className="text-xs text-[#256af4] w-8">{glowIntensity}%</span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={autoSnap}
            onClick={() => setAutoSnap(!autoSnap)}
            className={`w-9 h-5 rounded-full relative transition-colors ${autoSnap ? 'bg-[#256af4]' : 'bg-slate-700'}`}
          >
            <span className={`absolute top-0.5 size-4 bg-white rounded-full transition-transform ${autoSnap ? 'right-0.5' : 'left-0.5'}`} />
          </button>
          <span className="text-xs text-slate-500">Auto-snap</span>
        </label>
      </div>

      {/* Sources | Targets workspace */}
      <div className="min-h-[400px] bg-slate-900/50 rounded-2xl border border-[#2d3548] overflow-hidden p-6 relative">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(circle,#256af4_1px,transparent_1px)] bg-[length:32px_32px]" />
          <div className="relative grid grid-cols-2 gap-16 h-full">
            {/* Sources column */}
            <div className="flex flex-col gap-8">
              <div className="flex items-center justify-between">
                <h4 className="uppercase tracking-widest text-xs font-bold text-slate-400">Sources</h4>
                <button type="button" onClick={addPair} className="text-slate-400 hover:text-[#256af4] transition-colors">
                  <PlusCircle className="w-5 h-5" />
                </button>
              </div>
              {c.pairs.map((pair, i) => (
                <div key={i} className="relative group">
                  <div
                    className={`p-4 rounded-2xl border-2 flex items-center gap-4 ${
                      i === 0 ? 'border-[#256af4]/50 shadow-[0_0_15px_rgba(37,106,244,0.4)] bg-slate-800/50' : 'border-[#2d3548] bg-slate-800/30'
                    }`}
                  >
                    <div className="size-14 rounded-lg bg-slate-700 flex-shrink-0 flex items-center justify-center">
                      <Type className="w-6 h-6 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={pair.left}
                        onChange={(e) => {
                          const pairs = [...c.pairs];
                          pairs[i] = { ...pairs[i], left: e.target.value };
                          update({ pairs });
                        }}
                        placeholder="Source item"
                        className="w-full bg-transparent border-none text-sm font-bold text-white placeholder:text-slate-500 focus:ring-0 p-0"
                      />
                      <p className="text-xs text-slate-500 italic mt-0.5">ID: SRC_{String(i + 1).padStart(3, '0')}</p>
                    </div>
                  </div>
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 size-6 rounded-full bg-slate-900 border-4 border-[#256af4] shadow-[0_0_10px_rgba(37,106,244,0.6)] z-10 flex items-center justify-center pointer-events-none">
                    <span className="size-1 bg-white rounded-full" />
                  </div>
                </div>
              ))}
              <div className="opacity-60">
                <div className="p-4 rounded-2xl border-2 border-dashed border-slate-600 flex items-center justify-center h-24">
                  <PlusCircle className="w-8 h-8 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Targets column */}
            <div className="flex flex-col gap-8">
              <div className="flex items-center justify-between">
                <h4 className="uppercase tracking-widest text-xs font-bold text-slate-400">Targets</h4>
                <button type="button" className="text-slate-400 hover:text-[#256af4] transition-colors">
                  <PlusCircle className="w-5 h-5" />
                </button>
              </div>
              {c.pairs.map((pair, i) => (
                <div key={i} className="relative">
                  <div
                    className={`p-4 rounded-2xl border-2 text-center ${
                      i === 0 ? 'border-[#256af4]/50 text-[#256af4] shadow-[0_0_15px_rgba(37,106,244,0.4)]' : 'border-[#2d3548] bg-slate-800/30'
                    }`}
                  >
                    <input
                      type="text"
                      value={pair.right}
                      onChange={(e) => {
                        const pairs = [...c.pairs];
                        pairs[i] = { ...pairs[i], right: e.target.value };
                        update({ pairs });
                      }}
                      placeholder="Target item"
                      className="w-full bg-transparent border-none text-sm font-bold text-white placeholder:text-slate-500 focus:ring-0 p-0 text-center"
                    />
                    <p className={`text-[10px] uppercase font-bold tracking-tighter mt-1 ${i === 0 ? 'text-[#256af4]' : 'text-slate-500'}`}>
                      {i === 0 ? 'Matched' : 'Pending'}
                    </p>
                  </div>
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 size-6 rounded-full bg-slate-900 border-4 border-[#256af4] z-10 pointer-events-none" />
                </div>
              ))}
              <div className="opacity-60">
                <div className="p-4 rounded-2xl border-2 border-dashed border-slate-600 flex items-center justify-center h-24">
                  <PlusCircle className="w-8 h-8 text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Connecting lines (visual) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ filter: 'drop-shadow(0 0 4px #256af4)' }}>
            {c.pairs.slice(0, 3).map((_, i) => {
              const y = 120 + i * 140;
              return (
                <path
                  key={i}
                  d={`M 180 ${y} C 320 ${y}, 320 ${y}, 480 ${y}`}
                  fill="none"
                  stroke="#256af4"
                  strokeWidth="3"
                />
              );
            })}
          </svg>

          <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-slate-400">
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" /> {c.pairs.length} Pairs
              </span>
            </div>
          </div>
        </div>
    </div>
  );
}

export function MatchingPairsPlayer({
  content,
  onComplete,
  disabled,
}: {
  content: ChallengeContent;
  onComplete: (response: unknown) => void;
  disabled?: boolean;
}) {
  const c = content as MatchingPairsContent;
  const [matches, setMatches] = useState<Record<string, string>>({});
  const rightOptions = c.pairs.map((p) => p.right);
  const shuffle = (arr: string[]) => [...arr].sort(() => Math.random() - 0.5);
  const [shuffledRight] = useState(() => shuffle(rightOptions));
  const setMatch = (left: string, right: string) => {
    setMatches((m) => ({ ...m, [left]: right }));
  };
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 sm:px-8 py-12 overflow-y-auto">
      <div className="absolute inset-0 z-[-1] bg-[radial-gradient(circle_at_50%_35%,_#112a4a_0%,_#081a34_45%,_#030b1d_100%)]" />
      <div className="w-full max-w-5xl rounded-3xl border border-amber-400/25 bg-[rgba(13,28,50,0.68)] p-6 sm:p-8 shadow-[0_0_20px_rgba(255,178,4,0.18)] space-y-4">
        <p className="text-slate-100 text-sm">Match each item on the left with the correct item on the right.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            {c.pairs.map((p, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-900/70 border border-amber-400/25 text-white font-medium">
                {p.left}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {shuffledRight.map((r, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-800/70 border border-amber-400/25 text-slate-200 text-sm">
                {r}
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-bold text-amber-200 uppercase">Your matches</label>
          {c.pairs.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-32 text-slate-200 text-sm">{p.left}</span>
              <select
                value={matches[p.left] ?? ''}
                onChange={(e) => setMatch(p.left, e.target.value)}
                disabled={disabled}
                className="flex-1 bg-slate-900/80 border border-amber-400/35 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">-- Select --</option>
                {shuffledRight.map((r, j) => (
                  <option key={j} value={r}>{r}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onComplete(matches)}
          disabled={disabled || Object.keys(matches).length < c.pairs.length}
          className="px-6 py-3 rounded-xl bg-[#ffb204] text-[#0A192F] font-black text-sm disabled:opacity-50"
        >
          Check Answers
        </button>
      </div>
    </div>
  );
}
