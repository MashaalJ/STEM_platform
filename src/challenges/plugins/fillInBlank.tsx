import React, { useState } from 'react';
import { Terminal, ListOrdered, Sparkles, Trash2, Database } from 'lucide-react';
import type { FillInBlankContent, ChallengeContent } from '../types';

export const defaultContent = (): FillInBlankContent => ({
  text: 'The ___ sensor measures ___.',
  blanks: [{ accept: ['ultrasonic', 'distance'] }, { accept: ['distance', 'proximity'] }],
});

export function evaluate(content: ChallengeContent, response: unknown): { score: number; correct: boolean } {
  const c = content as FillInBlankContent;
  const answers = Array.isArray(response) ? response : [];
  if (answers.length !== c.blanks.length) return { score: 0, correct: false };
  let correct = 0;
  for (let i = 0; i < c.blanks.length; i++) {
    const user = String(answers[i] ?? '').trim();
    const accept = c.blanks[i].accept.map((a) => (c.blanks[i].caseSensitive ? a : a.toLowerCase()));
    const normalized = c.blanks[i].caseSensitive ? user : user.toLowerCase();
    if (accept.includes(normalized)) correct++;
  }
  const score = c.blanks.length ? correct / c.blanks.length : 0;
  return { score, correct: score >= 1 };
}

const BLANK_PATTERN = /___+/g;

export function FillInBlankEditor({
  content,
  onChange,
}: {
  content: ChallengeContent;
  onChange: (c: ChallengeContent) => void;
}) {
  const c = content as FillInBlankContent;
  const update = (patch: Partial<FillInBlankContent>) => onChange({ ...c, ...patch });
  const [caseSensitive, setCaseSensitive] = useState(c.blanks.some((b) => b.caseSensitive));
  const [showHints, setShowHints] = useState(false);

  const applyFragmentize = () => {
    const numBlanks = (c.text.match(BLANK_PATTERN) || []).length;
    let blanks = c.blanks;
    if (blanks.length < numBlanks) {
      blanks = [...blanks];
      while (blanks.length < numBlanks) blanks.push({ accept: [''], caseSensitive });
    } else if (blanks.length > numBlanks) {
      blanks = blanks.slice(0, numBlanks);
    }
    update({ blanks });
  };

  const removeFragment = (index: number) => {
    let n = 0;
    const newText = c.text.replace(BLANK_PATTERN, (match) => (n++ === index ? (c.blanks[index]?.accept?.[0] ?? '') : match));
    const newBlanks = c.blanks.filter((_, i) => i !== index);
    update({ text: newText, blanks: newBlanks });
  };

  const studentPreviewParts = c.text.split(BLANK_PATTERN);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main: Corrupted Sequence + Defined Fragments (mockup) */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-slate-900/50 border border-[#2d3548] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white flex items-center gap-2 text-[#256af4]">
              <Terminal className="w-5 h-5" />
              Input Corrupted Sequence
            </h3>
            <div className="flex gap-2">
              <button type="button" className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-all" title="Bold">
                <span className="text-xs font-bold">B</span>
              </button>
              <button
                type="button"
                onClick={applyFragmentize}
                className="p-2 text-[#256af4] bg-[#256af4]/10 rounded-lg border border-[#256af4]/20 transition-all"
                title="Fragmentize (use ___ for blanks)"
              >
                <Sparkles className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="relative">
            <textarea
              value={c.text}
              onChange={(e) => update({ text: e.target.value })}
              placeholder="Type your sentence here. Use ___ for each blank. Example: The mitochondrion is the powerhouse of the cell."
              className="w-full min-h-[200px] bg-slate-950 border border-[#2d3548] rounded-lg p-6 text-lg leading-relaxed text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-[#256af4]/20 focus:border-[#256af4] outline-none transition-all"
              rows={6}
            />
            <div className="absolute bottom-4 right-4 text-xs text-slate-400 font-mono uppercase tracking-widest">
              Status: {c.blanks.length ? 'Fragmentized' : 'Ready for Fragmenting'}
            </div>
          </div>
          <p className="mt-4 flex flex-wrap gap-2 items-center text-sm text-slate-500 italic">
            <span>Use ___ for each blank, then click the magic wand to sync fragments.</span>
          </p>
        </div>

        <div className="bg-slate-900/50 border border-[#2d3548] rounded-xl p-6">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-[#256af4]">
            <ListOrdered className="w-5 h-5" />
            Defined Fragments
          </h3>
          <div className="space-y-3">
            {c.blanks.map((bl, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-950 border border-[#2d3548] rounded-lg group">
                <div className="flex items-center gap-4">
                  <span className="size-6 rounded bg-[#256af4]/10 text-[#256af4] flex items-center justify-center text-xs font-bold">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <input
                    type="text"
                    value={bl.accept[0] ?? ''}
                    onChange={(e) => {
                      const blanks = [...c.blanks];
                      blanks[i] = { ...bl, accept: e.target.value ? [e.target.value] : [''] };
                      update({ blanks });
                    }}
                    className="font-mono text-[#256af4] font-bold bg-transparent border-none focus:ring-0 p-0 w-48"
                    placeholder="Fragment word"
                  />
                </div>
                <button type="button" onClick={() => removeFragment(i)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar: Settings + Student View (mockup) */}
      <div className="space-y-6">
        <div className="bg-slate-900/50 border border-[#2d3548] rounded-xl p-6">
          <h3 className="font-bold text-white mb-4">Challenge Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Difficulty Level</label>
              <select className="w-full bg-slate-950 border border-[#2d3548] rounded-lg px-3 py-2 text-sm text-slate-100 focus:ring-2 focus:ring-[#256af4]/20 outline-none">
                <option>Novice Technician</option>
                <option>System Engineer</option>
                <option>Quantum Architect</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Time Limit (Seconds)</label>
              <input type="number" defaultValue={60} className="w-full bg-slate-950 border border-[#2d3548] rounded-lg px-3 py-2 text-sm text-slate-100 focus:ring-2 focus:ring-[#256af4]/20 outline-none" />
            </div>
            <div className="pt-4 border-t border-[#2d3548]">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={caseSensitive}
                  onChange={(e) => {
                    setCaseSensitive(e.target.checked);
                    update({ blanks: c.blanks.map((b) => ({ ...b, caseSensitive: e.target.checked })) });
                  }}
                  className="rounded border-slate-600 text-[#256af4] focus:ring-[#256af4] bg-transparent"
                />
                <span className="text-sm font-medium text-slate-300">Case Sensitive</span>
              </label>
            </div>
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={showHints} onChange={(e) => setShowHints(e.target.checked)} className="rounded border-slate-600 text-[#256af4] focus:ring-[#256af4] bg-transparent" />
                <span className="text-sm font-medium text-slate-300">Show Hints</span>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-[#256af4]/5 border border-[#256af4]/20 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 size-32 bg-[#256af4]/10 rounded-full blur-3xl" />
          <h3 className="text-[#256af4] font-bold mb-4 flex items-center gap-2">
            <Database className="w-4 h-4" />
            Student View
          </h3>
          <div className="text-sm leading-relaxed text-slate-300 mb-4">
            {studentPreviewParts.map((part, i) => (
              <React.Fragment key={i}>
                {part}
                {i < studentPreviewParts.length - 1 && (
                  <span className="inline-block min-w-[4rem] h-4 bg-[#256af4]/20 rounded align-middle border-b-2 border-[#256af4] mx-0.5" title="Blank" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FillInBlankPlayer({
  content,
  onComplete,
  disabled,
}: {
  content: ChallengeContent;
  onComplete: (response: unknown) => void;
  disabled?: boolean;
}) {
  const c = content as FillInBlankContent;
  const parts = c.text.split(BLANK_PATTERN);
  const numBlanks = (c.text.match(BLANK_PATTERN) || []).length;
  const [values, setValues] = useState<string[]>(() => Array(numBlanks).fill(''));
  const setBlank = (i: number, v: string) => {
    setValues((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  };
  let blankIdx = 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 text-slate-200">
        {parts.map((p, i) => {
          if (i < parts.length - 1) {
            const idx = blankIdx++;
            return (
              <React.Fragment key={i}>
                <span>{p}</span>
                <input
                  type="text"
                  value={values[idx] ?? ''}
                  onChange={(e) => setBlank(idx, e.target.value)}
                  className="w-28 px-2 py-1 bg-slate-700/60 border border-[#2d3548] rounded text-slate-100 text-sm inline focus:ring-2 focus:ring-[#256af4]/50"
                  placeholder="..."
                  disabled={disabled}
                />
              </React.Fragment>
            );
          }
          return <span key={i}>{p}</span>;
        })}
      </div>
      <button
        type="button"
        onClick={() => onComplete(values)}
        disabled={disabled}
        className="px-4 py-2 rounded-xl bg-[#256af4] text-white font-bold text-sm uppercase disabled:opacity-50"
      >
        Check
      </button>
    </div>
  );
}
