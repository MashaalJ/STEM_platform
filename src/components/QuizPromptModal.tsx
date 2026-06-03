/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { AppState } from '../app/useAppState';

const slidePanelMotion = {
  initial: { x: '100%' as const },
  animate: { x: 0 },
  exit: { x: '100%' as const },
  transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
};

export default function QuizPromptModal(app: AppState) {
  const {
    quizPromptMission, setQuizPromptMission,
    generatingQuiz,
    quizGenerateError,
    handleGenerateQuizFromMission,
  } = app;

  return (
    <>
      <AnimatePresence>
      {quizPromptMission && (
        <div
          className="fixed left-0 right-0 bottom-0 z-[110] flex justify-end"
          style={{ top: 'var(--ca-header-height)' }}
        >
          <div
            className="cosmic-modal-overlay absolute inset-0"
            onClick={() => !generatingQuiz && setQuizPromptMission(null)}
          />
          <motion.div
            {...slidePanelMotion}
            className="cosmic-modal relative w-full max-w-xl p-8 h-full max-h-screen overflow-y-auto border-l border-slate-200"
          >
            <h3 className="cosmic-page-heading text-2xl mb-2">Mission Complete</h3>
            <p className="text-[var(--ca-on-surface-variant)] mb-1">
              <span className="font-semibold text-[var(--ca-secondary)]">{quizPromptMission.title}</span> completed.
            </p>
            <p className="text-[var(--ca-on-surface-variant)] text-sm mb-6">
              Generate an AI-style quiz with 5 random questions based on this mission topic.
            </p>
            {quizGenerateError && <p className="text-[var(--ca-on-error-container)] text-sm mb-4">{quizGenerateError}</p>}
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => setQuizPromptMission(null)}
                disabled={generatingQuiz}
                className="cosmic-btn-secondary px-4 py-2 text-xs disabled:opacity-50"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={handleGenerateQuizFromMission}
                disabled={generatingQuiz}
                className="cosmic-btn-primary cosmic-btn-inline px-5 py-2 disabled:opacity-60"
              >
                {generatingQuiz ? 'Generating…' : 'Generate Quiz'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </>
  );
}
