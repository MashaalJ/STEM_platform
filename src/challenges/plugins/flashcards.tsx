import React, { useState } from 'react';
import { Layers, Plus, Upload, Search, RotateCw, Trash2, GripVertical, Image, Mic } from 'lucide-react';
import type { FlashcardsContent, ChallengeContent } from '../types';

export const defaultContent = (): FlashcardsContent => ({
  cards: [
    { front: 'Quantum Superposition', back: 'The ability of a quantum system to be in multiple states at the same time until it is measured.' },
    { front: "Schrödinger's Cat", back: "A thought experiment illustrating superposition where a cat is simultaneously alive and dead." },
  ],
});

export function evaluate(content: ChallengeContent, response: unknown): { score: number; correct: boolean } {
  const c = content as FlashcardsContent;
  const answered = (response as { index: number; correct: boolean }[]) ?? [];
  const correct = answered.filter((r) => r.correct).length;
  const total = c.cards?.length ?? 0;
  const score = total ? correct / total : 0;
  return { score, correct: score >= 1 };
}

export function FlashcardsEditor({
  content,
  onChange,
}: {
  content: ChallengeContent;
  onChange: (c: ChallengeContent) => void;
}) {
  const c = content as FlashcardsContent;
  const update = (patch: Partial<FlashcardsContent>) => onChange({ ...c, ...patch });
  const cards = c.cards ?? [];
  const [activeTab, setActiveTab] = useState<'cards' | 'settings' | 'preview' | 'publish'>('cards');

  const addCard = () => update({ cards: [...cards, { front: '', back: '' }] });
  const removeCard = (i: number) => update({ cards: cards.filter((_, j) => j !== i) });
  const updateCard = (i: number, side: 'front' | 'back', value: string) => {
    const next = [...cards];
    next[i] = { ...next[i], [side]: value };
    update({ cards: next });
  };

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Card list content only — no nested sidebar; lives inside builder center panel */}
      <div className="flex flex-col p-4 md:p-6 overflow-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-[#256af4] mb-1">
            <span className="text-xs font-bold uppercase tracking-widest">Memory Boost</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white mb-1">Flashcards</h2>
          <p className="text-slate-500 text-sm">
            Concept-definition pairs. Add cards below.
          </p>
        </div>

        <div className="flex border-b border-[#2d3548] mb-8 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('cards')}
            className={`px-6 py-3 border-b-2 font-bold text-sm whitespace-nowrap ${activeTab === 'cards' ? 'border-[#256af4] text-[#256af4]' : 'border-transparent text-slate-500'}`}
          >
            Card List ({cards.length})
          </button>
          <button type="button" className="px-6 py-3 border-b-2 border-transparent text-slate-500 hover:text-slate-300 font-bold text-sm whitespace-nowrap">
            Deck Settings
          </button>
          <button type="button" className="px-6 py-3 border-b-2 border-transparent text-slate-500 hover:text-slate-300 font-bold text-sm whitespace-nowrap">
            Preview Mode
          </button>
          <button type="button" className="px-6 py-3 border-b-2 border-transparent text-slate-500 hover:text-slate-300 font-bold text-sm whitespace-nowrap">
            Publish
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addCard}
              className="flex items-center gap-2 px-4 py-2 bg-[#256af4] text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Add New Card
            </button>
            <button type="button" className="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded-lg font-bold text-sm hover:bg-slate-600 transition-colors text-slate-200">
              <Upload className="w-4 h-4" />
              Batch Import
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search concepts..."
              className="pl-10 pr-4 py-2 bg-slate-800 border-none rounded-lg text-sm w-64 focus:ring-2 focus:ring-[#256af4] text-slate-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {cards.map((card, i) => (
            <div key={i} className="group relative bg-slate-900 border border-[#2d3548] rounded-xl overflow-hidden shadow-lg">
              <div className="flex flex-col md:flex-row min-h-[140px]">
                <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-[#2d3548]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#256af4] bg-[#256af4]/10 px-2 py-0.5 rounded">
                      Front Side
                    </span>
                    <span className="text-xs text-slate-400">#{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <label className="block space-y-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Concept Name</span>
                    <input
                      type="text"
                      value={card.front}
                      onChange={(e) => updateCard(i, 'front', e.target.value)}
                      className="w-full bg-transparent border-none text-xl font-bold p-0 text-white focus:ring-0 placeholder:text-slate-500"
                      placeholder="Concept"
                    />
                  </label>
                </div>
                <div className="flex-1 p-6 bg-slate-800/20">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                      Back Side
                    </span>
                    <div className="flex items-center gap-2">
                      <button type="button" className="text-slate-400 hover:text-[#256af4] transition-colors p-1">
                        <Image className="w-4 h-4" />
                      </button>
                      <button type="button" className="text-slate-400 hover:text-[#256af4] transition-colors p-1">
                        <Mic className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <label className="block space-y-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Definition / Description</span>
                    <textarea
                      value={card.back}
                      onChange={(e) => updateCard(i, 'back', e.target.value)}
                      rows={2}
                      className="w-full bg-transparent border-none text-base p-0 text-slate-300 focus:ring-0 resize-none placeholder:text-slate-500"
                      placeholder="Definition"
                    />
                  </label>
                </div>
                <div className="md:w-16 flex md:flex-col items-center justify-center gap-4 p-4 border-t md:border-t-0 md:border-l border-[#2d3548] bg-slate-900/50">
                  <button type="button" className="p-2 rounded-lg text-slate-400 hover:text-[#256af4] hover:bg-[#256af4]/10 transition-all" title="Preview flip">
                    <RotateCw className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={() => removeCard(i)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all" title="Delete">
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button type="button" className="p-2 rounded-lg text-slate-400 hover:text-slate-200 transition-all cursor-grab" title="Reorder">
                    <GripVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addCard}
            className="border-2 border-dashed border-[#2d3548] rounded-xl p-8 flex flex-col items-center justify-center text-slate-400 hover:border-[#256af4]/50 hover:text-[#256af4] transition-all cursor-pointer group"
          >
            <div className="size-12 rounded-full bg-slate-800 flex items-center justify-center mb-3 group-hover:bg-[#256af4]/10 transition-colors">
              <Plus className="w-6 h-6" />
            </div>
            <p className="font-bold text-sm">Add another card to the deck</p>
          </button>
        </div>

        <div className="mt-8 flex justify-end gap-4 pt-4 border-t border-[#2d3548]">
          <button type="button" className="px-6 py-2 rounded-lg border border-[#2d3548] font-bold hover:bg-slate-800 transition-colors text-slate-200 text-sm">
            Save Draft
          </button>
          <button type="button" className="px-8 py-2 rounded-lg bg-[#256af4] text-white font-bold hover:opacity-90 shadow-lg shadow-[#256af4]/30 transition-all text-sm">
            Complete & Review Deck
          </button>
        </div>
      </div>
    </div>
  );
}

export function FlashcardsPlayer({
  content,
  onComplete,
  disabled,
}: {
  content: ChallengeContent;
  onComplete: (response: unknown) => void;
  disabled?: boolean;
}) {
  const c = content as FlashcardsContent;
  const cards = c.cards ?? [];
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [results, setResults] = useState<{ correct: boolean }[]>([]);

  const card = cards[index];
  if (!card) {
    const score = results.filter((r) => r.correct).length / (cards.length || 1);
    return (
      <div className="space-y-4 text-center p-6">
        <p className="text-slate-300">Deck complete. Score: {Math.round(score * 100)}%</p>
        <button
          type="button"
          onClick={() => onComplete(results)}
          className="px-4 py-2 rounded-xl bg-[#256af4] text-white font-bold"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="p-6 rounded-xl border-2 border-[#2d3548] bg-slate-900 min-h-[180px] cursor-pointer hover:border-[#256af4]/50 transition-colors"
        onClick={() => !disabled && setShowBack((b) => !b)}
      >
        <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">{showBack ? 'Back' : 'Front'}</p>
        <p className="text-lg font-medium text-slate-100">{showBack ? card.back : card.front}</p>
      </div>
      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={() => { setResults((r) => [...r, { correct: true }]); setIndex((i) => i + 1); setShowBack(false); }}
          disabled={disabled}
          className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-sm"
        >
          Got it
        </button>
        <button
          type="button"
          onClick={() => { setResults((r) => [...r, { correct: false }]); setIndex((i) => i + 1); setShowBack(false); }}
          disabled={disabled}
          className="px-4 py-2 rounded-lg bg-rose-500/20 text-rose-400 font-bold text-sm"
        >
          Review again
        </button>
      </div>
      <p className="text-xs text-slate-500 text-center">
        Card {index + 1} of {cards.length}
      </p>
    </div>
  );
}
