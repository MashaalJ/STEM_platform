import React, { useState } from 'react';
import { Layers, GitBranch, GripVertical, Link } from 'lucide-react';
import type { DragDropContent, ChallengeContent } from '../types';

export const defaultContent = (): DragDropContent => ({
  items: [
    { id: 'a', label: 'Motor' },
    { id: 'b', label: 'Sensor' },
  ],
  zones: [
    { id: 'z1', label: 'Creates movement', correctIds: ['a'] },
    { id: 'z2', label: 'Detects input', correctIds: ['b'] },
  ],
});

export function evaluate(content: ChallengeContent, response: unknown): { score: number; correct: boolean } {
  const c = content as DragDropContent;
  const user = (response as Record<string, string[]>) || {};
  const zones = c.zones || [];
  let correct = 0;
  for (const zone of zones) {
    const placed = user[zone.id] || [];
    const want = new Set(zone.correctIds || []);
    if (want.size !== placed.length) continue;
    if (placed.every((id) => want.has(id))) correct++;
  }
  const score = zones.length ? correct / zones.length : 0;
  return { score, correct: score >= 1 };
}

const ITEM_ICONS: Record<string, string> = {
  matter: '💧',
  lightbulb: '⚡',
  atm: '◎',
  default: '◆',
};

function itemIcon(id: string, label: string): string {
  const lower = (id + label).toLowerCase();
  if (lower.includes('motor') || lower.includes('water') || lower.includes('h2o')) return 'matter';
  if (lower.includes('energy') || lower.includes('sensor')) return 'lightbulb';
  if (lower.includes('nucleus')) return 'atm';
  return 'default';
}

export function DragDropEditor({
  content,
  onChange,
}: {
  content: ChallengeContent;
  onChange: (c: ChallengeContent) => void;
}) {
  const c = content as DragDropContent;
  const update = (patch: Partial<DragDropContent>) => onChange({ ...c, ...patch });
  const items = c.items || [];
  const zones = c.zones || [];
  const [openLogicPanel, setOpenLogicPanel] = useState(true);

  return (
    <div className="flex flex-col lg:flex-row gap-0 flex-1 min-w-0 overflow-hidden">
      {/* Main content — no nested left sidebar; lives inside builder center panel */}
      <section className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#256af4]" />
            Component Slotting
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Mode</span>
            <button type="button" className="py-1 px-2 text-[11px] font-bold rounded bg-[#256af4] text-white">BUILD</button>
            <button type="button" className="py-1 px-2 text-[11px] font-bold rounded bg-slate-700 text-slate-400">TEST</button>
            <button type="button" onClick={() => setOpenLogicPanel((v) => !v)} className="py-1 px-2 text-[11px] font-bold rounded bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center gap-1">
              <GitBranch className="w-3 h-3" />
              Logic
            </button>
          </div>
        </div>
        <div className="flex-1 bg-slate-900/30 p-4 md:p-6 overflow-auto">
          <div className="max-w-4xl mx-auto flex flex-col gap-8">
            {/* Draggable Assets panel */}
            <div className="bg-slate-800/80 backdrop-blur-md rounded-xl p-6 border border-[#2d3548] shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <GripVertical className="w-4 h-4" />
                  Draggable Assets
                </h4>
                <button
                  type="button"
                  onClick={() => update({ items: [...items, { id: `i${items.length}`, label: 'New Item' }] })}
                  className="text-[10px] font-bold bg-[#256af4]/20 text-[#256af4] px-2 py-0.5 rounded uppercase hover:bg-[#256af4]/30"
                >
                  + Add Asset
                </button>
              </div>
              <div className="flex flex-wrap gap-4">
                {items.map((it, i) => (
                  <div key={it.id} className="flex flex-col items-center gap-2 cursor-grab group/item">
                    <div className="size-16 rounded-xl bg-slate-900 border-2 border-[#256af4] shadow-[0_0_15px_-5px_rgba(37,106,244,0.5)] ring-2 ring-[#256af4]/20 flex items-center justify-center transition-all group-hover/item:scale-110">
                      <span className="text-2xl">{ITEM_ICONS[itemIcon(it.id, it.label)] ?? ITEM_ICONS.default}</span>
                    </div>
                    <input
                      type="text"
                      value={it.label}
                      onChange={(e) => {
                        const next = [...items];
                        next[i] = { ...next[i], label: e.target.value };
                        update({ items: next });
                      }}
                      className="text-[10px] font-medium bg-transparent border-none text-center text-slate-400 focus:ring-0 w-20 truncate"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Drop Zone with ghosted slots */}
            <div className="flex-1 min-h-[320px] bg-slate-800/30 rounded-2xl border-2 border-dashed border-[#2d3548] relative flex items-center justify-center">
              <div className="absolute inset-0 p-8 grid grid-cols-2 gap-8">
                {zones.map((z, i) => (
                  <div key={z.id} className="relative flex flex-col items-center justify-center gap-4">
                    <div className="w-full h-40 rounded-2xl border-4 border-slate-600 bg-slate-900/20 flex items-center justify-center group/slot transition-all hover:bg-[#256af4]/5 hover:border-[#256af4]/40">
                      <div className="opacity-20 flex flex-col items-center">
                        <span className="text-4xl">{ITEM_ICONS.default}</span>
                        <p className="text-sm font-bold mt-2">{z.label || 'SLOT'}</p>
                      </div>
                      <div className="absolute -top-2 -right-2 bg-[#256af4] size-6 rounded-full flex items-center justify-center text-white ring-4 ring-slate-900">
                        <Link className="w-3 h-3" />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={z.label}
                      onChange={(e) => {
                        const next = [...zones];
                        next[i] = { ...next[i], label: e.target.value };
                        update({ zones: next });
                      }}
                      placeholder="Zone label"
                      className="bg-slate-700/50 px-3 py-1 rounded-full text-[10px] font-bold text-slate-500 w-full text-center"
                    />
                  </div>
                ))}
              </div>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full flex items-center gap-3 text-xs font-bold shadow-2xl">
                <GripVertical className="w-4 h-4" />
                Drag assets to the canvas to define drop slots.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Right: Logic Link (mockup) */}
      <aside className={`w-80 border-l border-[#2d3548] bg-slate-900 flex flex-col shrink-0 ${!openLogicPanel ? 'hidden' : ''}`}>
        <div className="p-6 border-b border-[#2d3548] flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2 text-[#256af4]">
            <GitBranch className="w-5 h-5" />
            Logic Link
          </h3>
          <button type="button" onClick={() => setOpenLogicPanel(false)} className="text-slate-400 hover:text-white">
            ×
          </button>
        </div>
        <div className="p-6 flex flex-col gap-6 overflow-y-auto">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-3 tracking-widest">Validation Rules</p>
            <div className="space-y-3">
              {zones.map((z, i) => (
                <div key={z.id} className="p-3 rounded-lg bg-slate-800/50 border border-[#2d3548]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#256af4]">Rule #{i + 1}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-8 rounded bg-[#256af4]/20 text-[#256af4] flex items-center justify-center text-lg">
                      {ITEM_ICONS.default}
                    </div>
                    <span className="text-slate-400">→</span>
                    <input
                      type="text"
                      value={z.label}
                      readOnly
                      className="flex-1 bg-slate-700 px-2 py-1.5 rounded text-[10px] font-mono text-slate-300"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-slate-400">Correct IDs:</label>
                    <input
                      type="text"
                      value={(z.correctIds || []).join(', ')}
                      onChange={(e) => {
                        const next = [...zones];
                        next[i] = { ...next[i], correctIds: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) };
                        update({ zones: next });
                      }}
                      placeholder="a, b"
                      className="flex-1 bg-transparent border-none p-0 text-[10px] font-bold text-slate-300 focus:ring-0"
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => update({ zones: [...zones, { id: `z${zones.length}`, label: 'New zone', correctIds: [] }] })}
                className="w-full py-2 border-2 border-dashed border-slate-600 rounded-lg text-xs font-bold text-slate-400 hover:border-[#256af4] hover:text-[#256af4] transition-colors"
              >
                + New Connection
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

export function DragDropPlayer({
  content,
  onComplete,
  disabled,
}: {
  content: ChallengeContent;
  onComplete: (response: unknown) => void;
  disabled?: boolean;
}) {
  const c = content as DragDropContent;
  const items = c.items || [];
  const zones = c.zones || [];
  const [placed, setPlaced] = useState<Record<string, string[]>>(() => {
    const o: Record<string, string[]> = {};
    zones.forEach((z) => (o[z.id] = []));
    return o;
  });
  const [pool, setPool] = useState<string[]>(() => items.map((i) => i.id));

  const drop = (zoneId: string, itemId: string) => {
    if (disabled) return;
    setPlaced((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((z) => { next[z] = next[z].filter((id) => id !== itemId); });
      next[zoneId] = [...(next[zoneId] || []), itemId];
      return next;
    });
    setPool((p) => p.filter((id) => id !== itemId));
  };
  const removeFromZone = (zoneId: string, itemId: string) => {
    setPlaced((prev) => ({ ...prev, [zoneId]: (prev[zoneId] || []).filter((id) => id !== itemId) }));
    setPool((p) => [...p, itemId]);
  };

  const getLabel = (id: string) => items.find((i) => i.id === id)?.label ?? id;

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 sm:px-8 py-12 overflow-y-auto">
      <div className="absolute inset-0 z-[-1] bg-[radial-gradient(circle_at_50%_35%,_#112a4a_0%,_#081a34_45%,_#030b1d_100%)]" />
      <div className="w-full max-w-5xl rounded-3xl border border-amber-400/25 bg-[rgba(13,28,50,0.68)] p-6 sm:p-8 shadow-[0_0_20px_rgba(255,178,4,0.18)] space-y-4">
        <p className="text-slate-100 text-sm">Drag items into the correct zones.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {pool.map((id) => (
            <span
              key={id}
              draggable={!disabled}
              onDragStart={(e) => e.dataTransfer.setData('text/plain', id)}
              className="px-3 py-2 rounded-lg bg-[#ffb204]/20 border border-[#ffb204]/40 text-white text-sm cursor-move"
            >
              {getLabel(id)}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {zones.map((z) => (
            <div
              key={z.id}
              className="min-h-[96px] p-4 rounded-xl border-2 border-dashed border-amber-400/35 bg-slate-900/60"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                if (id) drop(z.id, id);
              }}
            >
              <p className="text-[10px] font-bold text-amber-200 uppercase mb-2">{z.label}</p>
              <div className="flex flex-wrap gap-2">
                {(placed[z.id] || []).map((id) => (
                  <span key={id} className="px-2 py-1 rounded bg-slate-700/80 text-white text-sm">
                    {getLabel(id)}{' '}
                    {!disabled && (
                      <button type="button" onClick={() => removeFromZone(z.id, id)} className="text-rose-400 ml-1">x</button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => onComplete(placed)} disabled={disabled} className="px-6 py-3 rounded-xl bg-[#ffb204] text-[#0A192F] font-black text-sm uppercase disabled:opacity-50">
          Check Answer
        </button>
      </div>
    </div>
  );
}
