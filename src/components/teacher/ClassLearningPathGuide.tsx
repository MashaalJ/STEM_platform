/**
 * Single teacher workflow: Activity Bank → Curriculum → Deploy journeys.
 * Replaces legacy mission/quiz class assignment panels.
 */
import React from 'react';
import { BookOpen, Layers, LayoutGrid, ChevronRight } from 'lucide-react';

export default function ClassLearningPathGuide({
  className,
  hasCurriculumTrack,
  onGoToActivityBank,
  onGoToCurriculum,
}: {
  className?: string;
  hasCurriculumTrack?: boolean;
  onGoToActivityBank?: () => void;
  onGoToCurriculum?: () => void;
}) {
  const steps = [
    {
      n: 1,
      title: 'Create in Activity Bank',
      body: 'Videos, readings, tools, challenges, and quizzes all live in one library.',
      icon: LayoutGrid,
      action: onGoToActivityBank,
      label: 'Open Activity Bank',
    },
    {
      n: 2,
      title: 'Build journeys in Curriculum',
      body: 'Add sectors, journeys, and nodes. Pick bank items or create inline.',
      icon: Layers,
      action: onGoToCurriculum,
      label: 'Open Curriculum',
    },
    {
      n: 3,
      title: 'Deploy to class',
      body: className
        ? `Click Deploy on each journey in Curriculum. Students in ${className} see it on the galaxy map — no separate publish step.`
        : 'Click Deploy on each journey in Curriculum. Students see content on the galaxy map after deploy.',
      icon: BookOpen,
      action: onGoToCurriculum,
      label: 'Deploy journeys',
    },
  ];

  return (
    <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50/80 to-white p-5 space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-teal-800">How students get content</p>
        <h4 className="text-lg font-bold text-slate-900 mt-0.5">One path — no separate mission lists</h4>
        <p className="text-sm text-slate-600 mt-1">
          Everything students play comes from <strong>deployed journeys</strong>. You do not assign missions or quizzes
          separately in Classroom anymore.
        </p>
      </div>

      {!hasCurriculumTrack && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Set a curriculum track on this class first, then build and deploy in Curriculum.
        </p>
      )}

      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.n} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0A192F] text-xs font-black text-teal-300">
              {s.n}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <s.icon className="size-4 text-teal-600" />
                {s.title}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">{s.body}</p>
              {s.action && (
                <button
                  type="button"
                  onClick={s.action}
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-700 hover:text-indigo-900"
                >
                  {s.label}
                  <ChevronRight className="size-3" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
