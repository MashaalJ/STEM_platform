/**
 * XP float + level-up flash after mission completion.
 */
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { AppState } from '../app/useAppState';

export default function MissionCompleteCelebration({ missionCelebration }: AppState) {
  const [xpPhase, setXpPhase] = useState<'enter' | 'exit'>('enter');

  useEffect(() => {
    if (!missionCelebration) {
      setXpPhase('enter');
      return;
    }
    const exitTimer = window.setTimeout(() => setXpPhase('exit'), 900);
    return () => window.clearTimeout(exitTimer);
  }, [missionCelebration]);

  return (
    <AnimatePresence>
      {missionCelebration && (
        <div
          className="fixed left-0 right-0 bottom-0 z-[115] pointer-events-none flex items-center justify-center"
          style={{ top: 'var(--ca-header-height)' }}
        >
          {missionCelebration.leveledUp && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.6, 0] }}
              transition={{ duration: 0.5, times: [0, 0.35, 1], ease: 'easeInOut' }}
              className="absolute inset-0 bg-white"
            />
          )}

          {missionCelebration.leveledUp && (
            <motion.p
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: [0.4, 1.15, 1], opacity: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.35 }}
              className="absolute text-4xl sm:text-6xl font-black uppercase tracking-[0.2em] text-amber-500 drop-shadow-[0_0_40px_rgba(245,158,11,0.6)]"
            >
              Level Up!
              {missionCelebration.newLevel != null && (
                <span className="block text-center text-2xl sm:text-3xl mt-2 text-white tracking-widest">
                  Level {missionCelebration.newLevel}
                </span>
              )}
            </motion.p>
          )}

          <motion.p
            key={xpPhase}
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={
              xpPhase === 'enter'
                ? { scale: 1.2, opacity: 1, y: 0 }
                : { scale: 1, y: -40, opacity: 0 }
            }
            transition={{ duration: 0.3, ease: 'easeOut', delay: xpPhase === 'enter' ? 0.3 : 0 }}
            className="absolute text-2xl sm:text-3xl font-black text-amber-400 tabular-nums drop-shadow-lg"
          >
            +{missionCelebration.xp} XP
          </motion.p>
        </div>
      )}
    </AnimatePresence>
  );
}
