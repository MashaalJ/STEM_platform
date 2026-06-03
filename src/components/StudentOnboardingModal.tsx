/**
 * Post-signup student onboarding — 5-step flow.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { safeFetch } from '../app/api';
import type { Student } from '../app/types';

const ONBOARDING_DISMISSED_KEY = 'stemverse_student_onboarding_dismissed';

const INTEREST_OPTIONS = [
  'Robots and Machines',
  'Coding and Apps',
  'AI and Smart Technology',
  'Electronics and Circuits',
  'Science and Experiments',
  'Games and Simulations',
] as const;

const EXPERIENCE_OPTIONS = [
  'Never tried it',
  'A little bit',
  'I know the basics',
  'I am experienced',
] as const;

const GOAL_OPTIONS = [
  'Build robots',
  'Create games',
  'Learn about AI',
  'Explore and discover',
] as const;

const INTEREST_TO_KEY: Record<string, string> = {
  'Robots and Machines': 'robotics',
  'Coding and Apps': 'web_dev',
  'AI and Smart Technology': 'ai_ml',
  'Electronics and Circuits': 'electronics',
  'Science and Experiments': 'science_experiments',
  'Games and Simulations': 'game_dev',
};

const EXPERIENCE_TO_API: Record<string, string> = {
  'Never tried it': 'beginner',
  'A little bit': 'some',
  'I know the basics': 'some',
  'I am experienced': 'advanced',
};

const GOAL_TO_API: Record<string, string> = {
  'Build robots': 'robotics',
  'Create games': 'build_games',
  'Learn about AI': 'ai',
  'Explore and discover': 'explore',
};

const sectorMap: Record<string, string> = {
  'Robots and Machines': 'Robotics City',
  'Coding and Apps': 'Dark City',
  'AI and Smart Technology': 'AI Lab',
  'Electronics and Circuits': 'Dark City',
  'Science and Experiments': 'Dark City',
  'Games and Simulations': 'Robotics City',
};

export function assignPath(age: number, interests: string[], experience: string) {
  const level =
    age <= 9 ? 'explorer' : age <= 12 ? 'builder' : age <= 15 ? 'maker' : 'innovator';
  const primaryInterest = interests[0];
  const startSector =
    experience === 'Never tried it'
      ? 'Dark City'
      : sectorMap[primaryInterest] || 'Dark City';
  return { level, startSector };
}

function levelDisplay(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function isStudentOnboardingDismissed(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissStudentOnboardingStorage(): void {
  try {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1');
  } catch {
    /* ignore */
  }
}

export type OnboardingSubmitPayload = {
  age: number;
  interests: string[];
  experience: string;
  goal: string;
};

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="flex justify-center gap-2 mb-6" aria-label={`Step ${step} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`size-2.5 rounded-full transition-colors ${
            n === step ? 'bg-teal-400 scale-110' : n < step ? 'bg-teal-400/50' : 'bg-indigo-200'
          }`}
        />
      ))}
    </div>
  );
}

export function StudentOnboardingModal({
  student,
  open,
  onComplete,
  onDismiss,
}: {
  student: Student | null;
  open: boolean;
  onComplete: (payload: OnboardingSubmitPayload) => void | Promise<void>;
  onDismiss: () => void;
}) {
  const [step, setStep] = useState(1);
  const [age, setAge] = useState<number | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [experience, setExperience] = useState('');
  const [goal, setGoal] = useState('');
  const [firstMission, setFirstMission] = useState('Circuit Rescue');
  const [startSectorId, setStartSectorId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setAge(null);
      setInterests([]);
      setExperience('');
      setGoal('');
      setError(null);
    }
  }, [open]);

  const pathPreview = useMemo(() => {
    if (age == null) return null;
    return assignPath(age, interests, experience);
  }, [age, interests, experience]);

  useEffect(() => {
    if (step !== 5 || !pathPreview) return;
    let cancelled = false;
    (async () => {
      const sectors = await safeFetch('/api/sectors');
      if (!Array.isArray(sectors)) return;
      const sector = sectors.find(
        (s: { name?: string }) =>
          String(s.name || '').toLowerCase() === pathPreview.startSector.toLowerCase(),
      );
      if (sector?.id) {
        setStartSectorId(String(sector.id));
        const preview = await safeFetch(`/api/sectors/${sector.id}/first-journey-node`);
        if (!cancelled && preview?.title) {
          setFirstMission(String(preview.title));
          return;
        }
        const missions = await safeFetch(`/api/sectors/${sector.id}/missions`);
        const list = missions?.missions ?? (Array.isArray(missions) ? missions : []);
        if (!cancelled && Array.isArray(list) && list[0]?.title) {
          setFirstMission(String(list[0].title));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, pathPreview?.startSector]);

  if (student?.role !== 'student' || !open) return null;

  const toggleInterest = (label: string) => {
    setInterests((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label],
    );
  };

  const handleBegin = async () => {
    if (age == null || !experience || !goal || interests.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await onComplete({ age, interests, experience, goal });
      if (startSectorId) {
        try {
          localStorage.setItem('stemverse_highlight_sector_id', startSectorId);
        } catch {
          /* ignore */
        }
      } else if (pathPreview) {
        const sectors = await safeFetch('/api/sectors');
        const sector = Array.isArray(sectors)
          ? sectors.find(
              (s: { name?: string }) =>
                String(s.name || '').toLowerCase() === pathPreview.startSector.toLowerCase(),
            )
          : null;
        if (sector?.id) {
          try {
            localStorage.setItem('stemverse_highlight_sector_id', String(sector.id));
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      setError('Could not save your path. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const cardClass =
    'rounded-2xl px-4 py-4 border text-left transition-all w-full ';

  return (
    <div
      className="fixed left-0 right-0 bottom-0 z-[110] flex items-center justify-center p-4 sm:p-6"
      style={{ top: 'var(--ca-header-height)' }}
    >
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" aria-hidden />
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-3xl border border-indigo-200 bg-gradient-to-br from-[#f7f9ff] via-white to-indigo-50 p-4 sm:p-8 shadow-[0_18px_40px_rgba(25,38,74,0.18)] pointer-events-auto max-h-[min(90vh,calc(100dvh-var(--ca-header-height)-2rem))] overflow-y-auto overscroll-contain"
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="text-2xl font-black text-[#0f2348]">Welcome to STEMverse</h3>
          <button
            type="button"
            onClick={onDismiss}
            disabled={submitting}
            className="text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 shrink-0"
          >
            Skip for now
          </button>
        </div>
        {student.username && (
          <p className="text-sm text-indigo-700 font-semibold mb-2">
            Your explorer handle: <span className="font-mono">{student.username}</span>
          </p>
        )}

        <ProgressDots step={step} />

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
              <h4 className="text-lg font-bold text-[#0f2348] mb-4 text-center">How old are you?</h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                <button
                  type="button"
                  onClick={() => setAge(7)}
                  className={`${cardClass} ${age === 7 ? 'bg-teal-50 border-teal-400 ring-1 ring-teal-300' : 'bg-white border-indigo-200'}`}
                >
                  <span className="text-sm font-bold text-[#0f2348]">Under 8</span>
                </button>
                {Array.from({ length: 11 }, (_, i) => i + 8).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAge(n)}
                    className={`${cardClass} text-center ${age === n ? 'bg-teal-50 border-teal-400 ring-1 ring-teal-300' : 'bg-white border-indigo-200'}`}
                  >
                    <span className="text-sm font-bold text-[#0f2348]">{n}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAge(18)}
                  className={`${cardClass} ${age === 18 ? 'bg-teal-50 border-teal-400 ring-1 ring-teal-300' : 'bg-white border-indigo-200'}`}
                >
                  <span className="text-sm font-bold text-[#0f2348]">18+</span>
                </button>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  disabled={age == null}
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 rounded-xl bg-[#3C3489] text-white font-black text-xs uppercase tracking-widest disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
              <h4 className="text-lg font-bold text-[#0f2348] mb-1 text-center">What excites you most?</h4>
              <p className="text-sm text-[#4a5d86] text-center mb-4">Pick all that apply.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {INTEREST_OPTIONS.map((label) => {
                  const active = interests.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleInterest(label)}
                      className={`${cardClass} ${
                        active
                          ? 'bg-[#fff4d6] border-[#f6c85e] text-[#7a5502]'
                          : 'bg-white border-indigo-200 text-[#20355f]'
                      }`}
                    >
                      <span className="text-sm font-bold">{label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 flex justify-between">
                <button type="button" onClick={() => setStep(1)} className="text-xs font-black uppercase text-slate-500">
                  Back
                </button>
                <button
                  type="button"
                  disabled={interests.length === 0}
                  onClick={() => setStep(3)}
                  className="px-5 py-2.5 rounded-xl bg-[#3C3489] text-white font-black text-xs uppercase tracking-widest disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
              <h4 className="text-lg font-bold text-[#0f2348] mb-4 text-center">
                Have you ever coded or built anything?
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {EXPERIENCE_OPTIONS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setExperience(label)}
                    className={`${cardClass} ${
                      experience === label
                        ? 'bg-teal-50 border-teal-400 ring-1 ring-teal-300'
                        : 'bg-white border-indigo-200'
                    }`}
                  >
                    <span className="text-sm font-bold text-[#0f2348]">{label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex justify-between">
                <button type="button" onClick={() => setStep(2)} className="text-xs font-black uppercase text-slate-500">
                  Back
                </button>
                <button
                  type="button"
                  disabled={!experience}
                  onClick={() => setStep(4)}
                  className="px-5 py-2.5 rounded-xl bg-[#3C3489] text-white font-black text-xs uppercase tracking-widest disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
              <h4 className="text-lg font-bold text-[#0f2348] mb-4 text-center">
                What do you want to do with STEMverse?
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {GOAL_OPTIONS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setGoal(label)}
                    className={`${cardClass} ${
                      goal === label
                        ? 'bg-teal-50 border-teal-400 ring-1 ring-teal-300'
                        : 'bg-white border-indigo-200'
                    }`}
                  >
                    <span className="text-sm font-bold text-[#0f2348]">{label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex justify-between">
                <button type="button" onClick={() => setStep(3)} className="text-xs font-black uppercase text-slate-500">
                  Back
                </button>
                <button
                  type="button"
                  disabled={!goal}
                  onClick={() => setStep(5)}
                  className="px-5 py-2.5 rounded-xl bg-[#3C3489] text-white font-black text-xs uppercase tracking-widest disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </motion.div>
          )}

          {step === 5 && pathPreview && (
            <motion.div key="s5" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
              <div className="rounded-2xl border border-indigo-200 bg-white p-6 text-center space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-teal-700">Your STEM path</p>
                <p className="text-2xl font-black text-[#0f2348]">{levelDisplay(pathPreview.level)}</p>
                <p className="text-sm text-[#4a5d86]">
                  Your starting sector:{' '}
                  <span className="font-bold text-[#0f2348]">{pathPreview.startSector}</span>
                </p>
                <p className="text-sm text-[#4a5d86]">
                  First mission:{' '}
                  <span className="font-bold text-[#0f2348]">{firstMission}</span>
                </p>
              </div>
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center items-center">
                <button type="button" onClick={() => setStep(4)} className="text-xs font-black uppercase text-slate-500">
                  Back
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleBegin()}
                  className="w-full sm:w-auto px-10 py-3.5 rounded-xl bg-teal-500 text-[#0A192F] font-black text-sm uppercase tracking-widest disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Begin'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <p className="mt-4 text-rose-600 text-xs font-semibold text-center">{error}</p>}
      </motion.div>
    </div>
  );
}

export function mapOnboardingToApi(payload: OnboardingSubmitPayload) {
  return {
    age: payload.age,
    interests: payload.interests.map((l) => INTEREST_TO_KEY[l] || l).filter(Boolean),
    experience: EXPERIENCE_TO_API[payload.experience] || payload.experience,
    goal: GOAL_TO_API[payload.goal] || payload.goal,
    age_grade:
      payload.age <= 10 ? 'grade_3_5' : payload.age <= 13 ? 'grade_6_8' : 'grade_9_12',
  };
}
