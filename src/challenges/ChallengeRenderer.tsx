/**
 * Challenge Renderer - loads a challenge, renders the correct interaction, evaluates and submits.
 * Used when a student plays an assigned challenge.
 */

import React, { useState, useEffect } from 'react';
import type { ChallengeRecord, ChallengeContent } from './types';
import { getChallengeType, evaluateResponse } from './registry';

const safeFetch = async (url: string, options?: RequestInit) => {
  try {
    const res = await fetch(url, { ...options, credentials: options?.credentials ?? 'include' });
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
    setSubmitting(true);
    try {
      const res = await fetch(`/api/challenges/${challengeId}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
      <div className="assignment-play-surface p-6 rounded-2xl shadow-[0_8px_20px_rgba(10,25,47,0.08)]">
        <h4 className="text-lg font-bold text-[var(--ca-on-surface)] mb-2">{challenge.title}</h4>
        <div className={`flex items-center gap-3 p-4 rounded-xl ${result.correct ? 'bg-[rgba(13,28,50,0.08)] border border-[rgba(13,28,50,0.2)]' : 'bg-amber-500/15 border border-amber-500/35'}`}>
          <span className={`text-2xl font-black ${result.correct ? 'text-[var(--ca-primary-container)]' : 'text-amber-700'}`}>
            {result.correct ? 'Nice!' : 'Try again'}
          </span>
          {result.xp_earned > 0 && (
            <span className="text-[var(--ca-on-surface)] font-mono">+{result.xp_earned} pts</span>
          )}
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

  return (
    <div className="assignment-play-surface p-6 rounded-2xl shadow-[0_8px_20px_rgba(10,25,47,0.08)]">
      <h4 className="text-lg font-bold text-[var(--ca-on-surface)] mb-1">{challenge.title}</h4>
      <p className="text-xs text-[var(--ca-on-surface-variant)] font-semibold mb-4">{challenge.xp_reward} pts</p>
      <Player content={content!} onComplete={handleComplete} disabled={submitting} />
    </div>
  );
}
