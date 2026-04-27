/**
 * Quiz Player: run a multi-question quiz, evaluate each with registry, submit score.
 */

import React, { useState, useEffect } from 'react';
import type { ChallengeType, ChallengeContent } from './types';
import { getChallengeType, evaluateResponse } from './registry';
import { supabase } from '../../lib/supabaseClient';

export interface QuizQuestion {
  type: ChallengeType;
  content: ChallengeContent;
}

const authFetch = async (url: string, options?: RequestInit) => {
  const { data } = await supabase.auth.getSession();
  const stored = localStorage.getItem('stemverse_access_token');
  const token = data.session?.access_token || stored;
  const headers = new Headers(options?.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let res = await fetch(url, { ...options, headers, credentials: options?.credentials ?? 'include' });
  if (res.status === 401 && stored && !data.session?.access_token) {
    localStorage.removeItem('stemverse_access_token');
    const retryHeaders = new Headers(options?.headers || {});
    res = await fetch(url, { ...options, headers: retryHeaders, credentials: options?.credentials ?? 'include' });
  }
  return res;
};

const safeFetch = async (url: string, options?: RequestInit) => {
  try {
    const res = await authFetch(url, options);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

interface QuizPlayerProps {
  quizId: number;
  onComplete?: (score: number, total: number) => void;
}

const shuffleQuestions = (items: QuizQuestion[]): QuizQuestion[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const getQuestionTimeLimit = (question: QuizQuestion | undefined): number => {
  const raw = Number((question?.content as { time_limit_sec?: number } | undefined)?.time_limit_sec ?? 20);
  return Number.isFinite(raw) && raw > 0 ? raw : 20;
};

export function QuizPlayer({ quizId, onComplete }: QuizPlayerProps) {
  const [quiz, setQuiz] = useState<{ id: number; title: string; questions: string } | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<unknown[]>([]);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCount, setSelectedCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setLoading(true);
    safeFetch(`/api/quizzes/${quizId}`).then((data) => {
      if (data) {
        setQuiz(data);
        try {
          const parsed = JSON.parse(data.questions || '[]') as QuizQuestion[];
          const randomized = shuffleQuestions(parsed);
          setQuestions(randomized);
          setSelectedCount(0);
          setCurrentIndex(0);
          setResponses([]);
          setTimeLeft(getQuestionTimeLimit(randomized[0]));
          setStreak(0);
          setResult(null);
        } catch {
          setQuestions([]);
        }
      }
      setLoading(false);
    });
  }, [quizId]);

  useEffect(() => {
    if (!questions.length || loading || result) return;
    setTimeLeft(getQuestionTimeLimit(questions[currentIndex]));
  }, [currentIndex, questions, loading, result]);

  useEffect(() => {
    if (loading || result || submitting || questions.length === 0) return;
    const t = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(t);
          handleAnswer(undefined);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, loading, result, submitting, questions.length]);

  const handleAnswer = (response: unknown) => {
    if (submitting) return;
    const next = [...responses];
    next[currentIndex] = response;
    setResponses(next);
    setSelectedCount(next.filter((r) => r !== undefined && r !== null).length);
    const nextQuestion = questions[currentIndex + 1];
    setTimeLeft(getQuestionTimeLimit(nextQuestion));

    const current = questions[currentIndex];
    const currentEval = evaluateResponse(current.type as ChallengeType, current.content, response);
    if (current.type !== 'short_answer') {
      setStreak((prev) => (currentEval.correct ? prev + 1 : 0));
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      // Evaluate and submit: fully auto-graded for all question types.
      let autoScore = 0;
      questions.forEach((q, i) => {
        const evalResult = evaluateResponse(q.type as ChallengeType, q.content, next[i]);
        if (evalResult.correct) autoScore += 1;
      });
      setResult({ score: autoScore, total: questions.length });
      setSubmitting(true);
      authFetch('/api/student-quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: (window as any).__studentId ?? 0,
          quiz_id: quizId,
          score: autoScore,
          auto_score: autoScore,
          total_questions: questions.length,
        }),
      })
        .then(() => {
          onComplete?.(autoScore, questions.length);
        })
        .finally(() => setSubmitting(false));
    }
  };

  if (loading || !quiz) {
    return (
      <div className="p-8 rounded-2xl bg-slate-800/60 border border-slate-600/40 text-slate-400 text-center">
        Loading quiz…
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-600/40 text-slate-400">
        This quiz has no questions.
      </div>
    );
  }

  if (result) {
    const pct = Math.round((result.score / result.total) * 100);
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center px-4 sm:px-8 py-12 overflow-y-auto">
        <div className="absolute inset-0 z-[-1] bg-[radial-gradient(circle_at_50%_35%,_#112a4a_0%,_#081a34_45%,_#030b1d_100%)]" />
        <div className="w-full max-w-4xl rounded-3xl border-2 border-emerald-400/40 bg-gradient-to-br from-slate-900/90 via-[#0c223f]/80 to-[#0a3148]/80 p-6 sm:p-8">
          <h4 className="text-xl sm:text-3xl font-black text-slate-100 uppercase mb-2">{quiz.title}</h4>
          <p className="text-[10px] uppercase tracking-widest text-emerald-300 mb-3 font-black">Quiz completed</p>
          <div className="flex items-center justify-between gap-3 p-4 sm:p-5 rounded-xl bg-emerald-500/20 border border-emerald-400/40">
            <span className="text-3xl sm:text-5xl font-black text-emerald-300">
              {result.score} / {result.total}
            </span>
            <span className="text-slate-100 font-black text-2xl sm:text-4xl">
              {pct}%
            </span>
          </div>
          <div className="mt-4 h-3 w-full rounded-full bg-slate-700/60 overflow-hidden border border-slate-600/40">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
              style={{ width: `${Math.max(8, pct)}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-slate-200">Score saved. This quiz is now marked done in your Command Console.</p>
        </div>
      </div>
    );
  }

  const q = questions[currentIndex];
  const plugin = getChallengeType(q.type as ChallengeType);
  const Player = plugin?.Player;

  if (!Player) {
    return (
      <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-600/40 text-slate-400">
        Question type &quot;{q.type}&quot; is not supported.
      </div>
    );
  }

  if (q.type === 'multiple_choice') {
    return <Player content={q.content} onComplete={handleAnswer} disabled={submitting} />;
  }

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0b1730]/90 via-[#0e223f]/85 to-[#101a33]/90 border border-cyan-500/30 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h4 className="text-lg font-black text-slate-100 uppercase">{quiz.title}</h4>
        <div className="flex items-center gap-3">
          <span className="px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-400/40 text-[10px] text-amber-300 uppercase font-black">
            {Math.max(1, streak)}x combo
          </span>
          <div className="relative w-12 h-12">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="24" cy="24" r="20" stroke="rgba(148,163,184,0.35)" strokeWidth="4" fill="none" />
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="rgba(245,158,11,0.9)"
                strokeWidth="4"
                fill="none"
                strokeDasharray={126}
                strokeDashoffset={126 - (timeLeft / getQuestionTimeLimit(q)) * 126}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-amber-300">{timeLeft}</div>
          </div>
        </div>
      </div>
      <div className="mb-5">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-black mb-1">
          <span className="text-slate-400">Progress</span>
          <span className="text-cyan-300">{selectedCount}/{questions.length} answered</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-700/60 overflow-hidden border border-slate-600/40">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-amber-400"
            style={{ width: `${Math.max(6, Math.round(((currentIndex + 1) / questions.length) * 100))}%` }}
          />
        </div>
      </div>
      <Player content={q.content} onComplete={handleAnswer} disabled={submitting} />
      <div className="mt-6 rounded-xl border border-slate-600/40 bg-slate-900/40 p-3">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-2">Top explorers</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-amber-500/15 border border-amber-400/30 px-2 py-1 text-amber-200 font-semibold">1. Nova_01</div>
          <div className="rounded-lg bg-slate-700/40 border border-slate-600/40 px-2 py-1 text-slate-200 font-semibold">2. CyberGhost</div>
          <div className="rounded-lg bg-slate-700/40 border border-slate-600/40 px-2 py-1 text-slate-200 font-semibold">3. StarDust</div>
        </div>
      </div>
    </div>
  );
}
