/**
 * H5P Studio–style content type card for the type picker grid.
 * Interactive tile: icon, label, description; click to select type.
 */

import React from 'react';
import {
  ListChecks,
  Layers,
  Type,
  GripVertical,
  GitBranch,
  MessageSquare,
  MousePointer2,
  Crosshair,
  ArrowUpDown,
  Puzzle,
  type LucideIcon,
} from 'lucide-react';
import type { CatalogEntry } from '../catalog';

const ICON_MAP: Record<string, LucideIcon> = {
  ListChecks,
  Layers,
  Type,
  GripVertical,
  GitBranch,
  MessageSquare,
  MousePointer2,
  Crosshair,
  ArrowUpDown,
  Puzzle,
};

const CATEGORY_LABELS: Record<string, string> = {
  quiz: 'Quiz',
  interactive: 'Interactive',
  media: 'Media',
  other: 'Other',
};

export function TypeCard({
  entry,
  onSelect,
}: {
  entry: CatalogEntry;
  onSelect: () => void;
}) {
  const Icon = ICON_MAP[entry.icon] ?? Puzzle;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group w-full text-left rounded-2xl border border-slate-600/50 bg-slate-800/50 hover:border-cyan-500/50 hover:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all p-5 shadow-lg hover:shadow-cyan-500/10"
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:bg-cyan-500/30 group-hover:scale-105 transition-all">
          <Icon className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            {CATEGORY_LABELS[entry.category] ?? entry.category}
          </span>
          <h4 className="font-black text-slate-100 text-base mt-0.5">{entry.label}</h4>
          <p className="text-sm text-slate-400 mt-1 line-clamp-2">{entry.description}</p>
        </div>
      </div>
    </button>
  );
}
