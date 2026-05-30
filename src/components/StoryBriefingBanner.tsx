import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Zap, X } from 'lucide-react';
import { STORY, STORY_BRIEFING_BANNER, STORY_BRIEFING_DISMISS_KEY } from '../lib/story';

export default function StoryBriefingBanner() {
  const [visible, setVisible] = useState(
    () => typeof window !== 'undefined' && !localStorage.getItem(STORY_BRIEFING_DISMISS_KEY),
  );

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(STORY_BRIEFING_DISMISS_KEY, '1');
    setVisible(false);
  };

  const inner = (
    <>
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
        aria-label="Dismiss briefing"
      >
        <X className="size-4" />
      </button>
      <motion.div className="flex gap-4 pr-8">
        <motion.div className="shrink-0 size-11 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
          <Zap className="size-5 text-amber-400" aria-hidden />
        </motion.div>
        <motion.div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/90 mb-1">{STORY.learnerRole}</p>
          <h3 className="text-base sm:text-lg font-bold text-white leading-snug">{STORY_BRIEFING_BANNER.title}</h3>
          <p className="text-slate-300 text-sm mt-1.5 leading-relaxed">{STORY_BRIEFING_BANNER.body}</p>
          <button
            type="button"
            onClick={dismiss}
            className="mt-3 px-4 py-2 rounded-lg bg-amber-500 text-[#0A192F] text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition-colors"
          >
            {STORY_BRIEFING_BANNER.dismiss}
          </button>
        </motion.div>
      </motion.div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 sm:mx-auto max-w-3xl mb-6 rounded-2xl border border-amber-500/35 bg-gradient-to-r from-[#0d1c32]/95 via-[#132a4a]/90 to-[#0d1c32]/95 p-4 sm:p-5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] relative"
    >
      {inner}
    </motion.div>
  );
}
