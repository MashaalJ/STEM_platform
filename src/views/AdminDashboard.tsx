/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Rocket, Users, School, Activity, Award, Plus, BarChart3, PieChart, ClipboardList, Zap, X, ChevronDown, Copy, Sparkles, Download, LogIn, Layers, LayoutGrid, AlertTriangle, KeyRound, ShieldCheck, Share2, Printer, CheckCircle2, TrendingUp, ChevronRight, Terminal, LayoutDashboard, Database, Shield, ArrowLeft, Play, Search, Bell, Flame, Lock, User, Settings, Map as MapIcon, Trophy, ChevronLeft,
} from 'lucide-react';
import { safeFetch, fetchWithAuth } from '../app/api';
import CurriculumEditor from '../components/curriculum/CurriculumEditor';
import ContentManager from '../components/admin/ContentManager';
import AdminSchoolsPanel from '../components/admin/AdminSchoolsPanel';
import type { Student, AdminMetricsPayload, AdminQuizRow, AdminChallengeRow, SystemLog, Sector, Mission, Class } from '../app/types';
const SUBSCRIPTION_STATUSES = ['none', 'free', 'trial', 'active', 'past_due', 'canceled'] as const;
const BILLING_PROVIDERS = ['none', 'manual', 'stripe'] as const;

const slidePanelMotion = {
  initial: { x: '100%' as const },
  animate: { x: 0 },
  exit: { x: '100%' as const },
  transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
};

const AdminBillingModal = ({
  user,
  onClose,
  onSaved,
}: {
  user: Student;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [draft, setDraft] = useState({
    subscription_status: (user.subscription_status || 'free').toLowerCase(),
    subscription_plan: user.subscription_plan || 'free',
    billing_provider: (user.billing_provider || 'none').toLowerCase(),
    mrr_cents: user.mrr_cents ?? 0,
    ltv_cents: user.ltv_cents ?? 0,
    gender: user.gender || '',
    country_code: user.country_code || '',
    region: user.region || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDraft({
      subscription_status: (user.subscription_status || 'free').toLowerCase(),
      subscription_plan: user.subscription_plan || 'free',
      billing_provider: (user.billing_provider || 'none').toLowerCase(),
      mrr_cents: user.mrr_cents ?? 0,
      ltv_cents: user.ltv_cents ?? 0,
      gender: user.gender || '',
      country_code: user.country_code || '',
      region: user.region || '',
    });
    setErr(null);
  }, [user.id]);

  const save = async () => {
    setErr(null);
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/admin/students/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription_status: draft.subscription_status,
          subscription_plan: draft.subscription_plan,
          billing_provider: draft.billing_provider,
          mrr_cents: draft.mrr_cents,
          ltv_cents: draft.ltv_cents,
          gender: draft.gender.trim() || null,
          country_code: draft.country_code.trim() || null,
          region: draft.region.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(String(data.message || 'Save failed'));
        return;
      }
      onSaved();
      onClose();
    } catch {
      setErr('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={() => !saving && onClose()} />
      <motion.div
        {...slidePanelMotion}
        className="relative bg-white h-full w-full max-w-lg shadow-2xl border-l border-slate-200 p-6 overflow-y-auto"
      >
        <h3 className="font-bold text-lg text-[#0D1C32] mb-1">Account & billing</h3>
        <p className="text-sm text-slate-500 mb-4">{user.name} · ID {user.id}</p>
        {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="text-slate-600">Subscription status</span>
            <select
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
              value={draft.subscription_status}
              onChange={(e) => setDraft((d) => ({ ...d, subscription_status: e.target.value }))}
            >
              {SUBSCRIPTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-slate-600">Plan label</span>
            <input
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
              value={draft.subscription_plan}
              onChange={(e) => setDraft((d) => ({ ...d, subscription_plan: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-slate-600">Billing provider</span>
            <select
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
              value={draft.billing_provider}
              onChange={(e) => setDraft((d) => ({ ...d, billing_provider: e.target.value }))}
            >
              {BILLING_PROVIDERS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-slate-600">MRR (cents)</span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
              value={draft.mrr_cents}
              onChange={(e) => setDraft((d) => ({ ...d, mrr_cents: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
            />
          </label>
          <label className="block">
            <span className="text-slate-600">LTV (cents)</span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
              value={draft.ltv_cents}
              onChange={(e) => setDraft((d) => ({ ...d, ltv_cents: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
            />
          </label>
          <label className="block">
            <span className="text-slate-600">Gender (optional)</span>
            <input
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="female, male, non_binary, prefer_not_say, other"
              value={draft.gender}
              onChange={(e) => setDraft((d) => ({ ...d, gender: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-slate-600">Country code (ISO2)</span>
            <input
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="US"
              maxLength={2}
              value={draft.country_code}
              onChange={(e) => setDraft((d) => ({ ...d, country_code: e.target.value.toUpperCase() }))}
            />
          </label>
          <label className="block">
            <span className="text-slate-600">Region</span>
            <input
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
              value={draft.region}
              onChange={(e) => setDraft((d) => ({ ...d, region: e.target.value }))}
            />
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="flex-1 py-2 rounded-lg bg-amber-500 text-slate-900 font-bold"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};


const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'business' | 'clusters' | 'users' | 'content' | 'growth'>('overview');
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [challenges, setChallenges] = useState<AdminChallengeRow[]>([]);
  const [quizzes, setQuizzes] = useState<AdminQuizRow[]>([]);
  const [adminMetrics, setAdminMetrics] = useState<AdminMetricsPayload | null>(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [billingUser, setBillingUser] = useState<Student | null>(null);

  const refreshData = () => {
    safeFetch('/api/logs').then((data) => setLogs(Array.isArray(data) ? data : []));
    safeFetch('/api/students').then((data) => setStudents(Array.isArray(data) ? data : []));
    safeFetch('/api/sectors').then((data) => setSectors(Array.isArray(data) ? data : []));
    safeFetch('/api/missions').then((data) => setMissions(Array.isArray(data) ? data : []));
    safeFetch('/api/classes').then((data) => setClasses(Array.isArray(data) ? data : []));
    safeFetch('/api/challenges').then((data) => setChallenges(Array.isArray(data) ? data : []));
    safeFetch('/api/quizzes').then((data) => setQuizzes(Array.isArray(data) ? data : []));
    safeFetch('/api/admin/metrics').then((data) => {
      if (data && typeof data === 'object' && Array.isArray((data as AdminMetricsPayload).byRole)) {
        setAdminMetrics(data as AdminMetricsPayload);
      }
    });
  };

  useEffect(() => {
    refreshData();
  }, []);

  const showNotice = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 2000);
  };

  const studentsOnly = useMemo(() => students.filter((u) => u.role === 'student'), [students]);
  const teachersOnly = useMemo(() => students.filter((u) => u.role === 'teacher'), [students]);
  const adminsOnly = useMemo(() => students.filter((u) => u.role === 'admin'), [students]);
  const totalXP = useMemo(() => students.reduce((sum, u) => sum + (u.xp || 0), 0), [students]);
  const studentTotalXP = useMemo(() => studentsOnly.reduce((sum, u) => sum + (u.xp || 0), 0), [studentsOnly]);
  const avgStudentXP = useMemo(
    () => (studentsOnly.length ? Math.round(studentTotalXP / studentsOnly.length) : 0),
    [studentsOnly.length, studentTotalXP]
  );
  const classAggregates = useMemo(() => {
    const enrolled = classes.reduce((sum, c) => sum + (c.student_count ?? 0), 0);
    const teacherIds = new Set(classes.map((c) => c.teacher_id));
    return { enrolled, uniqueTeachers: teacherIds.size };
  }, [classes]);
  const missionsWithEmbed = useMemo(() => missions.filter((m) => (m.embed_code || '').trim().length > 0).length, [missions]);
  const recentLogs = useMemo(
    () =>
      [...logs]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 8),
    [logs]
  );
  const sectorMissionStats = useMemo(
    () =>
      sectors
        .map((s) => ({
          sector: s,
          missionCount: missions.filter((m) => m.sector_id === s.id).length,
        }))
        .sort((a, b) => b.missionCount - a.missionCount),
    [sectors, missions]
  );
  const logsByDay = useMemo(() => {
    const map = new Map<string, number>();
    logs.forEach((log) => {
      const day = new Date(log.timestamp).toLocaleDateString();
      map.set(day, (map.get(day) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime())
      .slice(-10);
  }, [logs]);
  const maxLogCount = Math.max(1, ...logsByDay.map((d) => d.count));
  const searchedUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((u) => u.name.toLowerCase().includes(q) || String(u.id).includes(q) || (u.email || '').toLowerCase().includes(q));
  }, [students, search]);

  const copyAdminReport = async () => {
    const m = adminMetrics;
    const lines = [
      `STEMVERSE — Galactic Oversight report`,
      `Generated: ${new Date().toISOString()}`,
      '',
      `Users: ${students.length} total (students ${studentsOnly.length}, teachers ${teachersOnly.length}, admins ${adminsOnly.length})`,
      `Avg student XP: ${avgStudentXP.toLocaleString()} · Total XP (all roles): ${totalXP.toLocaleString()}`,
      `Classes: ${classes.length} · Rollup enrollment: ${classAggregates.enrolled} · Teachers with classes: ${classAggregates.uniqueTeachers}`,
      `Content: sectors ${sectors.length}, missions ${missions.length} (${missionsWithEmbed} with embed), quizzes ${quizzes.length}, challenges ${challenges.length}`,
      `System logs (loaded): ${logs.length}`,
    ];
    if (m) {
      const topCountries = m.byCountry
        .filter((c) => c.country_code !== 'unspecified')
        .slice(0, 5)
        .map((c) => `${c.country_code}:${c.n}`)
        .join(', ');
      lines.push(
        '',
        `Monetization: MRR $${(m.monetization.mrrCents / 100).toFixed(2)} · ARPU $${(m.monetization.arpuCents / 100).toFixed(2)} · paying ${m.monetization.payingUsers} · trial ${m.monetization.trialUsers} · past_due ${m.monetization.pastDueUsers} · free/unpaid ${m.monetization.freeOrUnpaidUsers} · LTV sum $${(m.monetization.ltvSumCents / 100).toFixed(2)}`,
        `Product OKRs: activation ${m.product.activationRatePct}% · DAU ${m.product.dau} · WAU ${m.product.wau} · MAU ${m.product.mau} · weekly returning share ${m.product.weeklyReturningSharePct}%`,
        `Content depth: avg missions/class ${m.product.avgMissionsPerClass} · quizzes/class ${m.product.avgQuizzesPerClass} · challenges/class ${m.product.avgChallengesPerClass}`,
        topCountries ? `Top countries: ${topCountries}` : '',
        m.byPlan?.length
          ? `Plans: ${m.byPlan.map((p) => `${p.subscription_plan}:${p.n}`).join(', ')}`
          : '',
      );
    }
    lines.push(
      '',
      `Recent log sample:`,
      ...recentLogs.slice(0, 5).map((l) => `  ${l.timestamp} — ${l.message}`),
    );
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showNotice('Report copied to clipboard.');
    } catch {
      showNotice('Could not copy — check browser permissions.');
    }
  };

  const tabs = [
    { id: 'overview' as const, label: 'Global Analytics', icon: LayoutDashboard },
    { id: 'business' as const, label: 'Business & OKRs', icon: PieChart },
    { id: 'clusters' as const, label: 'Schools', icon: School },
    { id: 'users' as const, label: 'User Management', icon: Users },
    { id: 'content' as const, label: 'Content Oversight', icon: Shield },
    { id: 'growth' as const, label: 'Growth', icon: TrendingUp },
  ];

  const signupsLast7 = useMemo(() => {
    if (!adminMetrics?.signupsLast30Days?.length) return 0;
    const cutoff = Date.now() - 7 * 86400000;
    return adminMetrics.signupsLast30Days.reduce((sum, row) => {
      const t = new Date(row.day).getTime();
      return sum + (t >= cutoff ? row.n : 0);
    }, 0);
  }, [adminMetrics?.signupsLast30Days]);

  return (
    <div className="space-y-8 pb-20">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">Galactic Oversight</h2>
          <p className="text-slate-400 text-sm">Real-time admin view across users, classes, and learning content.</p>
        </div>
        <div className="flex w-full lg:w-auto flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full sm:w-64 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg pl-9 pr-3 py-2 outline-none focus:border-amber-500"
            />
          </div>
          <button onClick={refreshData} className="w-full sm:w-auto px-4 py-2 bg-amber-500 text-slate-900 rounded-lg font-bold text-sm hover:bg-amber-400">
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex w-max min-w-full gap-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#0A192F] text-amber-400 border-[#0A192F]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400'
              }`}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-700">
          {notice}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Users', value: students.length, icon: Users },
                  { label: 'Teachers', value: teachersOnly.length, icon: School },
                  { label: 'Classes', value: classes.length, icon: LayoutDashboard },
                  { label: 'Total XP', value: totalXP.toLocaleString(), icon: Zap },
                  { label: 'Missions', value: missions.length, icon: MapIcon },
                  { label: 'Quizzes', value: quizzes.length, icon: ClipboardList },
                  { label: 'Challenges', value: challenges.length, icon: Layers },
                  { label: 'System logs', value: logs.length, icon: Activity },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-white p-5 rounded-xl border border-slate-100 shadow-[0_4px_20px_rgba(10,25,47,0.05)]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{kpi.label}</p>
                      <kpi.icon className="size-4 text-amber-500" />
                    </div>
                    <p className="text-2xl font-bold text-[#0D1C32]">{kpi.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-8 bg-[#0A192F] rounded-2xl p-6 border border-slate-800 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-amber-400 text-xl font-semibold">Ecosystem Pulse</h3>
                      <p className="text-slate-400 text-sm">System activity from recent logs</p>
                    </div>
                    <p className="text-white text-2xl font-bold">{logs.length.toLocaleString()} logs</p>
                  </div>
                  <div className="h-48 flex items-end gap-1">
                    {logsByDay.length === 0 ? (
                      <p className="w-full text-center text-slate-500 text-sm self-center">No log activity in the loaded window yet.</p>
                    ) : (
                      logsByDay.map((d) => (
                        <div
                          key={d.day}
                          className="flex-1 bg-slate-700 rounded-t"
                          style={{ height: `${Math.max(10, (d.count / maxLogCount) * 100)}%` }}
                          title={`${d.day}: ${d.count}`}
                        />
                      ))
                    )}
                  </div>
                  {logsByDay.length > 0 && (
                    <div className="mt-3 flex justify-between text-[10px] text-slate-500">
                      <span>{logsByDay[0]?.day || '-'}</span>
                      <span>{logsByDay[logsByDay.length - 1]?.day || '-'}</span>
                    </div>
                  )}
                </div>

                <div className="col-span-12 lg:col-span-4 space-y-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(10,25,47,0.05)]">
                    <h4 className="text-[#0D1C32] font-semibold mb-3">Strategic Alerts</h4>
                    <div className="space-y-3 text-sm">
                      {classes.length === 0 && <p className="text-amber-700">No classes created yet.</p>}
                      {missions.length === 0 && <p className="text-amber-700">No missions available.</p>}
                      {quizzes.length === 0 && <p className="text-amber-700">No quizzes in the library yet.</p>}
                      {challenges.length === 0 && <p className="text-amber-700">No interactive challenges yet.</p>}
                      {sectors.filter((s) => s.status === 'maintenance').length > 0 && (
                        <p className="text-amber-700">{sectors.filter((s) => s.status === 'maintenance').length} sector(s) in maintenance.</p>
                      )}
                      {classes.length > 0 &&
                        missions.length > 0 &&
                        quizzes.length > 0 &&
                        challenges.length > 0 &&
                        sectors.filter((s) => s.status === 'maintenance').length === 0 && (
                        <p className="text-slate-600">No critical alerts right now.</p>
                      )}
                    </div>
                  </div>
                  <div className="bg-[#0A192F] p-5 rounded-2xl border border-slate-800 text-white">
                    <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Average Student XP</p>
                    <p className="text-3xl font-bold text-amber-400">{avgStudentXP.toLocaleString()}</p>
                    <p className="text-slate-400 text-xs mt-2">{studentsOnly.length.toLocaleString()} students tracked</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sectorMissionStats.slice(0, 3).map(({ sector, missionCount }) => (
                  <div key={sector.id} className="bg-white p-5 rounded-xl border border-slate-100 shadow-[0_4px_20px_rgba(10,25,47,0.05)]">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{sector.name}</p>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-600">Missions</span>
                      <span className="font-bold text-[#0D1C32]">{missionCount}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-600">Sector mastery</span>
                      <span className="font-bold text-[#0D1C32]">{sector.mastery_percent}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500" style={{ width: `${Math.min(100, missionCount * 18)}%` }} />
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sky-400 to-sky-600"
                        style={{ width: `${Math.min(100, sector.mastery_percent)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'business' && (
            <div className="space-y-6">
              {!adminMetrics ? (
                <p className="text-slate-500 text-sm">Loading business metrics…</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      {
                        label: 'MRR',
                        value: `$${(adminMetrics.monetization.mrrCents / 100).toFixed(2)}`,
                        icon: PieChart,
                      },
                      {
                        label: 'ARPU (paying)',
                        value: `$${(adminMetrics.monetization.arpuCents / 100).toFixed(2)}`,
                        icon: BarChart3,
                      },
                      {
                        label: 'Paying accounts',
                        value: adminMetrics.monetization.payingUsers,
                        icon: Users,
                      },
                      {
                        label: 'Trials / past due',
                        value: `${adminMetrics.monetization.trialUsers} / ${adminMetrics.monetization.pastDueUsers}`,
                        icon: AlertTriangle,
                      },
                      {
                        label: 'Free / unpaid',
                        value: adminMetrics.monetization.freeOrUnpaidUsers,
                        icon: LayoutGrid,
                      },
                      {
                        label: 'LTV (sum)',
                        value: `$${(adminMetrics.monetization.ltvSumCents / 100).toFixed(2)}`,
                        icon: Trophy,
                      },
                      {
                        label: 'Signups (7d)',
                        value: signupsLast7,
                        icon: TrendingUp,
                      },
                      {
                        label: 'Activation rate',
                        value: `${adminMetrics.product.activationRatePct}%`,
                        icon: Zap,
                      },
                    ].map((kpi) => (
                      <div key={kpi.label} className="bg-white p-5 rounded-xl border border-slate-100 shadow-[0_4px_20px_rgba(10,25,47,0.05)]">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{kpi.label}</p>
                          <kpi.icon className="size-4 text-amber-500" />
                        </div>
                        <p className="text-2xl font-bold text-[#0D1C32]">{kpi.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[0_4px_20px_rgba(10,25,47,0.05)]">
                      <h3 className="text-lg font-semibold text-[#0D1C32] mb-4">Engagement (last_active_at)</h3>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-amber-600">{adminMetrics.product.dau}</p>
                          <p className="text-xs text-slate-500 uppercase">DAU</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-amber-600">{adminMetrics.product.wau}</p>
                          <p className="text-xs text-slate-500 uppercase">WAU</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-amber-600">{adminMetrics.product.mau}</p>
                          <p className="text-xs text-slate-500 uppercase">MAU</p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 mt-4">
                        Returning-active share (weekly):{' '}
                        <span className="font-semibold text-[#0D1C32]">{adminMetrics.product.weeklyReturningSharePct}%</span>
                      </p>
                    </div>
                    <div className="bg-[#0A192F] rounded-2xl border border-slate-800 p-6 text-white">
                      <h3 className="text-lg font-semibold text-amber-400 mb-4">Product depth</h3>
                      <ul className="space-y-2 text-sm text-slate-300">
                        <li className="flex justify-between">
                          <span>Students (role)</span>
                          <span className="font-mono">{adminMetrics.product.studentCount}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Activated (≥1 mission)</span>
                          <span className="font-mono">{adminMetrics.product.activatedStudents}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Avg missions / class</span>
                          <span className="font-mono">{adminMetrics.product.avgMissionsPerClass}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Avg quizzes / class</span>
                          <span className="font-mono">{adminMetrics.product.avgQuizzesPerClass}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Avg challenges / class</span>
                          <span className="font-mono">{adminMetrics.product.avgChallengesPerClass}</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                      <h4 className="font-semibold text-[#0D1C32] mb-3">Subscription status</h4>
                      <ul className="text-sm space-y-1 text-slate-600">
                        {adminMetrics.bySubscriptionStatus.map((r) => (
                          <li key={r.subscription_status} className="flex justify-between">
                            <span className="capitalize">{r.subscription_status}</span>
                            <span className="font-mono">{r.n}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                      <h4 className="font-semibold text-[#0D1C32] mb-3">Plan labels</h4>
                      <ul className="text-sm space-y-1 text-slate-600 max-h-48 overflow-y-auto">
                        {adminMetrics.byPlan.map((r) => (
                          <li key={r.subscription_plan} className="flex justify-between gap-2">
                            <span className="truncate">{r.subscription_plan}</span>
                            <span className="font-mono shrink-0">{r.n}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                      <h4 className="font-semibold text-[#0D1C32] mb-3">Gender (optional)</h4>
                      <ul className="text-sm space-y-1 text-slate-600">
                        {adminMetrics.byGender.map((r) => (
                          <li key={r.gender} className="flex justify-between">
                            <span className="capitalize">{r.gender.replace(/_/g, ' ')}</span>
                            <span className="font-mono">{r.n}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                      <h4 className="font-semibold text-[#0D1C32] mb-3">Top countries</h4>
                      <ul className="text-sm space-y-1 text-slate-600 max-h-48 overflow-y-auto">
                        {adminMetrics.byCountry.map((r) => (
                          <li key={r.country_code} className="flex justify-between gap-2">
                            <span>{r.country_code}</span>
                            <span className="font-mono shrink-0">{r.n}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm lg:col-span-3">
                      <h4 className="font-semibold text-[#0D1C32] mb-3">Top cities (profile)</h4>
                      <ul className="text-sm space-y-1 text-slate-600 max-h-48 overflow-y-auto">
                        {adminMetrics.byCity.map((r) => (
                          <li key={r.city} className="flex justify-between gap-2">
                            <span className="truncate">{r.city}</span>
                            <span className="font-mono shrink-0">{r.n}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                      <h4 className="font-semibold text-[#0D1C32] mb-3">Age buckets</h4>
                      <ul className="text-sm space-y-1 text-slate-600">
                        {adminMetrics.ageBuckets.map((r) => (
                          <li key={r.bucket} className="flex justify-between">
                            <span className="capitalize">{r.bucket.replace(/_/g, ' ')}</span>
                            <span className="font-mono">{r.n}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                      <h4 className="font-semibold text-[#0D1C32] mb-3">Grade distribution</h4>
                      <ul className="text-sm space-y-1 text-slate-600 max-h-48 overflow-y-auto">
                        {adminMetrics.gradeDistribution.map((r) => (
                          <li key={r.grade} className="flex justify-between gap-2">
                            <span className="truncate">{r.grade}</span>
                            <span className="font-mono shrink-0">{r.n}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                      <h4 className="font-semibold text-[#0D1C32] mb-3">Signups (30 days)</h4>
                      <div className="h-40 flex items-end gap-1">
                        {adminMetrics.signupsLast30Days.length === 0 ? (
                          <p className="text-slate-400 text-sm w-full text-center py-8">No signup dates recorded</p>
                        ) : (
                          (() => {
                            const maxN = Math.max(1, ...adminMetrics.signupsLast30Days.map((d) => d.n));
                            return adminMetrics.signupsLast30Days.map((d) => (
                              <div key={d.day} className="flex-1 min-w-0 flex flex-col justify-end" title={`${d.day}: ${d.n}`}>
                                <div
                                  className="w-full bg-amber-500 rounded-t"
                                  style={{ height: `${Math.max(8, (d.n / maxN) * 100)}%` }}
                                />
                              </div>
                            ));
                          })()
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-white to-indigo-50/40 rounded-2xl border border-indigo-100 p-6 shadow-sm">
                    <h4 className="font-semibold text-[#0D1C32] mb-3">Top student interests</h4>
                    {adminMetrics.interestTrends?.length ? (
                      <ul className="text-sm space-y-2 text-[#243b67] max-h-56 overflow-y-auto pr-1">
                        {adminMetrics.interestTrends.map((r, idx) => (
                          <li
                            key={r.interest_key}
                            className="flex items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-white/90 px-3 py-2"
                          >
                            <span className="truncate capitalize font-medium">
                              {idx + 1}. {r.interest_key.replace(/_/g, ' ')}
                            </span>
                            <span className="font-mono shrink-0 rounded-md bg-indigo-100 px-2 py-0.5 text-[#1d2f5f]">
                              {r.n}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-slate-500 text-sm">No student interest data yet.</p>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <h4 className="font-semibold text-[#0D1C32] mb-3">AI usage (14d, by day × endpoint)</h4>
                    <div className="max-h-48 overflow-y-auto text-xs font-mono text-slate-600 space-y-1">
                      {adminMetrics.aiUsageByDay.length === 0 ? (
                        <p className="text-slate-400">No AI usage logs in window</p>
                      ) : (
                        adminMetrics.aiUsageByDay.slice(-24).map((row, i) => (
                          <div key={`${row.day}-${row.endpoint}-${i}`} className="flex justify-between gap-2">
                            <span className="truncate">{row.day}</span>
                            <span className="truncate">{row.endpoint}</span>
                            <span className="shrink-0">
                              {row.ok}/{row.total} ok
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'clusters' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(10,25,47,0.05)] p-6">
              <AdminSchoolsPanel />
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(10,25,47,0.05)] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-[#0D1C32]">User Management</h3>
                <p className="text-sm text-slate-500">{searchedUsers.length} shown</p>
              </div>
              <div className="space-y-3 md:hidden">
                {searchedUsers.map((u) => (
                  <div key={u.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                      <img src={u.avatar_url} alt="" className="size-10 rounded-lg object-cover border border-slate-200" referrerPolicy="no-referrer" />
                      <div className="min-w-0">
                        <p className="font-medium text-[#0D1C32] truncate">{u.name}</p>
                        <p className="text-xs text-slate-500 truncate">{u.email || `ID ${u.id}`}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-slate-500 uppercase tracking-wide">Role</p>
                        <p className="capitalize text-slate-700 font-medium">{u.role}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 uppercase tracking-wide">Status</p>
                        <p className="text-slate-700 font-medium capitalize">{u.subscription_status || 'free'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 uppercase tracking-wide">Plan</p>
                        <p className="text-slate-700 font-medium">{u.subscription_plan || 'free'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 uppercase tracking-wide">Country</p>
                        <p className="text-slate-700 font-medium">{u.country_code || '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 uppercase tracking-wide">XP</p>
                        <p className="text-slate-700 font-medium">{u.xp.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 uppercase tracking-wide">Level</p>
                        <p className="text-slate-700 font-medium">{u.level}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBillingUser(u)}
                      className="mt-3 w-full min-h-[44px] rounded-lg border border-amber-500/50 bg-amber-50 text-amber-900 text-xs font-bold uppercase tracking-wide"
                    >
                      Account &amp; billing
                    </button>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                      <th className="pb-3 pr-2">User</th>
                      <th className="pb-3 pr-2">Role</th>
                      <th className="pb-3 pr-2">Status</th>
                      <th className="pb-3 pr-2">Plan</th>
                      <th className="pb-3 pr-2">Country</th>
                      <th className="pb-3 pr-2">XP</th>
                      <th className="pb-3 pr-2">Level</th>
                      <th className="pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchedUsers.map((u) => (
                      <tr key={u.id} className="border-b border-slate-100">
                        <td className="py-3 pr-2">
                          <div className="flex items-center gap-3">
                            <img src={u.avatar_url} alt="" className="size-8 rounded-lg object-cover border border-slate-200" referrerPolicy="no-referrer" />
                            <div>
                              <p className="font-medium text-[#0D1C32]">{u.name}</p>
                              <p className="text-xs text-slate-500">{u.email || `ID ${u.id}`}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-2 capitalize text-slate-700">{u.role}</td>
                        <td className="py-3 pr-2 capitalize text-slate-700">{u.subscription_status || 'free'}</td>
                        <td className="py-3 pr-2 text-slate-700">{u.subscription_plan || 'free'}</td>
                        <td className="py-3 pr-2 font-mono text-slate-600">{u.country_code || '—'}</td>
                        <td className="py-3 pr-2 font-mono text-slate-700">{u.xp.toLocaleString()}</td>
                        <td className="py-3 pr-2 text-slate-700">{u.level}</td>
                        <td className="py-3">
                          <button
                            type="button"
                            onClick={() => setBillingUser(u)}
                            className="text-xs font-bold uppercase tracking-wide text-amber-700 hover:text-amber-600"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'content' && (
            <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(10,25,47,0.05)] p-6">
                <h3 className="text-xl font-semibold text-[#0D1C32] mb-1">Core preset curriculum</h3>
                <p className="text-sm text-slate-500 mb-6">
                  STEMverse base track used when classes choose <strong>Core STEM</strong>.
                </p>
                <CurriculumEditor
                  mode="default"
                  title="STEMverse Core Curriculum"
                  subtitle="Global baseline preset managed by admins."
                />
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(10,25,47,0.05)] p-6">
                <h3 className="text-xl font-semibold text-[#0D1C32] mb-1">Advanced preset curriculum</h3>
                <p className="text-sm text-slate-500 mb-6">
                  STEMverse advanced track used when classes choose <strong>Advanced</strong>.
                </p>
                <CurriculumEditor
                  mode="advanced"
                  title="STEMverse Advanced Curriculum"
                  subtitle="Global advanced preset managed by admins."
                />
              </div>
            </div>
            <ContentManager sectors={sectors} missions={missions} onRefresh={refreshData} onNotice={showNotice} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(10,25,47,0.05)] p-6">
                <h3 className="text-xl font-semibold text-[#0D1C32] mb-1">Missions overview</h3>
                <p className="text-xs text-slate-500 mb-3">
                  {missionsWithEmbed} with embed · {missions.length} total
                </p>
                <div className="space-y-3 max-h-[20rem] overflow-y-auto pr-1">
                  {missions.filter((m) => m.status !== 'archived').slice(0, 12).map((m) => (
                    <div key={m.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-[#0D1C32] truncate text-sm">{m.title}</p>
                        <span className="text-xs text-amber-700 font-semibold shrink-0">+{m.xp_reward} XP</span>
                      </div>
                    </div>
                  ))}
                  {!missions.length && <p className="text-sm text-slate-500">No missions yet.</p>}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(10,25,47,0.05)] p-6">
                <h3 className="text-xl font-semibold text-[#0D1C32] mb-4">Quizzes</h3>
                <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                  {quizzes.map((q) => (
                    <div key={q.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-[#0D1C32] truncate" title={q.title}>
                          {q.title}
                        </p>
                        {q.created_at && (
                          <span className="text-[10px] text-slate-400 shrink-0">{new Date(q.created_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {!quizzes.length && <p className="text-sm text-slate-500">No quizzes in catalog.</p>}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(10,25,47,0.05)] p-6">
                <h3 className="text-xl font-semibold text-[#0D1C32] mb-4">Challenges</h3>
                <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                  {challenges.map((c) => (
                    <div key={c.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-[#0D1C32] truncate" title={c.title}>
                          {c.title}
                        </p>
                        <span className="text-[10px] uppercase font-semibold text-amber-800 shrink-0">{c.type}</span>
                      </div>
                      {(c.world || c.zone) && (
                        <p className="text-xs text-slate-500 mt-1">
                          {[c.world, c.zone].filter(Boolean).join(' · ')}
                          {typeof c.xp_reward === 'number' ? ` · +${c.xp_reward} XP` : ''}
                        </p>
                      )}
                    </div>
                  ))}
                  {!challenges.length && <p className="text-sm text-slate-500">No challenges yet.</p>}
                </div>
              </div>
            </div>
            </div>
          )}

          {activeTab === 'growth' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#0A192F] rounded-2xl p-6 border border-slate-800 text-white">
                <h3 className="text-xl font-semibold text-amber-400 mb-1">Growth Trend</h3>
                <p className="text-slate-400 text-sm mb-5">Daily activity events from system logs</p>
                <div className="h-56 flex items-end gap-2">
                  {logsByDay.length === 0 ? (
                    <p className="w-full text-center text-slate-500 text-sm py-12">No log activity in the loaded window yet.</p>
                  ) : (
                    logsByDay.map((d) => (
                      <div key={d.day} className="flex-1 min-w-[18px]">
                        <div className="w-full bg-gradient-to-t from-amber-500 to-amber-300 rounded-t" style={{ height: `${Math.max(8, (d.count / maxLogCount) * 100)}%` }} />
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_rgba(10,25,47,0.05)]">
                  <p className="text-xs uppercase text-slate-500 tracking-wider mb-2">Role Mix</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Students</span><span className="font-semibold">{studentsOnly.length}</span></div>
                    <div className="flex justify-between"><span>Teachers</span><span className="font-semibold">{teachersOnly.length}</span></div>
                    <div className="flex justify-between"><span>Admins</span><span className="font-semibold">{adminsOnly.length}</span></div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_rgba(10,25,47,0.05)]">
                  <p className="text-xs uppercase text-slate-500 tracking-wider mb-2">Recent Logs</p>
                  <div className="space-y-2">
                    {recentLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="text-xs text-slate-600">
                        {new Date(log.timestamp).toLocaleTimeString()} - {log.message}
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void copyAdminReport()}
                  className="w-full py-3 bg-amber-500 text-slate-900 rounded-lg font-bold text-sm hover:bg-amber-400"
                >
                  Generate Report
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {billingUser && (
        <AnimatePresence>
          <AdminBillingModal
            user={billingUser}
            onClose={() => setBillingUser(null)}
            onSaved={() => void refreshData()}
          />
        </AnimatePresence>
      )}
    </div>
  );
};


export default AdminDashboard;
