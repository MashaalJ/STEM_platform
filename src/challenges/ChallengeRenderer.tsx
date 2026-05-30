/**
 * Challenge Renderer - loads a challenge, renders the correct interaction, evaluates and submits.
 * Used when a student plays an assigned challenge.
 */

import React, { useState, useEffect } from 'react';
import type { ChallengeRecord, ChallengeContent } from './types';
import { getChallengeType, evaluateResponse } from './registry';
import { supabase } from '../../lib/supabaseClient';

const authFetch = async (url: string, options?: RequestInit) => {
  const stored = localStorage.getItem('stemverse_access_token');
  let token = stored;
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token || stored;
  }
  const headers = new Headers(options?.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let res = await fetch(url, { ...options, headers, credentials: options?.credentials ?? 'include' });
  if (res.status === 401 && stored) {
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

interface ChallengeRendererProps {
  challengeId: number;
  onComplete?: (result: { correct: boolean; xp_earned: number; total_xp: number }) => void;
}

export function ChallengeRenderer({ challengeId, onComplete }: ChallengeRendererProps) {
  const [challenge, setChallenge] = useState<ChallengeRecord | null>(null);
  const [content, setContent] = useState<ChallengeContent | null>(null);
  const [result, setResult] = useState<{ correct: boolean; xp_earned: number; total_xp: number } | null>(null);
  const [resultPercent, setResultPercent] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    safeFetch(`/api/challenges/${challengeId}`).then((data) => {
      if (data) {
        setChallenge(data);
        try {
          setContent(JSON.parse(data.content_json || '{}'));
        } catch {
          setContent({});
        }
      }
      setLoading(false);
    });
  }, [challengeId]);

  const handleComplete = async (response: unknown) => {
    if (!challenge || content === null) return;
    const evalResult = evaluateResponse(challenge.type as import('./types').ChallengeType, content, response);
    setResultPercent(Math.round(Math.max(0, Math.min(1, Number(evalResult.score || 0))) * 100));
    const optimistic = { correct: evalResult.correct, xp_earned: evalResult.correct ? Number(challenge.xp_reward || 0) : 0, total_xp: 0 };
    setResult(optimistic);
    onComplete?.(optimistic);
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/challenges/${challengeId}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: evalResult.score,
          correct: evalResult.correct,
          response,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const out = { correct: data.correct ?? evalResult.correct, xp_earned: data.xp_earned ?? 0, total_xp: data.total_xp ?? 0 };
        setResult(out);
        onComplete?.(out);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !challenge) {
    return (
      <div className="assignment-play-surface p-8 rounded-2xl text-center">
        Loading…
      </div>
    );
  }

  const plugin = getChallengeType(challenge.type as import('./types').ChallengeType);
  const Player = plugin?.Player;

  if (result) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center px-4 sm:px-8 py-12 overflow-y-auto">
        <div className="absolute inset-0 z-[-1] bg-[radial-gradient(circle_at_50%_35%,_#112a4a_0%,_#081a34_45%,_#030b1d_100%)]" />
        <div className="w-full max-w-4xl rounded-3xl p-6 sm:p-8 border border-amber-400/30 bg-gradient-to-br from-[#0b1730]/95 via-[#10233f]/90 to-[#0f1a30]/95 shadow-[0_12px_28px_rgba(10,25,47,0.35)]">
          <h4 className="text-lg sm:text-2xl font-black text-slate-100 uppercase tracking-wide mb-3">{challenge.title}</h4>
          <div className={`flex items-center justify-between gap-3 p-4 sm:p-5 rounded-xl ${result.correct ? 'bg-emerald-500/20 border border-emerald-400/35' : 'bg-amber-500/15 border border-amber-500/35'}`}>
            <span className={`text-xl sm:text-3xl font-black ${result.correct ? 'text-emerald-300' : 'text-amber-300'}`}>
              {result.correct ? 'Mission Cleared' : 'Mission Attempted'}
            </span>
            {result.xp_earned > 0 && (
              <span className="text-slate-100 font-mono text-base sm:text-xl">+{result.xp_earned} pts</span>
            )}
          </div>
          <p className="text-base sm:text-lg text-slate-100 mt-4 font-mono">
            Score: {resultPercent != null ? `${resultPercent}%` : result.correct ? '100%' : '0%'}
          </p>
          <p className="text-sm text-slate-300 mt-2">Status saved to your Command Console.</p>
        </div>
      </div>
    );
  }

  if (!Player) {
    return (
      <div className="assignment-play-surface p-6 rounded-2xl">
        <p>This type isn&apos;t available yet.</p>
      </div>
    );
  }

  if (challenge.type === 'multiple_choice') {
    return <Player content={content!} onComplete={handleComplete} disabled={submitting} />;
  }

  return (
    <div className="rounded-3xl p-6 border border-amber-400/30 bg-gradient-to-br from-[#081325]/95 via-[#0f223d]/90 to-[#0d1830]/95 shadow-[0_12px_28px_rgba(10,25,47,0.35)]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h4 className="text-lg font-black text-slate-100 uppercase tracking-wide">{challenge.title}</h4>
          <p className="text-xs text-amber-300/90 font-semibold uppercase tracking-wider">{challenge.xp_reward} pts</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-[10px] text-amber-300 font-black uppercase tracking-widest">
          Mission control
        </span>
      </div>
      <Player content={content!} onComplete={handleComplete} disabled={submitting} />
    </div>
  );
}
