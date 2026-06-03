/**
 * Live preview panel for the Challenge Studio (H5P-style).
 * Renders the challenge Player so authors see the interactive display as students will.
 */

import React from 'react';
import type { ChallengeContent, ChallengeType } from '../types';
import { getChallengeType } from '../registry';

export function PreviewPanel({
  challengeType,
  content,
  title,
  className = '',
  onPreviewComplete,
  lockedFeedback,
}: {
  challengeType: ChallengeType;
  content: ChallengeContent;
  title?: string;
  className?: string;
  onPreviewComplete?: (response: unknown) => void;
  lockedFeedback?: string | null;
}) {
  const plugin = getChallengeType(challengeType);
  const Player = plugin?.Player;

  if (!Player) {
    return (
      <div className={`rounded-2xl border border-slate-600/40 bg-slate-800/60 p-6 ${className}`}>
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Preview</h4>
        <div className="rounded-xl bg-slate-800/50 border border-slate-600/40 p-6 text-slate-500 text-sm text-center">
          No preview for this type.
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-slate-600/40 bg-slate-800/60 overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-slate-600/40 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Live preview</h4>
        {title && <span className="text-slate-500 text-xs truncate ml-2">— {title}</span>}
      </div>
      <div className="p-4 min-h-[200px]">
        <Player
          content={content}
          onComplete={(response) => onPreviewComplete?.(response)}
          disabled={false}
        />
        {lockedFeedback && (
          <p className="mt-4 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {lockedFeedback}
          </p>
        )}
      </div>
    </div>
  );
}
