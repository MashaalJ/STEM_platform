/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Rocket, School, Activity, Settings, LogIn, Sparkles, ClipboardList, Award, Users, Trophy, Flame, ChevronRight, X, Map as MapIcon, Zap, Shield, Terminal,
} from 'lucide-react';
import { safeFetch, fetchWithAuth } from '../app/api';
import type {
  Student,
  StudentProgress,
  Class,
  AssignedMissionRow,
  AssignedQuizRow,
  StudentQuizAttemptRow,
  MissionRecommendation,
  Sector,
  StudentProgressPayload,
} from '../app/types';
const STUDENT_SKIPPED_JOIN_KEY = 'stemverse_student_skipped_join';

const StudentDashboard = ({ student, onOpenSettings, navigate }: { student: Student; onOpenSettings?: () => void; navigate?: (path: string) => void }) => {
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [skippedJoinPrompt, setSkippedJoinPrompt] = useState(() => sessionStorage.getItem(STUDENT_SKIPPED_JOIN_KEY) === '1');

  const refetchClasses = () => safeFetch(`/api/students/${student.id}/classes`).then(data => { if (data) setClasses(data); });

  useEffect(() => {
    safeFetch(`/api/students/${student.id}/progress`).then(data => {
      if (data) setProgress(data);
    });
    refetchClasses();
  }, [student.id]);

  const showFirstTimeJoinPrompt = classes.length === 0 && !skippedJoinPrompt;

  const handleJoinClass = async () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) return;
    setJoinError(null);
    setJoinLoading(true);
    try {
      const res = await fetchWithAuth('/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ join_code: code })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setJoinError(data.error || 'Invalid or expired code');
        return;
      }
      setJoinCodeInput('');
      setShowJoinModal(false);
      refetchClasses();
    } finally {
      setJoinLoading(false);
    }
  };

  const detailItems = [
    { label: 'Username', value: student.username ? `@${student.username}` : '—' },
    { label: 'Age', value: student.age != null ? String(student.age) : '—' },
    { label: 'Grade', value: student.grade || '—' },
    { label: 'School', value: student.school || '—' },
    { label: 'City', value: student.city || '—' },
    { label: 'Parent / Guardian email', value: student.parent_email || '—' },
    { label: 'Contact number', value: student.contact_number || '—' },
  ];

  const masteryData = (progress?.quizzes ?? []).map((q: { title: string; score: number; total_questions: number }, i: number) => {
    const pct = q.total_questions ? Math.round((q.score / q.total_questions) * 100) : 0;
    const colors = ['bg-cyan-500', 'bg-amber-500', 'bg-brand-blue', 'bg-rose-500'];
    return { subject: q.title, mastery: pct, color: colors[i % colors.length] };
  });

  return (
    <div className="space-y-12">
      {/* First-time student: do you have a class code? */}
      {showFirstTimeJoinPrompt && (
        <div className="bg-gradient-to-br from-brand-blue/20 to-cyan-500/10 backdrop-blur-xl rounded-2xl border-2 border-brand-blue/40 p-8 shadow-xl">
          <h3 className="text-xl font-black text-slate-100 uppercase tracking-tight mb-2 flex items-center gap-2">
            <School className="text-brand-blue" />
            Welcome! Do you have a class code?
          </h3>
          <p className="text-slate-300 text-sm mb-6">
            If your teacher gave you a code, enter it to join their class and see assignments and announcements. Otherwise you can explore on your own.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => { setShowJoinModal(true); setJoinError(null); setJoinCodeInput(''); }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-blue text-white font-black text-sm uppercase tracking-widest hover:bg-brand-blue/90 transition-all shadow-lg"
            >
              <LogIn className="size-4" />
              Yes, I have a code
            </button>
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem(STUDENT_SKIPPED_JOIN_KEY, '1');
                setSkippedJoinPrompt(true);
              }}
              className="px-6 py-3 rounded-xl border border-slate-500/60 text-slate-300 font-black text-sm uppercase tracking-widest hover:bg-slate-700/50 transition-all"
            >
              No, I&apos;ll explore on my own
            </button>
          </div>
        </div>
      )}

      {/* Hero Profile Section */}
      <div className="relative bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-600/40 p-10 shadow-xl overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
          <Rocket className="size-64 -rotate-12" />
        </div>
        
        <div className="flex flex-col lg:flex-row gap-12 items-center relative z-10">
          <div className="relative">
            <div className="absolute -inset-4 bg-brand-blue/20 rounded-full blur-2xl animate-pulse" />
            <div className="relative size-48 rounded-2xl border-2 border-slate-600/50 overflow-hidden shadow-2xl">
              <img src={student.avatar_url} className="size-full object-cover" alt="" referrerPolicy="no-referrer" />
            </div>
            <div className="absolute -bottom-4 -right-4 bg-brand-blue text-white px-4 py-2 rounded-xl font-black text-sm shadow-xl border-2 border-slate-600/50">
              LVL {student.level}
            </div>
          </div>

          <div className="flex-1 text-center lg:text-left">
            <p className="text-[10px] font-black text-brand-blue uppercase tracking-[0.4em] mb-2">Operator Identity Confirmed</p>
            <h2 className="text-5xl font-black text-slate-100 uppercase tracking-tighter mb-2 italic">{student.name}</h2>
            {student.username && (
              <p className="text-brand-blue font-mono font-bold text-lg mb-4">@{student.username}</p>
            )}
            <div className="flex flex-wrap justify-center lg:justify-start gap-4">
              <div className="bg-slate-700/50 px-6 py-3 rounded-2xl shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total XP</p>
                <p className="text-xl font-black text-slate-100 font-mono">{student.xp}</p>
              </div>
              <div className="bg-slate-700/50 px-6 py-3 rounded-2xl shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg quiz score</p>
                <p className="text-xl font-black text-brand-blue font-mono">
                  {progress?.quizzes?.length
                    ? `${Math.round(
                        progress.quizzes.reduce((a: number, q: { score: number; total_questions: number }) => a + (q.total_questions ? (q.score / q.total_questions) * 100 : 0), 0) /
                          progress.quizzes.length
                      )}%`
                    : '0%'}
                </p>
              </div>
              <div className="bg-slate-700/50 px-6 py-3 rounded-2xl shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Missions</p>
                <p className="text-xl font-black text-slate-100 font-mono">{progress?.quizzes.length || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile details & settings CTA */}
      <div className="glass-panel border-glow rounded-2xl p-6 card-hover-glow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
          {detailItems.map(({ label, value }) => (
            <div key={label}>
              <p className="text-[9px] font-black text-cyan-400/80 uppercase tracking-widest mb-0.5">{label}</p>
              <p className="text-slate-200 font-medium text-sm">{value}</p>
            </div>
          ))}
        </div>
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => onOpenSettings?.()}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-black text-sm uppercase tracking-wider hover:bg-cyan-500/30 transition-all"
          >
            <Settings className="size-4" />
            Edit profile & password
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Skill Tree & Mastery */}
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-600/40 p-8 rounded-2xl shadow-xl">
            <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter mb-8 flex items-center gap-3">
              <Activity className="text-brand-blue" />
              Assessment results
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {masteryData.length === 0 ? (
                <p className="text-slate-400 col-span-2">No assessments completed yet. Complete quizzes from your Command Console or Galaxy.</p>
              ) : masteryData.map((m, i) => (
                <div key={i} className="relative group">
                  <div className="flex justify-between items-end mb-3">
                    <span className="text-xs font-black text-slate-300 uppercase tracking-tight">{m.subject}</span>
                    <span className="text-xs font-mono font-black text-brand-blue">{m.mastery}%</span>
                  </div>
                  <div className="h-3 w-full bg-slate-700/60 rounded-full overflow-hidden border border-slate-600/40 p-0.5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${m.mastery}%` }}
                      className={`h-full ${m.color} rounded-full shadow-[0_0_10px_rgba(0,0,0,0.1)]`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-600/40 p-8 rounded-2xl shadow-xl">
            <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter mb-8 flex items-center gap-3">
              <ClipboardList className="text-brand-blue" />
              Quiz log
            </h3>
            <div className="space-y-4">
              {progress?.quizzes.map((q, i) => (
                <div key={i} className="flex items-center justify-between p-5 bg-slate-700/50 border border-slate-600/40 rounded-2xl hover:bg-slate-700/70 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                      <Zap className="size-5" />
                    </div>
                    <div>
                      <p className="font-black text-slate-100 uppercase tracking-tight text-sm">{q.title}</p>
                      <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Sync Date: {new Date(q.completed_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black font-mono ${q.score / q.total_questions >= 0.7 ? 'text-brand-blue' : 'text-brand-yellow'}`}>
                      {Math.round((q.score / q.total_questions) * 100)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Classes, Achievements & Assessments */}
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-600/40 p-8 rounded-2xl shadow-xl">
            <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter mb-6 flex items-center gap-3">
              <Users className="text-brand-blue" />
              My Classes
            </h3>
            <button
              type="button"
              onClick={() => { setShowJoinModal(true); setJoinError(null); setJoinCodeInput(''); }}
              className="mb-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-blue/20 border border-brand-blue/40 text-brand-blue font-black text-xs uppercase tracking-widest hover:bg-brand-blue/30 transition-all"
            >
              <LogIn className="size-4" />
              Join with code
            </button>
            {showJoinModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !joinLoading && setShowJoinModal(false)}>
                <div className="bg-slate-800 border border-slate-600/50 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                  <h4 className="text-lg font-black text-slate-100 uppercase tracking-tight mb-4">Enter class code</h4>
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={e => { setJoinCodeInput(e.target.value.toUpperCase()); setJoinError(null); }}
                    placeholder="e.g. ABC123"
                    maxLength={10}
                    className="w-full bg-slate-700/50 border border-slate-600/40 rounded-xl px-4 py-3 text-slate-100 font-mono text-lg tracking-widest placeholder:text-slate-400 outline-none focus:border-brand-blue/50 mb-4"
                  />
                  {joinError && <p className="text-rose-400 text-sm mb-4">{joinError}</p>}
                  <div className="flex gap-3">
                    <button type="button" onClick={() => !joinLoading && setShowJoinModal(false)} className="flex-1 py-3 rounded-xl border border-slate-600/50 text-slate-300 font-black uppercase text-xs">Cancel</button>
                    <button type="button" onClick={handleJoinClass} disabled={joinLoading || !joinCodeInput.trim()} className="flex-1 py-3 rounded-xl bg-brand-blue text-white font-black uppercase text-xs hover:bg-brand-blue/90 disabled:opacity-50">Join</button>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar text-sm">
              {classes.length === 0 && (
                <p className="text-slate-400 italic">
                  You are not enrolled in any classrooms yet. Join with a code from your teacher or ask them to add you.
                </p>
              )}
              {classes.map(c => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-700/50 border border-slate-600/40"
                >
                  <div>
                    <p className="font-black text-slate-100 uppercase tracking-tight text-xs">{c.name}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">
                      {c.teacher_name} • {c.student_count} students
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-600/40 p-8 rounded-2xl shadow-xl">
            <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter mb-8 flex items-center gap-3">
              <Trophy className="text-amber-500" />
              Learning Achievements
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {progress?.badges.map((b, i) => (
                <motion.div 
                  key={i} 
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  className="aspect-square bg-slate-700/50 rounded-3xl border border-slate-600/40 flex items-center justify-center group relative shadow-sm"
                >
                  <span className="text-3xl">{b.badge_icon || '🚀'}</span>
                  <div className="absolute -bottom-2 bg-brand-blue text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    Unlocked
                  </div>
                </motion.div>
              ))}
              {Array.from({ length: 6 - (progress?.badges.length || 0) }).map((_, i) => (
                <div key={i} className="aspect-square bg-slate-800/40 rounded-2xl border border-slate-600/50 border-dashed flex items-center justify-center">
                  <Lock className="size-6 text-slate-300" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-brand-blue to-brand-blue/80 p-1 rounded-2xl shadow-2xl shadow-brand-blue/20">
            <div className="bg-slate-800/50 backdrop-blur-xl p-8 rounded-2xl h-full">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-6 flex items-center gap-3">
                <Zap className="text-white" />
                Quizzes &amp; Challenges
              </h3>
              <p className="text-slate-300 text-sm mb-4">Complete your assigned quizzes and challenges in <strong>Command Console</strong>.</p>
              <button
                type="button"
                onClick={() => navigate?.('/console')}
                className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white font-black text-xs uppercase hover:bg-white/20"
              >
                Go to Command Console
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function squadDisplayName(s: Student): string {
  return s.username?.trim() || s.name?.trim() || 'Explorer';
}

const SquadLeaderboard = ({ student }: { student: Student }) => {
  const [classmates, setClassmates] = useState<Student[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<Class[]>([]);
  const [teacherClassId, setTeacherClassId] = useState<string | null>(null);
  const [teacherStudents, setTeacherStudents] = useState<Student[]>([]);

  useEffect(() => {
    if (student.role === 'student') {
      safeFetch(`/api/students/${student.id}/classmates`).then((data) => {
        if (Array.isArray(data)) {
          setClassmates((data as Student[]).filter((s) => s.role === 'student'));
        }
      });
    }
  }, [student.id, student.role]);

  useEffect(() => {
    if (student.role === 'teacher' || student.role === 'admin') {
      safeFetch('/api/classes').then((data) => {
        if (!Array.isArray(data)) return;
        const list = (data as Class[]).filter((c) =>
          student.role === 'teacher' ? c.teacher_id === student.id : true
        );
        setTeacherClasses(list);
        if (list.length > 0 && !teacherClassId) setTeacherClassId(String(list[0].id));
      });
    }
  }, [student.id, student.role, teacherClassId]);

  useEffect(() => {
    if (!teacherClassId || (student.role !== 'teacher' && student.role !== 'admin')) return;
    safeFetch(`/api/classes/${teacherClassId}/students`).then((data) => {
      if (!Array.isArray(data)) return;
      const list = (data as Student[])
        .filter((s) => s.role === 'student')
        .sort((a, b) => b.xp - a.xp);
      setTeacherStudents(list);
    });
  }, [teacherClassId, student.role]);

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      if (document.hidden || cancelled) return;
      if (student.role === 'student') {
        safeFetch(`/api/students/${student.id}/classmates`).then((data) => {
          if (!cancelled && Array.isArray(data)) {
            setClassmates((data as Student[]).filter((s) => s.role === 'student'));
          }
        });
      }
      if (student.role === 'teacher' || student.role === 'admin') {
        safeFetch('/api/classes').then((data) => {
          if (!cancelled && Array.isArray(data)) {
            const list = (data as Class[]).filter((c) =>
              student.role === 'teacher' ? c.teacher_id === student.id : true
            );
            setTeacherClasses(list);
          }
        });
        if (teacherClassId) {
          safeFetch(`/api/classes/${teacherClassId}/students`).then((data) => {
            if (!cancelled && Array.isArray(data)) {
              const list = (data as Student[])
                .filter((s) => s.role === 'student')
                .sort((a, b) => b.xp - a.xp);
              setTeacherStudents(list);
            }
          });
        }
      }
    };
    const id = window.setInterval(pull, 28000);
    const onVis = () => {
      if (!document.hidden) pull();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [student.id, student.role, teacherClassId]);

  const currentClass = useMemo(
    () => teacherClasses.find((c) => c.id === teacherClassId) || null,
    [teacherClasses, teacherClassId]
  );

  const operativeSource = useMemo(() => {
    if (student.role === 'teacher' || student.role === 'admin') {
      return teacherStudents.filter((s) => s.role === 'student');
    }
    const pool = [student, ...classmates.filter((s) => s.id !== student.id && s.role === 'student')];
    return pool.sort((a, b) => b.xp - a.xp);
  }, [student, classmates, teacherStudents]);

  const topThree = operativeSource.slice(0, 3);
  const podiumOrder = [topThree[1], topThree[0], topThree[2]].filter(Boolean) as Student[];
  const topOperatives = operativeSource.slice(3, 10);
  const maxXp = Math.max(...operativeSource.map((s) => s.xp), 1);
  const yourRank = Math.max(1, operativeSource.findIndex((s) => s.id === student.id) + 1);
  const xpToNext =
    yourRank > 1 && operativeSource[yourRank - 2]
      ? Math.max(0, operativeSource[yourRank - 2].xp - student.xp + 1)
      : 0;

  const totalPoolXp = operativeSource.reduce((sum, s) => sum + s.xp, 0);
  const leaderboardOverview = useMemo(() => {
    if (student.role === 'teacher' || student.role === 'admin') {
      return {
        title: currentClass?.name ?? 'Class leaderboard',
        subtitle: teacherStudents.length
          ? `${teacherStudents.length} students in this roster · sorted by total XP`
          : 'Select a class to load live roster totals',
        explorers: teacherStudents.length,
        points: totalPoolXp,
        icon: Rocket,
        accent: 'text-amber-500 border-amber-500/30',
      };
    }
    const n = operativeSource.length;
    return {
      title: 'Your leaderboard pool',
      subtitle:
        classmates.length > 0
          ? `${classmates.length} classmates · ${n} students ranked by XP`
          : 'Join a class to see classmates on the board',
      explorers: n,
      points: totalPoolXp,
      icon: Users,
      accent: 'text-cyan-400 border-cyan-500/30',
    };
  }, [
    student.role,
    student.level,
    currentClass,
    teacherStudents.length,
    classmates.length,
    operativeSource.length,
    totalPoolXp,
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      {(student.role === 'teacher' || student.role === 'admin') && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ca-on-surface-variant)]">Class Command</p>
            <h3 className="text-2xl font-black text-[var(--ca-on-surface)] uppercase tracking-tight">
              {currentClass ? currentClass.name : 'Select a class'}
            </h3>
          </div>
          <select
            value={teacherClassId ?? ''}
            onChange={(e) => setTeacherClassId(e.target.value || null)}
            className="cosmic-input min-w-[220px] !py-2 !px-3 text-sm"
          >
            <option value="">Select class…</option>
            {teacherClasses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            {teacherClasses.length === 0 && <option disabled>No classrooms yet</option>}
          </select>
        </div>
      )}

      <div
        className={`grid gap-8 items-end ${
          podiumOrder.length === 1
            ? 'grid-cols-1 max-w-md mx-auto'
            : podiumOrder.length === 2
              ? 'grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto'
              : 'grid-cols-1 md:grid-cols-3'
        }`}
      >
        {podiumOrder.map((p, idx) => {
          const realRank = topThree.findIndex((x) => x.id === p.id) + 1;
          const isChampion = realRank === 1;
          const avatar = p.avatar_url || `https://picsum.photos/seed/leader-${p.id}/200/200`;
          return (
            <div key={p.id} className={`flex flex-col items-center ${podiumOrder.length === 3 && isChampion ? 'md:-translate-y-8 order-1 md:order-2' : podiumOrder.length === 3 && realRank === 2 ? 'order-2 md:order-1' : podiumOrder.length === 3 ? 'order-3' : ''}`}>
              <div className="relative group">
                <div
                  className={`absolute inset-0 rounded-full blur-3xl opacity-25 group-hover:opacity-45 transition-opacity ${
                    isChampion ? 'bg-amber-500' : realRank === 2 ? 'bg-cyan-400' : 'bg-[var(--ca-tertiary-container)]'
                  }`}
                />
                <img
                  src={avatar}
                  alt={p.name}
                  referrerPolicy="no-referrer"
                  className={`${isChampion ? 'size-44' : 'size-32'} rounded-full border-4 relative z-10 object-cover ${
                    isChampion ? 'border-amber-500' : 'border-slate-300 grayscale group-hover:grayscale-0'
                  }`}
                />
                <div
                  className={`absolute z-20 ${
                    isChampion
                      ? '-bottom-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full'
                      : '-bottom-2 -right-2 size-10 rounded-full'
                  } border-4 border-[var(--ca-surface-bright)] flex items-center justify-center font-black ${
                    isChampion ? 'bg-amber-500 text-[#0A192F]' : 'bg-slate-400 text-white'
                  }`}
                >
                  {realRank}
                </div>
              </div>
              <div className={`mt-6 w-full text-center rounded-t-3xl border border-b-0 p-6 ${
                isChampion
                  ? 'bg-[#020617] border-amber-500/50 shadow-[0_-20px_50px_rgba(255,178,4,0.1)]'
                  : 'bg-[rgba(13,28,50,0.9)] border-amber-500/20'
              }`}>
                <p className={`${isChampion ? 'text-amber-400 text-2xl' : 'text-amber-500 text-lg'} font-black tracking-tight`}>
                  {squadDisplayName(p)}
                  {p.id === student.id && (
                    <span className="ml-2 text-[10px] uppercase text-cyan-300 align-middle">You</span>
                  )}
                </p>
                <p className="text-slate-400 text-sm mt-1 mb-4">{p.xp.toLocaleString()} Renown</p>
                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className={`${isChampion ? 'bg-amber-500' : realRank === 2 ? 'bg-cyan-400' : 'bg-amber-600'} h-full`} style={{ width: `${Math.min(100, Math.max(18, (p.xp / maxXp) * 100))}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-[var(--ca-on-surface)] flex items-center gap-3">
              <Users className="text-[var(--ca-secondary-container)]" />
              Leaderboard overview
            </h3>
          </div>
          {(() => {
            const sq = leaderboardOverview;
            const Icon = sq.icon;
            return (
              <div className="bg-[var(--ca-surface-container-lowest)] p-6 rounded-xl border border-[var(--ca-surface-container-high)] shadow-sm hover:shadow-md transition-shadow flex flex-wrap md:flex-nowrap items-center gap-6">
                <div className={`w-16 h-16 rounded-xl bg-[#020617] flex items-center justify-center shrink-0 border-2 ${sq.accent}`}>
                  <Icon className={`size-8 ${sq.accent.split(' ')[0]}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xl font-black text-[var(--ca-on-surface)]">{sq.title}</h4>
                  <p className="text-[var(--ca-on-surface-variant)] text-sm mt-1">{sq.subtitle}</p>
                </div>
                <div className="flex flex-col items-end min-w-[140px]">
                  <span className="font-mono font-black text-xl text-amber-600">{sq.points.toLocaleString()}</span>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--ca-on-surface-variant)]">Pool XP (live)</span>
                </div>
              </div>
            );
          })()}
        </section>

        <section className="lg:col-span-4">
          <div className="bg-[#020617] rounded-2xl p-8 border border-slate-800 h-full cosmic-inverse">
            <h3 className="text-amber-500 text-2xl font-black mb-8 flex items-center gap-3">
              <Trophy className="size-6" />
              Top Operatives
            </h3>
            <div className="space-y-5">
              {topOperatives.length === 0 && (
                <p className="text-slate-400 text-sm">No additional operatives yet. Complete more missions to populate rankings.</p>
              )}
              {topOperatives.map((s, idx) => {
                const rank = idx + 4;
                const progress = Math.min(100, Math.max(10, (s.xp / maxXp) * 100));
                const above = idx + 2 < operativeSource.length ? operativeSource[idx + 2] : null;
                const gapToRankAbove = above ? Math.max(0, above.xp - s.xp) : null;
                return (
                  <div key={s.id} className="flex items-center gap-4 group">
                    <span className="font-mono text-slate-500 w-6">{String(rank).padStart(2, '0')}</span>
                    <img
                      src={s.avatar_url || `https://picsum.photos/seed/op-${s.id}/100/100`}
                      alt={s.name}
                      referrerPolicy="no-referrer"
                      className="size-12 rounded-lg object-cover grayscale group-hover:grayscale-0 transition-all"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 font-bold truncate">
                        {squadDisplayName(s)}
                        {s.id === student.id && (
                          <span className="ml-1.5 text-[9px] uppercase text-cyan-400 font-black">You</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">LVL {s.level}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-amber-500 font-bold">{s.xp.toLocaleString()}</p>
                      <p className="text-[10px] text-cyan-400">
                        {gapToRankAbove != null
                          ? `${gapToRankAbove.toLocaleString()} XP to rank #${idx + 3}`
                          : '—'}
                      </p>
                    </div>
                  </div>
                );
              })}

              <div className="mt-10 bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl relative overflow-hidden">
                <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-2">Your Current Rank</p>
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-black text-amber-500">#{String(yourRank).padStart(2, '0')}</div>
                  <div className="min-w-0">
                    <p className="text-slate-200 font-bold text-sm truncate">You ({squadDisplayName(student)})</p>
                    <p className="text-slate-500 text-xs">
                      {xpToNext > 0 ? `${xpToNext.toLocaleString()} XP to next rank` : 'You are holding top rank'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-4">
                  <div className="flex-1 p-2 bg-slate-900 rounded-lg">
                    <p className="text-[10px] text-slate-500 uppercase">Level</p>
                    <p className="text-amber-500 font-bold">{student.level}</p>
                  </div>
                  <div className="flex-1 p-2 bg-slate-900 rounded-lg">
                    <p className="text-[10px] text-slate-500 uppercase">XP</p>
                    <p className="text-amber-500 font-bold">{student.xp.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const AwardsView = ({ student }: { student: Student }) => {
  const [progress, setProgress] = useState<StudentProgressPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    safeFetch(`/api/students/${student.id}/progress`).then((data) => {
      if (data && typeof data === 'object' && Array.isArray((data as StudentProgressPayload).badges)) {
        setProgress(data as StudentProgressPayload);
      } else {
        setProgress({ badges: [], quizzes: [], missions_completed: 0 });
      }
    }).finally(() => setLoading(false));
  }, [student.id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      load();
    }, 30000);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  const badgesSorted = useMemo(
    () =>
      [...(progress?.badges ?? [])].sort(
        (a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime()
      ),
    [progress?.badges]
  );
  const featured = badgesSorted[0];
  const quizzes = progress?.quizzes ?? [];
  const missionsCompleted = progress?.missions_completed ?? 0;
  const avgQuizPct =
    quizzes.length > 0
      ? Math.round(
          quizzes.reduce((acc, q) => acc + (q.total_questions > 0 ? (q.score / q.total_questions) * 100 : 0), 0) /
            quizzes.length
        )
      : null;

  const badgeGlyph = (icon: string | null, cls: string) => {
    const k = (icon || '').trim();
    switch (k) {
      case 'Rocket':
        return <Rocket className={cls} />;
      case 'Shield':
        return <Shield className={cls} />;
      case 'Activity':
        return <Activity className={cls} />;
      case 'MapIcon':
        return <MapIcon className={cls} />;
      case 'Terminal':
        return <Terminal className={cls} />;
      case 'Users':
        return <Users className={cls} />;
      case 'Zap':
        return <Zap className={cls} />;
      case 'Sparkles':
        return <Sparkles className={cls} />;
      case 'Flame':
        return <Flame className={cls} />;
      case 'Lock':
        return <Lock className={cls} />;
      case 'Award':
        return <Award className={cls} />;
      default:
        if (k) return <span className="text-4xl leading-none select-none">{k}</span>;
        return <Award className={cls} />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 sm:space-y-10 px-1 sm:px-0">
      <section className="relative">
        <div className="rounded-2xl overflow-hidden border border-slate-700/40 bg-[#0A192F] shadow-2xl relative">
          <div className="absolute inset-0 opacity-25 pointer-events-none bg-[radial-gradient(circle_at_70%_30%,rgba(245,158,11,0.6)_0%,transparent_50%)]" />
          <div className="flex flex-col md:flex-row items-center p-6 sm:p-10 md:p-12 gap-8 md:gap-10 relative z-10">
            <div className="relative group cursor-default shrink-0">
              <div className="absolute -inset-4 bg-amber-500/20 rounded-full blur-2xl group-hover:bg-amber-500/35 transition-all" />
              <div className="size-36 sm:size-40 md:size-48 [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)] bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-2xl shadow-amber-500/20">
                {loading && !featured ? (
                  <Award className="size-14 sm:size-16 text-[#020c1b] animate-pulse" />
                ) : (
                  badgeGlyph(featured?.badge_icon ?? null, 'size-14 sm:size-16 text-[#020c1b]')
                )}
              </div>
            </div>
            <div className="flex-1 space-y-4 text-center md:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase">
                  Live profile
                </span>
                {featured && (
                  <span className="text-slate-400 text-xs">
                    Last award {new Date(featured.earned_at).toLocaleString()}
                  </span>
                )}
              </div>
              <h3 className="text-white text-2xl sm:text-4xl md:text-5xl font-black tracking-tight break-words">
                {featured ? featured.badge_name : 'No badges yet'}
              </h3>
              <p className="text-slate-300 text-sm sm:text-base md:text-lg max-w-2xl">
                {featured
                  ? 'Awarded by your instructors and synced from your account.'
                  : 'Complete missions and quizzes — your teachers can grant badges that appear here automatically.'}
              </p>
              <div className="pt-2 flex flex-wrap gap-3 justify-center md:justify-start">
                <div className="flex items-center gap-2 bg-[#112240]/70 px-4 py-2.5 min-h-[44px] rounded-lg border border-slate-700">
                  <Trophy className="size-4 text-amber-500 shrink-0" />
                  <span className="text-slate-200 text-sm font-mono">
                    {missionsCompleted} mission{missionsCompleted === 1 ? '' : 's'} completed
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-[#112240]/70 px-4 py-2.5 min-h-[44px] rounded-lg border border-slate-700">
                  <ClipboardList className="size-4 text-amber-500 shrink-0" />
                  <span className="text-slate-200 text-sm font-mono">
                    {quizzes.length} quiz attempt{quizzes.length === 1 ? '' : 's'}
                    {avgQuizPct != null ? ` · ${avgQuizPct}% avg` : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 shadow-[0_4px_20px_rgba(10,25,47,0.05)]">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2 mb-6">
            <div>
              <h4 className="text-[#0A192F] text-xl sm:text-2xl font-bold">Badge timeline</h4>
              <p className="text-slate-500 text-sm">Newest first · from your live progress API</p>
            </div>
            <p className="text-xl font-black">
              <span className="text-amber-500">{badgesSorted.length}</span>
              <span className="text-slate-400"> earned</span>
            </p>
          </div>
          {badgesSorted.length === 0 ? (
            <p className="text-slate-500 text-sm py-6">No badges recorded yet.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {badgesSorted.slice(0, 12).map((b) => (
                <div
                  key={b.id}
                  className="shrink-0 size-16 sm:size-[4.5rem] rounded-xl flex items-center justify-center border-2 bg-slate-100 border-amber-500/50 text-amber-600"
                  title={`${b.badge_name} · ${new Date(b.earned_at).toLocaleDateString()}`}
                >
                  {badgeGlyph(b.badge_icon, 'size-7 sm:size-8')}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl p-5 sm:p-8 bg-[rgba(10,25,47,0.92)] border border-amber-500/20 text-white">
          <h4 className="text-amber-500 text-xl sm:text-2xl font-bold mb-6">Progress stats</h4>
          <div className="space-y-5 text-sm sm:text-base">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Badges earned</span>
              <span className="font-mono text-lg">{badgesSorted.length}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Missions completed</span>
              <span className="font-mono text-lg text-amber-400">{missionsCompleted}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Quiz attempts</span>
              <span className="font-mono text-lg">{quizzes.length}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Avg quiz score</span>
              <span className="font-mono text-lg">{avgQuizPct != null ? `${avgQuizPct}%` : '—'}</span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-2xl sm:text-3xl font-bold text-[#0A192F] mb-4 sm:mb-6">Your badges</h3>
        {badgesSorted.length === 0 ? (
          <p className="text-slate-500 text-sm">When teachers award badges, they show up here in real time.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {badgesSorted.map((b) => (
              <div
                key={b.id}
                className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(10,25,47,0.05)] flex gap-4 items-start"
              >
                <div className="size-14 sm:size-16 shrink-0 [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)] bg-amber-500 flex items-center justify-center text-[#020c1b]">
                  {badgeGlyph(b.badge_icon, 'size-7 sm:size-8')}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-base sm:text-lg font-bold text-[#0A192F] break-words">{b.badge_name}</h4>
                  <p className="text-slate-400 text-[10px] sm:text-xs mt-2 uppercase font-bold tracking-widest">
                    Earned {new Date(b.earned_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-2xl sm:text-3xl font-bold text-[#0A192F] mb-4 sm:mb-6">Quiz history</h3>
        {quizzes.length === 0 ? (
          <p className="text-slate-500 text-sm">Completed quizzes will be listed here from your student_quizzes records.</p>
        ) : (
          <div className="space-y-3">
            {quizzes.map((q, i) => (
              <div
                key={q.id ?? `${q.quiz_id}-${q.completed_at}-${i}`}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="font-semibold text-[#0A192F] text-sm sm:text-base break-words">{q.title ?? `Quiz #${q.quiz_id}`}</p>
                <p className="text-slate-600 text-sm tabular-nums">
                  Score {q.score}/{q.total_questions} · {new Date(q.completed_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export function StudentCommandConsole({
  student,
  missionRecommendations,
  assignedMissions,
  assignedChallenges,
  assignedQuizzes,
  studentQuizHistory,
  recentlyCompletedChallengeIds,
  sectors,
  setSelectedSector,
  navigate,
  setGeneratedQuizId,
  setGeneratedQuizTitle,
  setActiveChallengeId,
  challengeAccent,
}: {
  student: Student;
  missionRecommendations: MissionRecommendation[];
  assignedMissions: AssignedMissionRow[];
  assignedChallenges: {
    id: string;
    title: string;
    type: string;
    xp_reward: number;
    latest_score?: number | null;
    latest_correct?: number | null;
    latest_attempted_at?: string | null;
  }[];
  assignedQuizzes: AssignedQuizRow[];
  studentQuizHistory: StudentQuizAttemptRow[];
  recentlyCompletedChallengeIds: string[];
  sectors: Sector[];
  setSelectedSector: (s: Sector | null) => void;
  navigate: (path: string) => void;
  setGeneratedQuizId: (id: string | null) => void;
  setGeneratedQuizTitle: (title: string) => void;
  setActiveChallengeId: (id: string | null) => void;
  challengeAccent: (kind: string) => { ring: string; glow: string; badge: string; symbol: string };
}) {
  return (
    <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="cosmic-page-heading text-4xl font-bold mb-2">
                    Command Console
                  </h2>
                  <p className="cosmic-page-sub text-[10px] text-[var(--ca-on-surface-variant)]">
                    Your assigned missions and assessments
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Quizzes & Challenges (unified) */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="glass-panel p-8 rounded-2xl card-hover-glow border-glow">
                    <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter mb-4 flex items-center gap-3">
                      <Sparkles className="text-cyan-400" />
                      AI Mission Recommendations
                    </h3>
                    {missionRecommendations.length === 0 ? (
                      <p className="text-slate-400 text-sm">
                        Complete a few missions or quizzes to unlock adaptive recommendations.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {missionRecommendations.map((rec) => (
                          <div key={rec.mission_id} className="rounded-xl border border-slate-700/60 bg-[#0d1c32] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-black text-[var(--ca-inverse-on-surface)] uppercase tracking-tight">{rec.title}</p>
                                <p className="text-[10px] uppercase tracking-widest text-amber-400 mt-1">
                                  {(rec.sector || 'STEM')} {rec.difficulty ? `• ${rec.difficulty}` : ''}
                                </p>
                                <p className="text-sm text-slate-200 mt-2">{rec.reason}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => navigate('/galaxy')}
                                className="shrink-0 px-3 py-2 rounded-lg border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/10"
                              >
                                Open map
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="glass-panel p-8 rounded-2xl card-hover-glow border-glow">
                    <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter mb-4 flex items-center gap-3">
                      <ClipboardList className="text-cyan-400" />
                      Quizzes &amp; Challenges
                    </h3>
                    {assignedMissions.length === 0 && assignedChallenges.length === 0 && assignedQuizzes.length === 0 ? (
                      <p className="text-slate-400 text-sm">No activities assigned yet. Your teacher will add them to your class.</p>
                    ) : (
                      <div className="space-y-4">
                        {assignedMissions.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-widest text-amber-300/80 font-black">Activities</p>
                            {assignedMissions.map((m) => {
                              const done = Boolean(m.latest_completed_at);
                              return (
                                <button
                                  key={`mission-${m.id}`}
                                  type="button"
                                  onClick={() => {
                                    const sector = sectors.find((s) => s.id === m.sector_id);
                                    if (sector) {
                                      setSelectedSector(sector);
                                      navigate(`/galaxy/${sector.id}`);
                                    } else {
                                      navigate('/galaxy');
                                    }
                                  }}
                                  className={`w-full flex items-center justify-between gap-3 p-4 rounded-2xl text-left transition-all shadow-sm hover:shadow-md border bg-gradient-to-r ${
                                    done
                                      ? 'from-emerald-500/20 to-cyan-500/5 border-emerald-400/40'
                                      : 'from-slate-800/60 to-slate-800/20 border-amber-400/30 hover:border-amber-300/60'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="size-10 rounded-xl bg-amber-500/20 border border-amber-300/30 flex items-center justify-center text-amber-200 font-black">
                                      ✦
                                    </div>
                                    <div className="min-w-0">
                                      <span className="font-black text-[var(--ca-on-surface)] uppercase text-sm block">{m.title}</span>
                                      <span className="text-[10px] text-[var(--ca-on-surface-variant)] uppercase font-semibold tracking-wide">
                                        Activity · {m.difficulty || 'Medium'} · {m.xp_reward ?? 0} XP
                                      </span>
                                    </div>
                                  </div>
                                  <span className={`text-[10px] uppercase font-black tracking-wide ${done ? 'text-emerald-300' : 'text-amber-300'}`}>
                                    {done ? 'Completed' : 'Open'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {assignedQuizzes.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[10px] uppercase tracking-widest text-cyan-300/80 font-black">Mission quizzes</p>
                              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                                Completed {assignedQuizzes.filter((q) => Number(q.latest_total_questions || 0) > 0).length}/{assignedQuizzes.length}
                              </p>
                            </div>
                            {assignedQuizzes.map((qz) => {
                              const hasScore = qz.latest_score != null;
                              const hasCompletionStamp = Boolean(qz.latest_completed_at);
                              const completed = hasCompletionStamp || hasScore || Number(qz.latest_total_questions || 0) > 0;
                              const pct = completed
                                ? Math.round((Number(qz.latest_score || 0) / Math.max(1, Number(qz.latest_total_questions || 1))) * 100)
                                : null;
                              return (
                                <button
                                  key={`quiz-${qz.id}`}
                                  type="button"
                                  onClick={() => {
                                    setGeneratedQuizId(qz.id);
                                    setGeneratedQuizTitle(qz.title);
                                  }}
                                  className={`w-full flex items-center justify-between gap-3 p-4 rounded-2xl text-left transition-all shadow-sm hover:shadow-md border bg-gradient-to-r ${
                                    completed
                                      ? 'from-emerald-500/20 to-cyan-500/5 border-emerald-400/40'
                                      : 'from-slate-800/60 to-slate-800/20 border-cyan-400/30 hover:border-cyan-300/60'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="size-10 rounded-xl bg-cyan-500/20 border border-cyan-300/30 flex items-center justify-center text-cyan-200 font-black">
                                      ◈
                                    </div>
                                    <div className="min-w-0">
                                    <span className="font-black text-[var(--ca-on-surface)] uppercase text-sm block">{qz.title}</span>
                                    <span className="text-[10px] text-[var(--ca-on-surface-variant)] uppercase font-semibold tracking-wide">
                                      Quiz {completed ? '· Completed' : '· Not started'}
                                    </span>
                                    {completed && qz.latest_completed_at && (
                                      <span className="text-[10px] text-slate-300/80 uppercase font-semibold tracking-wide block mt-1">
                                        Last attempt: {new Date(qz.latest_completed_at).toLocaleString()}
                                      </span>
                                    )}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className={`text-[10px] uppercase font-black tracking-wide block ${completed ? 'text-emerald-300' : 'text-cyan-300'}`}>
                                      {completed ? `${pct}%` : 'Start'}
                                    </span>
                                    {completed && qz.latest_total_questions != null && (
                                      <span className="text-[10px] text-slate-200/90 font-mono block mt-1">
                                        {qz.latest_score}/{qz.latest_total_questions}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {studentQuizHistory.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-widest text-emerald-300/80 font-black">Recent quiz scores</p>
                            {studentQuizHistory
                              .slice()
                              .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
                              .slice(0, 5)
                              .map((q, idx) => {
                                const pct = Math.round((Number(q.score || 0) / Math.max(1, Number(q.total_questions || 1))) * 100);
                                return (
                                  <div
                                    key={`recent-quiz-${q.id ?? `${q.quiz_id}-${idx}`}`}
                                    className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl border border-emerald-400/30 bg-gradient-to-r from-emerald-500/15 to-cyan-500/5"
                                  >
                                    <div className="min-w-0">
                                      <span className="font-black text-[var(--ca-on-surface)] uppercase text-sm block">
                                        {q.title ?? `Quiz #${q.quiz_id}`}
                                      </span>
                                      <span className="text-[10px] text-slate-300/80 uppercase font-semibold tracking-wide block mt-1">
                                        {new Date(q.completed_at).toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[10px] uppercase font-black tracking-wide block text-emerald-300">{pct}%</span>
                                      <span className="text-[10px] text-slate-200/90 font-mono block mt-1">{q.score}/{q.total_questions}</span>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                        {assignedChallenges.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-widest text-amber-300/80 font-black">Interactive challenges</p>
                            {assignedChallenges.map((c) => {
                              const accent = challengeAccent(c.type);
                              const done = c.latest_attempted_at != null || recentlyCompletedChallengeIds.includes(c.id);
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => setActiveChallengeId(c.id)}
                                  className={`w-full flex items-center justify-between gap-3 p-4 rounded-2xl text-left transition-all shadow-sm hover:shadow-md border bg-gradient-to-r ${accent.glow} ${accent.ring}`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`size-10 rounded-xl border flex items-center justify-center font-black ${accent.badge} border-current/40 bg-slate-900/40`}>
                                      {accent.symbol}
                                    </div>
                                    <div className="min-w-0">
                                      <span className="font-black text-[var(--ca-on-surface)] uppercase text-sm block truncate">{c.title}</span>
                                      <span className="text-[10px] text-[var(--ca-on-surface-variant)] uppercase font-semibold tracking-wide">
                                        {c.type.replace(/_/g, ' ')} · {c.xp_reward} XP · {done ? 'Done' : 'Not started'}
                                      </span>
                                    </div>
                                  </div>
                                  <span className={`text-[10px] uppercase font-black tracking-wide ${done ? 'text-emerald-300' : accent.badge}`}>
                                    {done ? (c.latest_correct ? 'Correct' : 'Attempted') : 'Launch'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Status summary */}
                <div className="space-y-6">
                  <div className="glass-panel p-6 rounded-2xl card-hover-glow border-glow">
                    <h4 className="text-sm font-black text-[var(--ca-on-surface)] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <Activity className="size-4 text-amber-500" />
                      Mission Status
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--ca-on-surface-variant)] font-medium">Level</span>
                        <span className="font-mono font-black text-amber-600">LVL {student.level}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--ca-on-surface-variant)] font-medium">Total XP</span>
                        <span className="font-mono font-black text-[var(--ca-on-surface)]">{student.xp.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--ca-on-surface-variant)] font-medium">Next Rank Threshold</span>
                        <span className="font-mono font-black text-[var(--ca-on-surface)]">
                          {((Math.floor(student.xp / 1000) + 1) * 1000).toLocaleString()} XP
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
    </>
  );
}

export { STUDENT_SKIPPED_JOIN_KEY, StudentDashboard, SquadLeaderboard, AwardsView };
