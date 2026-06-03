/**
 * First-login guided tutorial for students (6 steps, spotlight overlay).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export const TUTORIAL_COMPLETED_KEY = 'stemverse_tutorial_completed';

type StepDef = {
  id: string;
  title: string;
  body: string;
  target?: string;
  route?: string;
};

const STEPS: StepDef[] = [
  {
    id: 'welcome',
    title: 'Welcome to STEMverse',
    body: 'You are joining a galaxy of STEM missions. This quick tour shows where everything lives.',
  },
  {
    id: 'galaxy',
    title: 'Galaxy Map',
    body: 'Each glowing sector is a learning world. Tap an unlocked sector to open its journey.',
    target: '[data-stemverse-tutorial="galaxy-map"]',
    route: '/galaxy',
  },
  {
    id: 'dark-city',
    title: 'Dark City',
    body: 'Many explorers start in Dark City — circuits, power, and rescue missions.',
    target: '[data-stemverse-tutorial="sector-dark-city"]',
    route: '/galaxy',
  },
  {
    id: 'xp',
    title: 'XP and level',
    body: 'Earn XP from missions and journey nodes. Level up to unlock more of the galaxy.',
    target: '[data-stemverse-tutorial="xp-hud"]',
    route: '/galaxy',
  },
  {
    id: 'console',
    title: 'Command Console',
    body: 'Use Command Console for assignments, squad, and awards — your home base between missions.',
    target: '[data-stemverse-tutorial="nav-console"]',
    route: '/galaxy',
  },
  {
    id: 'done',
    title: 'You are ready',
    body: 'Head to the galaxy and start your first mission. You can replay sectors anytime.',
    route: '/galaxy',
  },
];

type Rect = { top: number; left: number; width: number; height: number };

function SpotlightPanels({ rect }: { rect: Rect | null }) {
  if (!rect) {
    return <div className="absolute inset-0 bg-slate-950/75 pointer-events-none" aria-hidden />;
  }
  const pad = 8;
  const t = Math.max(0, rect.top - pad);
  const l = Math.max(0, rect.left - pad);
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;
  const panel = 'absolute bg-slate-950/78 pointer-events-none';
  return (
    <>
      <div className={`${panel} left-0 right-0 top-0`} style={{ height: t }} />
      <div className={`${panel} left-0`} style={{ top: t, width: l, height: h }} />
      <div
        className={`${panel} right-0`}
        style={{ top: t, left: l + w, height: h }}
      />
      <div className={`${panel} left-0 right-0`} style={{ top: t + h, bottom: 0 }} />
      <div
        className="absolute rounded-xl ring-2 ring-teal-400/90 shadow-[0_0_24px_rgba(45,212,191,0.35)] pointer-events-none"
        style={{ top: t, left: l, width: w, height: h }}
        aria-hidden
      />
    </>
  );
}

export default function StudentFirstLoginTutorial({
  open,
  onSkip,
  onFinish,
}: {
  open: boolean;
  onSkip: () => void | Promise<void>;
  onFinish: () => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = STEPS[stepIndex];

  const measureTarget = useCallback(() => {
    if (!step?.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    });
  }, [step?.target]);

  useEffect(() => {
    if (!open) {
      setStepIndex(0);
      setRect(null);
      return;
    }
    const s = STEPS[stepIndex];
    if (s.route) navigate(s.route);
  }, [open, stepIndex, navigate]);

  useEffect(() => {
    if (!open) return;
    measureTarget();
    const t1 = window.setTimeout(measureTarget, 120);
    const t2 = window.setTimeout(measureTarget, 400);
    const onResize = () => measureTarget();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, stepIndex, measureTarget]);

  if (!open || !step) return null;

  const isLast = stepIndex >= STEPS.length - 1;

  const handleNext = async () => {
    if (isLast) {
      await onFinish();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const handleSkip = async () => {
    await onSkip();
  };

  return (
    <div className="fixed inset-0 z-[240] pointer-events-none" role="dialog" aria-modal="true">
      <SpotlightPanels rect={rect} />

      <div className="absolute inset-0 flex flex-col justify-end sm:justify-center items-center p-4 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="pointer-events-auto w-full max-w-md rounded-2xl border border-teal-500/30 bg-[#0A192F] text-white p-4 sm:p-6 shadow-2xl mb-[calc(var(--ca-bottom-nav-clearance,7rem)+0.5rem)] sm:mb-0 max-h-[min(70vh,520px)] overflow-y-auto overscroll-contain"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-teal-300 mb-1">
              Step {stepIndex + 1} of {STEPS.length}
            </p>
            <h3 className="text-xl font-bold mb-2">{step.title}</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-5">{step.body}</p>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void handleSkip()}
                className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => void handleNext()}
                className="px-6 py-2.5 rounded-xl bg-teal-400 text-[#0A192F] font-black text-xs uppercase tracking-widest"
              >
                {isLast ? 'Go to Galaxy' : 'Next'}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
