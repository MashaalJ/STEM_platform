import React from 'react';
import type { ChallengeContent, ChallengeType, ChallengeCategory } from '../types';

const stubContent = (): ChallengeContent => ({});

const stubEvaluate = () => ({ score: 0, correct: false });

function StubEditor({ content, onChange }: { content: ChallengeContent; onChange: (c: ChallengeContent) => void }) {
  return (
    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm">
      This challenge type is not yet implemented. You can still save it and it will appear in the list.
    </div>
  );
}

function StubPlayer({ disabled }: { content: ChallengeContent; onComplete: (r: unknown) => void; disabled?: boolean }) {
  return (
    <div className="p-6 rounded-xl bg-slate-800/60 border border-slate-600/50 text-slate-400 text-center">
      This challenge type is coming soon.
    </div>
  );
}

export function createStubPlugin(
  id: ChallengeType,
  label: string,
  description: string,
  category?: ChallengeCategory
): { meta: { id: ChallengeType; label: string; description: string; icon?: string; category?: ChallengeCategory }; defaultContent: () => ChallengeContent; Editor: typeof StubEditor; Player: typeof StubPlayer; evaluate: () => { score: number; correct: boolean } } {
  return {
    meta: { id, label, description, icon: 'Puzzle', category },
    defaultContent: stubContent,
    Editor: StubEditor,
    Player: StubPlayer as React.ComponentType<{ content: ChallengeContent; onComplete: (r: unknown) => void; disabled?: boolean }>,
    evaluate: stubEvaluate,
  };
}
