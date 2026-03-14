/**
 * Quiz Player: run a multi-question quiz, evaluate each with registry, submit score.
 */

import React, { useState, useEffect } from 'react';
import type { ChallengeType, ChallengeContent } from './types';
import { getChallengeType, evaluateResponse } from './registry';

export interface QuizQuestion {
  type: ChallengeType;
  content: ChallengeContent;
}

const safeFetch = async (url: string, options?: RequestInit) => {
  try {
    const res = await fetch(url, { ...options, credentials: options?.credentials ?? 'include' });
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

export function QuizPlayer({ quizId, onComplete }: QuizPlayerProps) {
  const [quiz, setQuiz] = useState<{ id: number; title: string; questions: string } | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<unknown[]>([]);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    safeFetch(`/api/quizzes/${quizId}`).then((data) => {
      if (data) {
        setQuiz(data);
        try {
          setQuestions(JSON.parse(data.questions || '[]'));
        } catch {
          setQuestions([]);
        }
      }
      setLoading(false);
    });
  }, [quizId]);

  const handleAnswer = (response: unknown) => {
    const next = [...responses];
    next[currentIndex] = response;
    setResponses(next);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      // Evaluate and submit
      let score = 0;
      questions.forEach((q, i) => {
        const evalResult = evaluateResponse(q.type as ChallengeType, q.content, next[i]);
        if (evalResult.correct) score += 1;
      });
      setResult({ score, total: questions.length });
      setSubmitting(true);
      fetch('/api/student-quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          student_id: (window as any).__studentId ?? 0,
          quiz_id: quizId,
          score,
          total_questions: questions.length,
        }),
      })
        .then(() => {
          onComplete?.(score, questions.length);
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
    return (
      <div className="p-6 rounded-2xl border-2 border-slate-600/50 bg-slate-800/60">
        <h4 className="text-lg font-black text-slate-100 uppercase mb-2">{quiz.title}</h4>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-cyan-500/20 border border-cyan-500/40">
          <span className="text-2xl font-black text-cyan-400">
            {result.score} / {result.total}
          </span>
          <span className="text-slate-200">
            {Math.round((result.score / result.total) * 100)}%
          </span>
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

  return (
    <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-600/40">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-black text-slate-100 uppercase">{quiz.title}</h4>
        <span className="text-[10px] text-slate-500 uppercase font-black">
          Question {currentIndex + 1} of {questions.length}
        </span>
      </div>
      <Player content={q.content} onComplete={handleAnswer} disabled={submitting} />
    </div>
  );
}
