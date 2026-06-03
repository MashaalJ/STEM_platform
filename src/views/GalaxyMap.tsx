/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Rocket, Map as MapIcon, Lock, ChevronRight, ArrowLeft, Play, Sparkles, AlertTriangle, Activity,
} from 'lucide-react';
import { safeFetch, authFetch } from '../app/api';
import { stembotFallbackReply } from '../lib/stembot';
import { STORY_GALAXY, galaxySystemAlert, lockedSectorTitle } from '../lib/story';
import type { Sector, Mission, Student } from '../app/types';
import JourneyView from './JourneyView';
const ORBIT_RADIUS_PCT = 34;

function galaxyOrbitPositions(n: number): { x: number; y: number }[] {
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => {
    const base = (2 * Math.PI * i) / n - Math.PI / 2;
    const jitter = (((i * 17 + n * 3) % 11) - 5) * 0.035;
    const r = ORBIT_RADIUS_PCT + (i % 3) * 2.2;
    const angle = base + jitter;
    return {
      x: 50 + r * Math.cos(angle),
      y: 50 + r * Math.sin(angle),
    };
  });
}

function galaxyHudTooltipClass(i: number): string {
  const m = i % 4;
  if (m === 0) return 'absolute -right-24 sm:-right-28 top-0';
  if (m === 1) return 'absolute -left-24 sm:-left-28 top-2';
  if (m === 2) return 'absolute right-full mr-3 bottom-0';
  return 'absolute left-1/2 -translate-x-1/2 top-full mt-2';
}

function AnimatedCheckmark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <motion.path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      />
    </svg>
  );
}


const GalaxyMap = ({
  sectors,
  onSelectSector,
  onOpenCurriculum,
  onOpenRocketChat,
  student,
  activeMission,
}: {
  sectors: Sector[];
  onSelectSector: (s: Sector) => void;
  onOpenCurriculum: () => void;
  onOpenRocketChat: () => void;
  student: Student | null;
  activeMission: Mission | null;
}) => {
  const [highlightSectorId, setHighlightSectorId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const id =
        localStorage.getItem('stemverse_highlight_sector_id') ||
        sessionStorage.getItem('stemverse_highlight_sector_id');
      if (id) {
        setHighlightSectorId(id);
        localStorage.removeItem('stemverse_highlight_sector_id');
        sessionStorage.removeItem('stemverse_highlight_sector_id');
      }
    } catch {
      /* ignore */
    }
  }, []);

  const sectorPositions = useMemo(() => galaxyOrbitPositions(sectors.length), [sectors.length]);

  const firstUnlocked = useMemo(
    () => sectors.find((s) => s.status !== 'locked'),
    [sectors]
  );

  const sectorSizeClass = (i: number) => {
    const m = i % 4;
    if (m === 0) return 'size-[5.5rem] sm:size-28';
    if (m === 1) return 'size-24 sm:size-24';
    if (m === 2) return 'size-20 sm:size-22';
    return 'size-20 sm:size-20';
  };

  const xpDisplay = student?.xp ?? 0;
  const avgMastery =
    sectors.length > 0
      ? Math.round(sectors.reduce((a, s) => a + s.mastery_percent, 0) / sectors.length)
      : 0;
  const starterSector = sectors.find((s) => Number(s.is_starter) === 1) ?? sectors.find((s) => s.status !== 'locked');
  const systemAlert = galaxySystemAlert({
    sectorsCount: sectors.length,
    needsProfile: Boolean(student && (!student.grade || !student.school)),
    hasActiveMission: Boolean(activeMission),
    starterSectorName: starterSector?.name ?? null,
  });

  const xpInLevel = student != null ? student.xp % 1000 : 0;
  const xpPct = student != null ? Math.min(100, (xpInLevel / 1000) * 100) : 0;

  return (
    <div className="space-y-6">
      {student && (
        <div
          data-stemverse-tutorial="xp-hud"
          className="ca-glass-hud relative z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 px-4 py-3 shadow-lg"
          aria-label="Explorer progress"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
              {student.username ? `@${student.username}` : student.name}
            </p>
            <p className="text-lg font-bold text-amber-500 tabular-nums">{xpDisplay.toLocaleString()} XP</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Level</p>
              <p className="text-xl font-black text-emerald-400 tabular-nums">{student.level}</p>
            </div>
            <div className="hidden sm:block w-28">
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-[width]" style={{ width: `${xpPct}%` }} />
              </div>
              <p className="text-[9px] text-slate-500 mt-1 font-mono">{xpInLevel} / 1000</p>
            </div>
          </div>
        </div>
      )}

      <div
        data-stemverse-tutorial="galaxy-map"
        className="relative z-0 w-full min-h-[min(70vh,640px)] sm:min-h-[min(82vh,780px)] max-w-none mx-auto overflow-hidden ca-starfield shadow-[0_8px_40px_rgba(2,6,23,0.45)] rounded-2xl"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(96%,1200px)] aspect-square max-w-[1200px] pointer-events-none">
          <div className="ca-orbit-line w-[37.5%] h-[37.5%]" />
          <div className="ca-orbit-line w-[68.75%] h-[68.75%]" />
          <div className="ca-orbit-line w-[93.75%] h-[93.75%]" />
        </div>

        <div className="relative z-10 h-full min-h-[inherit] flex items-center justify-center p-4 sm:p-8">
          <div className="relative w-full h-full max-w-[1240px] min-h-[min(68vh,560px)] sm:min-h-[720px] lg:min-h-[820px]">
            {/* Core curriculum node */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 group/core">
              <div className="absolute -inset-8 bg-amber-500/20 blur-3xl rounded-full pointer-events-none" />
              <motion.button
                type="button"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.98 }}
                onClick={onOpenCurriculum}
                className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center bg-gradient-to-tr from-amber-400 to-amber-600 shadow-[0_0_50px_rgba(245,158,11,0.45)] border-4 border-amber-300 transition-transform duration-500 disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Core curriculum"
              >
                <Sparkles className="size-9 sm:size-10 text-[#0A192F]" strokeWidth={2.25} aria-hidden />
              </motion.button>
              <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 text-center whitespace-nowrap pointer-events-none">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-500">{STORY_GALAXY.coreLabel}</p>
                <p className="text-xs font-mono text-slate-500 mt-0.5">
                  {sectors.length ? `${avgMastery}% ${STORY_GALAXY.coreSyncLabel}` : '—'}
                </p>
              </div>
            </div>

            {sectors.map((sector, i) => {
              const pos = sectorPositions[i];
              if (!pos) return null;
              const isLocked = sector.status === 'locked';
              const isComingSoon = sector.status === 'coming_soon';
              const isInactive = isLocked || isComingSoon;
              const isStarter = Number(sector.is_starter) === 1;
              const isHighlighted = highlightSectorId != null && String(sector.id) === highlightSectorId;
              const shortLabel =
                sector.name.length > 14 ? `${sector.name.slice(0, 12)}…` : sector.name;

              return (
                <motion.div
                  key={sector.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.08, type: 'spring', stiffness: 260, damping: 20 }}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                >
                  <div className={`relative group ${isInactive ? 'cursor-not-allowed' : 'cursor-pointer'} ${isComingSoon ? 'opacity-40' : ''}`}>
                    <motion.div
                      animate={
                        isHighlighted
                          ? {
                              scale: [1, 1.08, 1],
                              boxShadow: [
                                '0 0 0 0 rgba(45,212,191,0.5)',
                                '0 0 24px 6px rgba(45,212,191,0.65)',
                                '0 0 0 0 rgba(45,212,191,0.5)',
                              ],
                            }
                          : isLocked
                            ? { scale: [1, 1.03, 1] }
                            : {}
                      }
                      transition={
                        isHighlighted || isLocked
                          ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
                          : undefined
                      }
                    >
                    <motion.button
                      type="button"
                      data-stemverse-tutorial={
                        sector.name.toLowerCase().includes('dark city') ? 'sector-dark-city' : undefined
                      }
                      whileHover={isInactive ? {} : { scale: 1.04 }}
                      whileTap={isInactive ? {} : { scale: 0.97 }}
                      onClick={() => !isInactive && onSelectSector(sector)}
                      title={isLocked ? lockedSectorTitle(sector.name, sector.required_level) : isComingSoon ? 'Coming soon' : sector.description}
                      className={`relative rounded-full overflow-hidden border-2 border-amber-500/30 transition-[border-color,transform] duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 ${sectorSizeClass(
                        i
                      )} ${isLocked ? 'opacity-75' : isComingSoon ? '' : 'group-hover:border-amber-500 group-hover:scale-[1.02]'}`}
                      aria-label={isLocked ? lockedSectorTitle(sector.name, sector.required_level) : isComingSoon ? `${sector.name} — coming soon` : sector.name}
                      disabled={isComingSoon}
                    >
                      {isLocked ? (
                        <div className="size-full bg-[#0A192F]/80 flex items-center justify-center">
                          <Lock className="size-6 text-slate-400" aria-hidden />
                        </div>
                      ) : isComingSoon ? (
                        <div className="size-full bg-slate-800/90 flex items-center justify-center grayscale">
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 px-1 text-center leading-tight">Soon</span>
                        </div>
                      ) : (
                        <div
                          className="size-full"
                          style={{
                            background: isStarter
                              ? 'radial-gradient(circle at 30% 30%, #5eead4 0%, #00bfa5 40%, #0f172a 100%)'
                              : i % 4 === 0
                                ? 'radial-gradient(circle at 30% 30%, #67e8f9 0%, #0ea5e9 45%, #082f49 100%)'
                                : i % 4 === 1
                                  ? 'radial-gradient(circle at 35% 35%, #fcd34d 0%, #f59e0b 45%, #78350f 100%)'
                                  : i % 4 === 2
                                    ? 'radial-gradient(circle at 40% 35%, #a78bfa 0%, #7c3aed 50%, #2e1065 100%)'
                                    : 'radial-gradient(circle at 35% 35%, #6ee7b7 0%, #10b981 45%, #064e3b 100%)',
                          }}
                        >
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(255,255,255,0.26),transparent_35%)]" />
                        </div>
                      )}
                    </motion.button>
                    </motion.div>

                    {!isInactive && (
                      <div
                        className={`ca-glass-hud p-2.5 rounded-lg w-28 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 ${galaxyHudTooltipClass(i)}`}
                      >
                        <p className="text-amber-500 font-bold text-[10px] uppercase tracking-wide truncate">
                          {shortLabel}
                        </p>
                        <div className="h-1 bg-slate-700 w-full mt-2 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 transition-[width] duration-300"
                            style={{ width: `${Math.min(100, Math.max(0, sector.mastery_percent))}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {isStarter && !isInactive && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-black uppercase tracking-widest text-[#0A192F] bg-teal-300 px-2 py-0.5 rounded-full border border-teal-400/80 shadow-sm z-20">
                        {STORY_GALAXY.starterBadge}
                      </div>
                    )}
                    {isComingSoon && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-black uppercase tracking-widest text-slate-200 bg-slate-700 px-2 py-0.5 rounded-full border border-slate-500/80 shadow-sm z-20">
                        Coming Soon
                      </div>
                    )}
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white bg-[#0A192F] px-2 py-0.5 rounded border border-slate-800/80 max-w-[140px] truncate">
                      {isLocked ? `Lvl ${sector.required_level}` : isComingSoon ? 'Coming Soon' : shortLabel}
                    </div>
                  </div>
                </motion.div>
              );
            })}

            <div className="absolute top-4 right-4 flex flex-col items-end gap-0.5 max-w-[220px] z-[26] pointer-events-none">
              {student?.username && (
                <span className="text-sm font-mono font-bold text-amber-400">@{student.username}</span>
              )}
              {student?.name && (
                <span className="text-[10px] text-slate-500 truncate max-w-full">{student.name}</span>
              )}
            </div>

            <div className="absolute top-4 left-4 flex flex-col gap-0.5 max-w-[200px] z-[26] pointer-events-none">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Galaxy map</span>
              <span className="text-[11px] font-mono text-slate-400">Click a sector node to enter</span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-6xl mx-auto">
        <div className="ca-glass-hud p-5 rounded-xl border-l-4 border-amber-500">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 mb-1">Current mission</p>
          <p className="text-sm font-bold text-white leading-snug">
            {activeMission?.title ?? 'No mission in flight'}
          </p>
          {activeMission?.difficulty && (
            <p className="text-xs text-amber-500/70 mt-1.5">Difficulty: {activeMission.difficulty}</p>
          )}
        </div>
        <div className="ca-glass-hud p-5 rounded-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 mb-1">Active sectors</p>
          <div className="flex -space-x-2 mt-2">
            {sectors.slice(0, 4).map((s, idx) => (
              <div
                key={s.id}
                className={`size-8 rounded-full border-2 border-[#0f172a] overflow-hidden ${
                  s.status === 'locked' ? 'bg-slate-600' : s.status === 'coming_soon' ? 'bg-slate-700 opacity-40' : 'ring-1 ring-amber-500/40'
                }`}
                title={s.name}
              >
                {!s.image_url || s.status === 'locked' ? (
                  <div className={`size-full ${idx % 3 === 0 ? 'bg-slate-600' : idx % 3 === 1 ? 'bg-amber-500' : 'bg-sky-500'}`} />
                ) : (
                  <img src={s.image_url} alt="" className="size-full object-cover" />
                )}
              </div>
            ))}
            {sectors.length === 0 && (
              <>
                <div className="size-8 rounded-full border-2 border-[#0f172a] bg-slate-600" />
                <div className="size-8 rounded-full border-2 border-[#0f172a] bg-amber-500" />
              </>
            )}
          </div>
        </div>
        <div className="ca-glass-hud p-5 rounded-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 mb-1">System alert</p>
          <div className="flex items-center gap-2 mt-2 min-h-[2rem]">
            <AlertTriangle className="size-5 text-amber-500 shrink-0 animate-pulse" aria-hidden />
            <p className="text-sm font-mono text-slate-200 leading-tight">{systemAlert}</p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenRocketChat}
        className="fixed bottom-24 right-6 sm:bottom-28 sm:right-10 z-40 flex items-center gap-2 rounded-full bg-amber-500 text-[#0A192F] p-3 sm:p-4 font-bold shadow-2xl shadow-black/30 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:pointer-events-none group/fab"
        aria-label="Open rocket assistant"
      >
        <Rocket className="size-5 shrink-0" aria-hidden />
        <span className="max-w-0 overflow-hidden group-hover/fab:max-w-[10rem] transition-all duration-300 whitespace-nowrap text-sm hidden sm:inline">
          ASK ROCKET
        </span>
      </button>
    </div>
  );
};


type CurriculumItem = { id: string; name: string; teacherId: number | null };

const CURRICULUM_STORAGE_KEY = 'stemverse_curriculum_items_v1';

const DEFAULT_CURRICULUM: CurriculumItem[] = [
  'Robotics',
  'Artificial Intelligence',
  'Science',
  'Mathematics',
  '3D Modelling and Printing',
  'Electricity and Electronics',
  'Fin Tech',
  'Space Tech',
  'Health Tech',
  'Game Development',
  'Web Development',
  'App Development',
].map((name, idx) => ({ id: `default-${idx + 1}`, name, teacherId: null }));

const CoreCurriculumHub = ({
  student,
  onBack,
}: {
  student: Student | null;
  onBack: () => void;
}) => {
  const [items, setItems] = useState<CurriculumItem[]>([]);
  const [teachers, setTeachers] = useState<Student[]>([]);
  const [newItemName, setNewItemName] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem(CURRICULUM_STORAGE_KEY);
    if (!raw) {
      setItems(DEFAULT_CURRICULUM);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setItems(parsed);
      } else {
        setItems(DEFAULT_CURRICULUM);
      }
    } catch {
      setItems(DEFAULT_CURRICULUM);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CURRICULUM_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (student?.role !== 'admin') return;
    safeFetch('/api/students').then((data) => {
      if (!Array.isArray(data)) return;
      setTeachers(data.filter((s: Student) => s.role === 'teacher' || s.role === 'admin'));
    });
  }, [student?.role]);

  const addItem = () => {
    const name = newItemName.trim();
    if (!name) return;
    setItems((prev) => [...prev, { id: `custom-${Date.now()}`, name, teacherId: null }]);
    setNewItemName('');
  };

  const setTeacher = (id: string, teacherId: number | null) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, teacherId } : item)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-8 px-4 sm:px-6 lg:px-10 py-6">
      <div className="max-w-6xl mx-auto">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0d1c32]/70 border border-amber-400/30 text-amber-300 hover:bg-[#0d1c32]/90"
        >
          <ArrowLeft className="size-4" />
          Back to Galaxy
        </button>
      </div>
      <div className="max-w-6xl mx-auto rounded-3xl border border-amber-400/25 bg-gradient-to-br from-[#081325]/95 via-[#0f223d]/90 to-[#0d1830]/95 p-6 sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-amber-400 mb-2">Core Curriculum</p>
        <h2 className="text-3xl sm:text-4xl font-black text-white">Learning Constellations</h2>
        <p className="text-slate-300 mt-2">All curriculum tracks in one place, with teacher ownership where assigned.</p>
      </div>

      {student?.role === 'admin' && (
        <div className="max-w-6xl mx-auto rounded-2xl border border-amber-400/25 bg-[#0d1c32]/65 p-5">
          <p className="text-xs uppercase tracking-widest text-amber-300 font-black mb-3">Admin controls</p>
          <div className="flex gap-2">
            <input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Add curriculum track"
              className="flex-1 rounded-lg border border-slate-600 bg-slate-900/70 px-3 py-2 text-sm text-white"
            />
            <button type="button" onClick={addItem} className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold">
              Add
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((item, idx) => {
          const teacher = teachers.find((t) => t.id === item.teacherId);
          return (
            <div key={item.id} className="rounded-2xl border border-amber-400/20 bg-[#0d1c32]/60 p-5">
              <p className="text-[10px] uppercase tracking-widest text-cyan-300 font-black mb-2">Track {String(idx + 1).padStart(2, '0')}</p>
              <h3 className="text-xl font-bold text-white leading-tight">{item.name}</h3>
              <p className="text-sm text-slate-300 mt-2">Teacher: {teacher?.name || 'Not assigned yet'}</p>
              {student?.role === 'admin' && (
                <div className="mt-4 space-y-2">
                  <select
                    value={item.teacherId ?? ''}
                    onChange={(e) => setTeacher(item.id, e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Assign teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {!item.id.startsWith('default-') && (
                    <button type="button" onClick={() => removeItem(item.id)} className="text-xs font-black uppercase text-rose-300">
                      Remove track
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};


const RocketChatPanel = ({ onBack }: { onBack: () => void }) => {
  const [messages, setMessages] = useState<Array<{ from: 'user' | 'bot'; text: string }>>([
    { from: 'bot', text: "Hi commander! I'm STEMbot. Ask me about missions, robotics, AI, math, or science." },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setChatError(null);
    setSending(true);
    setInput('');
    const history = messages
      .filter((m) => m.text.trim())
      .slice(-18)
      .map((m) => ({
        role: m.from === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));
    setMessages((prev) => [...prev, { from: 'user', text }]);
    try {
      const res = await authFetch('/api/chat/stembot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg =
          data.error || data.message || (res.status === 401 ? 'Please sign in again to chat.' : 'Could not reach STEMbot.');
        setChatError(errMsg);
        setMessages((prev) => [...prev, { from: 'bot', text: stembotFallbackReply(text) }]);
        return;
      }
      const reply = String(data.reply || '').trim() || stembotFallbackReply(text);
      setMessages((prev) => [...prev, { from: 'bot', text: reply }]);
      if (data.source === 'fallback' && data.message) {
        setChatError(String(data.message));
      }
    } catch {
      setChatError('Network error — using offline tips.');
      setMessages((prev) => [...prev, { from: 'bot', text: stembotFallbackReply(text) }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0d1c32]/70 border border-amber-400/30 text-amber-300">
          <ArrowLeft className="size-4" />
          Back to Galaxy
        </button>
        <div className="rounded-3xl border border-amber-400/25 bg-gradient-to-br from-[#081325]/95 via-[#0f223d]/90 to-[#0d1830]/95 p-5 sm:p-6">
          <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
            <Rocket className="size-6 text-amber-400" />
            STEMbot — Rocket Chat
          </h2>
          <p className="text-sm text-slate-400 mt-1">Powered by your teacher&apos;s AI settings when configured.</p>
          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-4 h-[52vh] overflow-y-auto space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[85%] px-4 py-2 rounded-xl text-sm ${m.from === 'user' ? 'ml-auto bg-cyan-500/20 text-cyan-100 border border-cyan-400/40' : 'bg-[#0d1c32] text-slate-100 border border-amber-400/25'}`}>
                {m.text}
              </div>
            ))}
            {sending && (
              <div className="max-w-[85%] px-4 py-2 rounded-xl text-sm bg-[#0d1c32] text-amber-200/80 border border-amber-400/25 animate-pulse">
                STEMbot is thinking…
              </div>
            )}
          </div>
          {chatError && (
            <p className="mt-2 text-xs text-amber-300/90">{chatError}</p>
          )}
          <div className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !sending && void send()}
              placeholder="Ask a question..."
              disabled={sending}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-white disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending}
              className="px-5 py-3 rounded-xl bg-amber-500 text-slate-950 font-black disabled:opacity-60"
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Vertical nebula journey: completed/active/locked mission nodes on a winding path. */
const JourneyMap = ({
  missions,
  completedMissionIds = [],
  onSelectMission,
  allUnlocked = false
}: {
  missions: Mission[];
  completedMissionIds?: string[];
  onSelectMission: (m: Mission) => void;
  allUnlocked?: boolean;
}) => {
  if (missions.length === 0) return null;
  const isUnlocked = (index: number) =>
    allUnlocked || index === 0 || completedMissionIds.includes(missions[index - 1].id);
  const isCompleted = (m: Mission) => completedMissionIds.includes(m.id);
  const activeMission = missions.find((m, i) => isUnlocked(i) && !isCompleted(m)) ?? missions[0];
  const totalHeight = Math.max(880, missions.length * 250);
  const nodeOffsets = [80, -64, 0, 94, -48, 24, -88, 52];
  const nodePoints = missions.map((_, i) => ({
    x: 200 + nodeOffsets[i % nodeOffsets.length],
    y: 120 + i * 235,
  }));
  const pathD = nodePoints.length
    ? `M ${nodePoints
        .map((p, i) =>
          i === 0
            ? `${p.x} ${p.y}`
            : `C ${p.x + (i % 2 === 0 ? -120 : 120)} ${p.y - 70}, ${p.x + (i % 2 === 0 ? 120 : -120)} ${p.y - 140}, ${p.x} ${p.y}`
        )
        .join(" ")}`
    : "";

  return (
    <>
    <div className="md:hidden space-y-4 px-1 max-w-lg mx-auto pb-10">
      <div className="rounded-2xl border border-amber-500/25 bg-slate-900/80 p-4 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 mb-1">Mission path</p>
        <p className="text-sm text-slate-300">
          {completedMissionIds.length}/{missions.length} complete · tap the next unlocked node to launch
        </p>
      </div>
      {missions.map((mission, index) => {
        const unlocked = isUnlocked(index);
        const completed = isCompleted(mission);
        const active = unlocked && !completed;
        return (
          <motion.div
            key={mission.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1, duration: 0.25, ease: 'easeOut' }}
            className={`rounded-2xl border p-4 flex gap-4 items-start ${
              completed
                ? 'border-amber-500/40 bg-amber-500/10'
                : active
                  ? 'border-amber-500 bg-slate-900/90 shadow-[0_0_24px_rgba(245,158,11,0.25)]'
                  : 'border-slate-700 bg-slate-900/50 opacity-70'
            }`}
          >
            <div className="shrink-0 pt-0.5">
              {completed ? (
                <AnimatedCheckmark className="size-8 text-amber-400" />
              ) : active ? (
                <Rocket className="size-8 text-amber-500" aria-hidden />
              ) : (
                <Lock className="size-8 text-slate-500" aria-hidden />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Mission {index + 1}</p>
              <h4 className="text-base font-bold text-white leading-snug mt-0.5">{mission.title}</h4>
              {mission.description && (
                <p className="text-xs text-slate-400 mt-1 line-clamp-3">{mission.description}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-3 text-[11px] text-slate-400">
                <span className="rounded-md bg-slate-800 px-2 py-1">+{mission.xp_reward} XP</span>
                {mission.difficulty && (
                  <span className="rounded-md bg-slate-800 px-2 py-1 uppercase">{mission.difficulty}</span>
                )}
              </div>
              <button
                type="button"
                disabled={!unlocked}
                onClick={() => unlocked && onSelectMission(mission)}
                className="mt-4 w-full min-h-[48px] rounded-xl bg-amber-500 text-slate-950 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
              >
                {completed ? 'Review (replay)' : active ? 'Begin mission' : 'Locked'}
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>

    <div className="hidden md:block relative w-full min-h-[900px]">
      <svg
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-full pointer-events-none z-0"
        viewBox={`0 0 400 ${totalHeight}`}
        preserveAspectRatio="none"
      >
        <path
          d={pathD}
          stroke="rgba(251, 191, 36, 0.25)"
          strokeWidth="8"
          strokeDasharray="20 15"
          fill="none"
          strokeLinecap="round"
        />
      </svg>

      <div className="relative z-10">
        {missions.map((mission, index) => {
          const unlocked = isUnlocked(index);
          const completed = isCompleted(mission);
          const active = unlocked && !completed;
          const p = nodePoints[index];
          const label = mission.title.toUpperCase().slice(0, 26);
          return (
            <motion.div
              key={mission.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.25, ease: 'easeOut' }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: p.x, top: p.y }}
            >
              <motion.button
                type="button"
                onClick={() => unlocked && onSelectMission(mission)}
                disabled={!unlocked}
                whileHover={unlocked ? { scale: 1.06 } : {}}
                whileTap={unlocked ? { scale: 0.97 } : {}}
                className={`relative flex items-center justify-center rounded-full border-4 transition-all ${
                  completed
                    ? "size-20 bg-amber-500 border-amber-200/30 shadow-[0_0_30px_rgba(245,158,11,0.5)]"
                    : active
                      ? "size-24 bg-slate-900 border-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.6)]"
                      : "size-20 bg-slate-800 border-slate-700 opacity-60"
                }`}
              >
                {completed ? (
                  <AnimatedCheckmark className="size-10 text-slate-950" />
                ) : active ? (
                  <Rocket className="size-11 text-amber-500" />
                ) : (
                  <Lock className="size-10 text-slate-500" />
                )}
              </motion.button>
              <div
                className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded border text-[10px] font-black uppercase tracking-[0.14em] ${
                  active
                    ? "bg-amber-500 text-slate-950 border-amber-400 -bottom-12 rounded-full px-4 py-1.5"
                    : completed
                      ? "bg-slate-900/80 text-amber-500 border-amber-500/30 -bottom-10"
                      : "bg-slate-950/50 text-slate-500 border-slate-800 -bottom-10"
                }`}
              >
                {active ? `Active: ${label}` : label}
              </div>
            </motion.div>
          );
        })}
      </div>

      <aside className="hidden xl:block absolute right-0 top-8 w-80">
        <div className="ca-glass-hud p-6 rounded-xl border border-amber-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="text-amber-500 text-[10px] font-bold tracking-widest uppercase mb-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Incoming Briefing
          </div>
          <h3 className="text-xl font-semibold text-white leading-tight">{activeMission.title}</h3>
          <p className="text-slate-400 text-sm mt-3 leading-relaxed line-clamp-4">
            {activeMission.description || "Analyze the sector data, complete mission objectives, and unlock the next celestial checkpoint."}
          </p>
          <div className="space-y-4 my-6">
            <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Mission Reward</span>
              <span className="text-amber-500 font-bold">+{activeMission.xp_reward} XP</span>
            </div>
            <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Difficulty</span>
              <span className="text-amber-400 text-xs font-black uppercase">{activeMission.difficulty || "Normal"}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectMission(activeMission)}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-4 rounded-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span className="uppercase text-xs tracking-widest">Begin Mission</span>
            <ChevronRight className="size-4" />
          </button>
          <div className="mt-6 pt-6 border-t border-slate-800/50">
            <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              <span>Sector Progress</span>
              <span>{Math.round((completedMissionIds.length / missions.length) * 100)}%</span>
            </div>
            <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--ca-tertiary-container)] to-amber-500"
                style={{ width: `${Math.round((completedMissionIds.length / missions.length) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
    </>
  );
};

const SectorView = ({ sector, onBack, onPlayMission, allUnlocked = false }: { sector: Sector, onBack: () => void, onPlayMission: (m: Mission) => void, key?: string, allUnlocked?: boolean }) => {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [completedMissionIds, setCompletedMissionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMissions = useCallback(() => {
    safeFetch(`/api/sectors/${sector.id}/missions`)
      .then((data) => {
        if (data && Array.isArray(data.missions)) setMissions(data.missions);
        else setMissions([]);
        setCompletedMissionIds(Array.isArray((data as any)?.completedMissionIds) ? (data as any).completedMissionIds : []);
      })
      .finally(() => setLoading(false));
  }, [sector.id]);

  useEffect(() => {
    setLoading(true);
    loadMissions();
  }, [loadMissions]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      loadMissions();
    }, 25000);
    const onVis = () => {
      if (!document.hidden) loadMissions();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [loadMissions]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(15,23,42,0.95),rgba(2,6,23,1))]" />
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.6)_1px,transparent_1px)] [background-size:40px_40px]" />
      <div className="relative z-10 p-6 sm:p-8 lg:p-10 min-h-[820px]">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <button
            type="button"
            onClick={onBack}
            className="group flex items-center gap-3 text-slate-400 hover:text-amber-400 transition-all min-h-[44px] pr-2 -ml-1"
          >
            <div className="size-11 sm:size-10 rounded-full border border-slate-700 flex items-center justify-center group-hover:border-amber-500/40 group-hover:bg-slate-900/70">
              <ArrowLeft className="size-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Exit Sector</span>
          </button>
          <div className="flex items-center gap-4 bg-slate-900/70 border border-slate-800 px-5 py-2.5 rounded-2xl">
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sector Status</p>
              <p className="text-xs font-black text-amber-500 uppercase">Operational</p>
            </div>
            <div className="size-2 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
          </div>
        </div>

        <div className="mb-8 rounded-2xl overflow-hidden border border-slate-700/50 bg-slate-900/35">
          <div className="relative min-h-[220px] sm:min-h-[260px]">
            <img
              src={sector.image_url}
              alt={sector.name}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-25"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/65 to-slate-950/40" />
            <div className="relative z-10 p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                  Sector {sector.id.toString().padStart(2, '0')}
                </span>
                <span className="text-slate-400 text-xs">Deep Space Explorer</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">{sector.name}</h1>
              <p className="text-slate-300 text-sm sm:text-base mt-3 max-w-3xl">{sector.description}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <p className="text-slate-400 font-medium">Loading mission corridor...</p>
          </div>
        ) : missions.length === 0 ? (
          <div className="ca-glass-hud rounded-2xl p-10 text-center border border-slate-800">
            <Play className="size-12 text-amber-500/70 mx-auto mb-4" />
            <p className="text-slate-200 font-medium mb-1">No legacy missions in this corridor</p>
            <p className="text-slate-400 text-sm">Your teacher may publish a learning path (journey) for this sector instead.</p>
          </div>
        ) : (
          <JourneyMap
            missions={missions}
            completedMissionIds={completedMissionIds}
            onSelectMission={onPlayMission}
            allUnlocked={allUnlocked}
          />
        )}
      </div>
    </motion.div>
  );
};


/** Student sector entry: prefer deployed journey; fall back to legacy corridor. */
function StudentSectorContent({
  student,
  sector,
  onBack,
  onPlayMission,
  onOpenMissionById,
  onOpenChallenge,
  onOpenQuiz,
}: {
  student: Student;
  sector: Sector;
  onBack: () => void;
  onPlayMission: (m: Mission) => void;
  onOpenMissionById: (missionId: string) => void;
  onOpenChallenge: (challengeId: string) => void;
  onOpenQuiz?: (quizId: string) => void;
}) {
  const hasJourney = Boolean(sector.has_deployed_journey);
  const [legacyState, setLegacyState] = useState<'loading' | 'has' | 'empty'>(
    hasJourney ? 'has' : 'loading',
  );

  useEffect(() => {
    if (hasJourney) return;
    let cancelled = false;
    setLegacyState('loading');
    safeFetch(`/api/sectors/${sector.id}/missions`)
      .then((data) => {
        if (cancelled) return;
        const missions = Array.isArray(data?.missions) ? data.missions : [];
        setLegacyState(missions.length > 0 ? 'has' : 'empty');
      })
      .catch(() => {
        if (!cancelled) setLegacyState('empty');
      });
    return () => {
      cancelled = true;
    };
  }, [sector.id, hasJourney]);

  if (hasJourney) {
    return (
      <JourneyView
        student={student}
        sector={sector}
        onOpenMission={onOpenMissionById}
        onOpenChallenge={onOpenChallenge}
        onOpenQuiz={onOpenQuiz}
      />
    );
  }

  if (legacyState === 'loading') {
    return (
      <div className="py-20 text-center text-slate-400">
        <p className="font-medium">Loading sector content…</p>
      </div>
    );
  }

  if (legacyState === 'has') {
    return (
      <SectorView
        sector={sector}
        onBack={onBack}
        onPlayMission={onPlayMission}
      />
    );
  }

  return (
    <div className="ca-glass-hud rounded-2xl p-10 text-center border border-slate-800 max-w-lg mx-auto">
      <AlertTriangle className="size-12 text-amber-500/70 mx-auto mb-4" />
      <p className="text-slate-200 font-medium mb-1">No content deployed to this sector yet.</p>
      <p className="text-slate-400 text-sm">Ask your teacher.</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 text-sm font-bold text-teal-300 hover:text-teal-200"
      >
        ← Back to Galaxy
      </button>
    </div>
  );
}

export { GalaxyMap, CoreCurriculumHub, RocketChatPanel, JourneyMap, SectorView, StudentSectorContent };
