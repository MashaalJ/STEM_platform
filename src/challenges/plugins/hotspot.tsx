import React, { useState, useRef } from 'react';
import { MousePointer2, PlusCircle, ZoomIn, ZoomOut, Maximize2, Trash2 } from 'lucide-react';
import type { HotspotContent, ChallengeContent } from '../types';

export const defaultContent = (): HotspotContent => ({
  imageUrl: 'https://picsum.photos/seed/hotspot/600/400',
  regions: [
    { x: 25, y: 25, width: 15, height: 15, label: 'Fuel Injector', isCorrect: true },
    { x: 50, y: 50, width: 15, height: 15, label: 'Cooling Jacket', isCorrect: false },
  ],
});

export function evaluate(content: ChallengeContent, response: unknown): { score: number; correct: boolean } {
  const c = content as HotspotContent;
  const r = response as { x?: number; y?: number } | undefined;
  if (r == null || typeof r.x !== 'number' || typeof r.y !== 'number') return { score: 0, correct: false };
  const regions = c.regions || [];
  const tolerance = 0.15;
  for (const reg of regions) {
    if (reg.isCorrect === false) continue;
    const x = reg.x / 100;
    const y = reg.y / 100;
    const w = (reg.width || 10) / 100;
    const h = (reg.height || 10) / 100;
    if (r.x >= x - tolerance && r.x <= x + w + tolerance && r.y >= y - tolerance && r.y <= y + h + tolerance) {
      return { score: 1, correct: true };
    }
  }
  return { score: 0, correct: false };
}

export function HotspotEditor({
  content,
  onChange,
}: {
  content: ChallengeContent;
  onChange: (c: ChallengeContent) => void;
}) {
  const c = content as HotspotContent;
  const update = (patch: Partial<HotspotContent>) => onChange({ ...c, ...patch });
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [zoom, setZoom] = useState(100);
  const regions = c.regions || [];
  const selected = regions[selectedIndex];

  const updateRegion = (i: number, patch: Partial<HotspotContent['regions'][0]>) => {
    const r = [...regions];
    r[i] = { ...r[i], ...patch };
    update({ regions: r });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 flex-1 overflow-hidden">
      {/* Main: Toolbar + Canvas (mockup Targeting Systems) */}
      <div className="flex-1 flex flex-col bg-slate-900/30 rounded-2xl overflow-hidden">
        <div className="bg-slate-800/80 p-2 rounded-xl border border-[#2d3548] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1 border-r border-[#2d3548] pr-2 mr-2">
            <button type="button" className="p-2 rounded-lg bg-[#256af4]/10 text-[#256af4]" title="Select">
              <MousePointer2 className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                const newReg = { x: 50, y: 50, width: 15, height: 15, label: 'New Node', isCorrect: true };
                update({ regions: [...regions, newReg] });
                setSelectedIndex(regions.length);
              }}
              className="p-2 rounded-lg hover:bg-slate-700 text-slate-400"
              title="Add Hotspot"
            >
              <PlusCircle className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-1 border-r border-[#2d3548] pr-2 mr-2">
            <button type="button" onClick={() => setZoom((z) => Math.min(200, z + 10))} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">
              <ZoomIn className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => setZoom((z) => Math.max(50, z - 10))} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">
              <ZoomOut className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => setZoom(100)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex justify-center min-w-0">
            <div className="flex items-center gap-4 bg-slate-900 px-4 py-1.5 rounded-full border border-[#2d3548]">
              <span className="text-xs font-mono uppercase tracking-widest text-slate-500 truncate">
                Image URL
              </span>
              <input
                type="text"
                value={c.imageUrl || ''}
                onChange={(e) => update({ imageUrl: e.target.value })}
                placeholder="https://..."
                className="flex-1 min-w-0 bg-transparent border-none text-xs text-slate-300 focus:ring-0 p-0"
              />
            </div>
          </div>
          <div className="flex items-center gap-1 pl-2 border-l border-[#2d3548]">
            <button
              type="button"
              onClick={() => {
                if (selectedIndex < 0 || !regions.length) return;
                update({ regions: regions.filter((_, i) => i !== selectedIndex) });
                setSelectedIndex(0);
              }}
              className="p-2 rounded-lg text-red-500 hover:bg-red-500/10"
              title="Delete selected"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-[400px] bg-slate-950 rounded-2xl border-2 border-dashed border-[#2d3548] flex items-center justify-center p-6 relative overflow-auto">
          <div
            className="relative max-w-4xl max-h-full"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(37,106,244,0.08) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            <div className="relative rounded-lg overflow-hidden shadow-2xl" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center' }}>
              <img
                src={c.imageUrl || ''}
                alt="Hotspot blueprint"
                className="max-w-full max-h-[60vh] object-contain rounded-lg opacity-90"
              />
              {regions.map((reg, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedIndex(i)}
                  className={`absolute cursor-pointer flex items-center justify-center font-bold text-white text-xs transition-all ${
                    selectedIndex === i ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 shadow-[0_0_15px_rgba(37,106,244,0.5)]' : ''
                  }`}
                  style={{
                    left: `${reg.x}%`,
                    top: `${reg.y}%`,
                    width: `${reg.width}%`,
                    height: `${reg.height}%`,
                    minWidth: 28,
                    minHeight: 28,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '50%',
                    background: selectedIndex === i ? '#256af4' : 'rgba(37,106,244,0.4)',
                    border: '2px solid #256af4',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>
              ))}
            </div>
          </div>
          <div className="absolute bottom-4 left-4 bg-slate-800/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#2d3548] text-xs font-medium">
            Zoom: {zoom}%
          </div>
        </div>
      </div>

      {/* Right: Inspector (mockup) */}
      <aside className="w-80 border-l border-[#2d3548] bg-slate-900/80 flex flex-col shrink-0">
        <div className="flex border-b border-[#2d3548]">
          <button type="button" className="flex-1 py-4 text-xs font-bold uppercase tracking-wider text-[#256af4] border-b-2 border-[#256af4]">
            Inspector
          </button>
          <button type="button" className="flex-1 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
            Layers
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold mb-1">Node Properties</h3>
            <p className="text-sm text-slate-500">Edit selected hotspot</p>
          </div>
          {selected ? (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Node Identification</label>
                <input
                  type="text"
                  value={selected.label ?? ''}
                  onChange={(e) => updateRegion(selectedIndex, { label: e.target.value })}
                  placeholder="Display label"
                  className="w-full bg-slate-800 border-none rounded-lg text-sm px-3 py-2 text-slate-100 focus:ring-2 focus:ring-[#256af4] mb-2"
                />
                <input
                  type="text"
                  value={`HS_${String(selectedIndex + 1).padStart(3, '0')}_A`}
                  disabled
                  className="w-full bg-slate-900 border-none rounded-lg text-sm px-3 py-2 text-slate-500 opacity-50 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Challenge Status</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateRegion(selectedIndex, { isCorrect: true })}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold ${selected.isCorrect !== false ? 'bg-[#256af4] text-white' : 'bg-slate-800 text-slate-500'}`}
                  >
                    Right answer
                  </button>
                  <button
                    type="button"
                    onClick={() => updateRegion(selectedIndex, { isCorrect: false })}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold ${selected.isCorrect === false ? 'bg-[#256af4] text-white' : 'bg-slate-800 text-slate-500'}`}
                  >
                    Wrong spot
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Discovery Hint</label>
                <textarea
                  value={selected.hint ?? ''}
                  onChange={(e) => updateRegion(selectedIndex, { hint: e.target.value })}
                  placeholder="Hint for students if they get stuck..."
                  rows={3}
                  className="w-full bg-slate-800 border-none rounded-lg text-sm px-3 py-2 text-slate-100 focus:ring-2 focus:ring-[#256af4] resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Position (percent 0–100)</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['x', 'y', 'width', 'height'] as const).map((key) => (
                    <div key={key}>
                      <span className="text-[10px] text-slate-500 block mb-0.5">{key}</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={selected[key]}
                        onChange={(e) => updateRegion(selectedIndex, { [key]: Number(e.target.value) })}
                        className="w-full bg-slate-800 border-none rounded px-2 py-1 text-slate-100 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-slate-500 text-sm">Add a hotspot or select one on the canvas.</p>
          )}
        </div>
        <div className="p-6 border-t border-[#2d3548]">
          <button
            type="button"
            onClick={() => {
              update({ regions: [...regions, { x: 50, y: 50, width: 15, height: 15, label: 'New Node', isCorrect: true }] });
              setSelectedIndex(regions.length);
            }}
            className="w-full py-3 bg-[#256af4]/10 text-[#256af4] border border-[#256af4]/20 rounded-xl font-bold text-sm hover:bg-[#256af4]/20 transition-colors flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-5 h-5" />
            Add New Node
          </button>
        </div>
      </aside>
    </div>
  );
}

export function HotspotPlayer({
  content,
  onComplete,
  disabled,
}: {
  content: ChallengeContent;
  onComplete: (response: unknown) => void;
  disabled?: boolean;
}) {
  const c = content as HotspotContent;
  const containerRef = useRef<HTMLDivElement>(null);
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onComplete({ x, y });
  };
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 sm:px-8 py-12 overflow-y-auto">
      <div className="absolute inset-0 z-[-1] bg-[radial-gradient(circle_at_50%_35%,_#112a4a_0%,_#081a34_45%,_#030b1d_100%)]" />
      <div className="w-full max-w-5xl rounded-3xl border border-amber-400/25 bg-[rgba(13,28,50,0.68)] p-6 sm:p-8 shadow-[0_0_20px_rgba(255,178,4,0.18)] space-y-4">
        <p className="text-slate-100 text-sm">Click the correct area on the image.</p>
        <div
          ref={containerRef}
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={(e) => e.key === 'Enter' && containerRef.current?.click()}
          className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-amber-400/35 cursor-crosshair hover:border-[#ffb204] bg-slate-900/70"
        >
          <img src={c.imageUrl || ''} alt="Hotspot" className="w-full h-full object-contain pointer-events-none" draggable={false} />
        </div>
      </div>
    </div>
  );
}
