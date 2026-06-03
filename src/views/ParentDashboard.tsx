/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import HoverCard from '../components/motion/HoverCard';
import { Clock, Flame, Link2, Rocket, Sparkles, Target, TrendingUp } from 'lucide-react';
import { authFetch, safeFetch } from '../app/api';

type ChildSummary = {
  linked: boolean;
  name?: string;
  level?: number;
  xp?: number;
  current_sector?: string | null;
  avatar?: string | null;
  last_active?: string | null;
};

type AttendanceSummary = {
  sessions_this_week: number;
  sessions_this_month: number;
  last_active: string | null;
  xp_earned_this_week: number;
  current_streak: number;
};

type ProgressSummary = {
  current_sector_name: string | null;
  missions_completed_in_sector: number;
  total_missions_in_sector: number;
  overall_level: number;
  total_xp: number;
  badges_earned_count: number;
  current_mission_name: string | null;
  next_mission_name: string | null;
};

type ActivityRow = {
  activity_title: string;
  sector_name: string | null;
  source: 'journey_node' | 'mission';
  completed_at: string;
  xp_earned: number;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return 'No activity yet';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

function xpProgressInLevel(xp: number): { pct: number; remaining: number } {
  const inLevel = xp % 1000;
  return { pct: Math.min(100, (inLevel / 1000) * 100), remaining: 1000 - inLevel };
}

export default function ParentDashboard() {
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);
  const [child, setChild] = useState<ChildSummary | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLinkError(null);
    const childRes = await safeFetch('/api/parent/child');
    if (!childRes?.linked) {
      setLinked(false);
      setChild(null);
      setAttendance(null);
      setProgress(null);
      setActivity([]);
      setLoading(false);
      return;
    }
    setLinked(true);
    setChild(childRes as ChildSummary);
    const [att, prog, act] = await Promise.all([
      safeFetch('/api/parent/child/attendance'),
      safeFetch('/api/parent/child/progress'),
      safeFetch('/api/parent/child/activity'),
    ]);
    setAttendance(att as AttendanceSummary | null);
    setProgress(prog as ProgressSummary | null);
    setActivity(Array.isArray(act) ? act : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleLinkChild = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = linkEmail.trim().toLowerCase();
    if (!email) {
      setLinkError('Enter your child\'s registered email.');
      return;
    }
    setLinking(true);
    setLinkError(null);
    try {
      const res = await authFetch('/api/parent/link-child', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_email: email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLinkError(data.message || data.error || 'Could not link account.');
        return;
      }
      setLinkEmail('');
      await loadDashboard();
    } catch {
      setLinkError('Connection failed. Try again.');
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-[calc(var(--ca-header-height)+1.5rem)] py-16 text-center">
        <p className="text-slate-400">Loading family dashboard…</p>
      </div>
    );
  }

  if (!linked) {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 pt-[calc(var(--ca-header-height)+1.5rem)] py-12">
        <HoverCard
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="cosmic-card p-8 lg:p-10"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="size-12 rounded-[var(--ca-radius-md)] bg-[var(--ca-secondary-container)]/20 flex items-center justify-center border border-[var(--ca-outline-variant)]">
              <Link2 className="size-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="cosmic-page-heading text-2xl font-bold">Link your child</h2>
              <p className="cosmic-page-sub text-sm text-[var(--ca-on-surface-variant)]">Read-only family view</p>
            </div>
          </div>
          <p className="text-[var(--ca-on-surface-variant)] text-sm mb-6">
            Enter your child&apos;s registered email to link their account.
          </p>
          <form onSubmit={handleLinkChild} className="space-y-4">
            <input
              type="email"
              value={linkEmail}
              onChange={(e) => setLinkEmail(e.target.value)}
              placeholder="student@school.edu"
              className="cosmic-input w-full"
              autoComplete="email"
            />
            {linkError && (
              <p className="text-rose-500 text-xs font-semibold">{linkError}</p>
            )}
            <button
              type="submit"
              disabled={linking}
              className="cosmic-btn-primary w-full disabled:opacity-50"
            >
              {linking ? 'Linking…' : 'Link child account'}
            </button>
          </form>
        </HoverCard>
      </div>
    );
  }

  const xp = child?.xp ?? 0;
  const level = child?.level ?? 1;
  const { pct: xpPct, remaining: xpRemaining } = xpProgressInLevel(xp);
  const sectorDone = progress?.missions_completed_in_sector ?? 0;
  const sectorTotal = progress?.total_missions_in_sector ?? 0;
  const sectorPct = sectorTotal > 0 ? Math.min(100, (sectorDone / sectorTotal) * 100) : 0;
  const lastActive = attendance?.last_active || child?.last_active;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-[calc(var(--ca-header-height)+1.5rem)] space-y-6 pb-32">
      <div className="mb-2 rounded-2xl border border-rose-400/20 bg-rose-500/5 px-5 py-4">
        <h2 className="text-3xl sm:text-4xl font-bold mb-1 text-white">Family Dashboard</h2>
        <p className="text-[10px] text-rose-200/80 uppercase tracking-widest font-semibold">
          Read-only progress overview · not a student game account
        </p>
      </div>

      {/* Card 1 — Child Header */}
      <HoverCard
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="cosmic-card p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start sm:items-center"
      >
        <div className="size-20 sm:size-24 rounded-[var(--ca-radius-lg)] border-2 border-[var(--ca-outline-variant)] overflow-hidden bg-[var(--ca-surface-container-low)] shrink-0">
          <img
            src={child?.avatar || 'https://picsum.photos/seed/parent-child/200/200'}
            alt=""
            className="size-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex-1 min-w-0 w-full">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h3 className="text-2xl sm:text-3xl font-bold text-[var(--ca-on-surface)] truncate">
              {child?.name}
            </h3>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-widest">
              <Rocket className="size-3.5" />
              Level {level}
            </span>
          </div>
          {child?.current_sector && (
            <p className="text-sm text-[var(--ca-on-surface-variant)] mb-3">
              Current sector: <span className="text-cyan-400 font-semibold">{child.current_sector}</span>
            </p>
          )}
          <div className="mb-2">
            <div className="flex justify-between text-[10px] uppercase font-black tracking-widest text-[var(--ca-on-surface-variant)] mb-1">
              <span>{xp.toLocaleString()} XP</span>
              <span>{xpRemaining} XP to level {level + 1}</span>
            </div>
            <div className="h-3 rounded-full bg-[var(--ca-surface-container)] border border-[var(--ca-outline-variant)] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-cyan-500 transition-all duration-500"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-[var(--ca-on-surface-variant)] flex items-center gap-1.5">
            <Clock className="size-3.5 opacity-70" />
            Last active: {formatWhen(lastActive)}
          </p>
        </div>
      </HoverCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 2 — This Week */}
        <HoverCard
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="cosmic-card p-6"
        >
          <h4 className="text-sm font-black uppercase tracking-widest text-[var(--ca-on-surface-variant)] mb-4 flex items-center gap-2">
            <TrendingUp className="size-4 text-cyan-400" />
            This week
          </h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-[var(--ca-on-surface)]">
                {attendance?.sessions_this_week ?? 0}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-[var(--ca-on-surface-variant)] mt-1">
                Sessions
              </p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-400">
                {attendance?.xp_earned_this_week ?? 0}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-[var(--ca-on-surface-variant)] mt-1">
                XP earned
              </p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[var(--ca-on-surface)] flex items-center justify-center gap-1">
                <Flame className="size-6 text-orange-400" />
                {attendance?.current_streak ?? 0}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-[var(--ca-on-surface-variant)] mt-1">
                Day streak
              </p>
            </div>
          </div>
        </HoverCard>

        {/* Card 3 — Current Mission */}
        <HoverCard
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="cosmic-card p-6"
        >
          <h4 className="text-sm font-black uppercase tracking-widest text-[var(--ca-on-surface-variant)] mb-4 flex items-center gap-2">
            <Target className="size-4 text-amber-400" />
            Current mission
          </h4>
          <p className="text-lg font-bold text-[var(--ca-on-surface)] mb-1">
            {progress?.current_sector_name || child?.current_sector || 'Exploring'}
          </p>
          {progress?.current_mission_name && (
            <p className="text-sm text-[var(--ca-on-surface-variant)] mb-4">
              Latest: {progress.current_mission_name}
            </p>
          )}
          <div className="mb-3">
            <div className="flex justify-between text-[10px] uppercase font-black tracking-widest text-[var(--ca-on-surface-variant)] mb-1">
              <span>Sector progress</span>
              <span>
                {sectorDone} / {sectorTotal}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--ca-surface-container)] border border-[var(--ca-outline-variant)] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#3C3489] to-cyan-500"
                style={{ width: `${sectorPct}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-cyan-400/90 font-semibold">
            {progress?.next_mission_name
              ? <>Next mission: {progress.next_mission_name}</>
              : sectorTotal > 0 && sectorDone >= sectorTotal
                ? 'Sector complete — great work!'
                : 'Next mission: exploring new challenges'}
          </p>
          <p className="text-[10px] text-[var(--ca-on-surface-variant)] mt-3 uppercase tracking-wider">
            {progress?.badges_earned_count ?? 0} badges earned · Level {progress?.overall_level ?? level}
          </p>
        </HoverCard>
      </div>

      {/* Card 4 — Recent Activity */}
      <HoverCard
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="cosmic-card p-6 sm:p-8"
      >
        <h4 className="text-sm font-black uppercase tracking-widest text-[var(--ca-on-surface-variant)] mb-4 flex items-center gap-2">
          <Sparkles className="size-4 text-cyan-400" />
          Recent activity
        </h4>
        {activity.length === 0 ? (
          <p className="text-sm text-[var(--ca-on-surface-variant)]">No completed activities yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--ca-radius-md)] border border-[var(--ca-outline-variant)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--ca-surface-container-low)] text-[10px] uppercase tracking-widest text-[var(--ca-on-surface-variant)]">
                  <th className="text-left px-4 py-3 font-black">Activity</th>
                  <th className="text-left px-4 py-3 font-black hidden sm:table-cell">Sector</th>
                  <th className="text-right px-4 py-3 font-black">XP</th>
                  <th className="text-right px-4 py-3 font-black">Date</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((row, i) => (
                  <tr
                    key={`${row.source}-${row.activity_title}-${row.completed_at}-${i}`}
                    className={
                      i % 2 === 0
                        ? 'bg-[var(--ca-surface-container-low)]/40'
                        : 'bg-[var(--ca-surface)]/60'
                    }
                  >
                    <td className="px-4 py-3 text-[var(--ca-on-surface)]">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ca-on-surface-variant)] mb-0.5">
                        {row.source === 'journey_node' ? 'Completed node:' : 'Completed mission:'}
                      </p>
                      <p className="font-semibold">{row.activity_title}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--ca-on-surface-variant)] hidden sm:table-cell">
                      {row.sector_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-400 font-bold">+{row.xp_earned}</td>
                    <td className="px-4 py-3 text-right text-[var(--ca-on-surface-variant)] text-xs whitespace-nowrap">
                      {formatWhen(row.completed_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </HoverCard>
    </div>
  );
}
