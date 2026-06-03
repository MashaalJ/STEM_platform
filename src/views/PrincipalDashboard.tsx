/**
 * Principal / school_admin dashboard — school-scoped overview.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, BarChart3, Settings,
  Plus, Copy, CheckCircle2, Download, Trash2,
} from 'lucide-react';
import { safeFetch, authFetch, getAccessToken } from '../app/api';
import type { Student } from '../app/types';

type Tab = 'overview' | 'teachers' | 'students' | 'classes' | 'reports' | 'settings';

type StatsPayload = {
  totals: { teachers: number; students: number; classes: number; completions_this_week: number };
  limits?: { max_teachers: number; max_students: number };
  daily_active_students: { day: string; count: number }[];
  teachers: Array<{
    id: string;
    name: string;
    email: string | null;
    class_count: number;
    active_students: number;
    last_active_at: string | null;
    status: string;
    joined_at?: string;
  }>;
};

export default function PrincipalDashboard({ student }: { student: Student }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [school, setSchool] = useState<Record<string, unknown> | null>(null);
  const [students, setStudents] = useState<Record<string, unknown>[]>([]);
  const [classes, setClasses] = useState<Record<string, unknown>[]>([]);
  const [invites, setInvites] = useState<Record<string, unknown>[]>([]);
  const [reports, setReports] = useState<Record<string, unknown> | null>(null);
  const [classFilter, setClassFilter] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [settingsDraft, setSettingsDraft] = useState({ name: '', city: '', country: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classStudents, setClassStudents] = useState<Record<string, unknown>[]>([]);

  const load = useCallback(async () => {
    const [st, sch, inv] = await Promise.all([
      safeFetch('/api/school/stats'),
      safeFetch('/api/school'),
      safeFetch('/api/school/invites'),
    ]);
    if (st) setStats(st as StatsPayload);
    if (sch) {
      setSchool(sch as Record<string, unknown>);
      setSettingsDraft({
        name: String((sch as { name?: string }).name || ''),
        city: String((sch as { city?: string }).city || ''),
        country: String((sch as { country?: string }).country || 'Pakistan'),
      });
    }
    if (Array.isArray(inv)) setInvites(inv);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === 'students' || tab === 'classes') {
      safeFetch('/api/school/classes').then((d) => setClasses(Array.isArray(d) ? d : []));
    }
    if (tab === 'students') {
      const q = classFilter ? `?class_id=${classFilter}` : '';
      safeFetch(`/api/school/students${q}`).then((d) => setStudents(Array.isArray(d) ? d : []));
    }
    if (tab === 'reports') {
      safeFetch('/api/school/reports').then((d) => setReports(d as Record<string, unknown>));
    }
  }, [tab, classFilter]);

  useEffect(() => {
    if (selectedClassId) {
      safeFetch(`/api/school/classes/${selectedClassId}/students`).then((d) =>
        setClassStudents(Array.isArray(d) ? d : []),
      );
    } else {
      setClassStudents([]);
    }
  }, [selectedClassId]);

  const maxDaily = useMemo(
    () => Math.max(1, ...(stats?.daily_active_students || []).map((d) => d.count)),
    [stats],
  );

  const UsageBar = ({
    label,
    current,
    max,
  }: {
    label: string;
    current: number;
    max: number;
  }) => {
    const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
    const barColor =
      current >= max ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-teal-500';
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex justify-between text-sm font-semibold text-slate-800 mb-2">
          <span>{label}</span>
          <span className="tabular-nums">
            {current} / {max}
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Copied to clipboard.');
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage('Could not copy.');
    }
  };

  const inviteTeacher = async () => {
    const res = await fetchWithAuth('/api/school/invite-teacher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || 'Could not create invite');
      return;
    }
    setInviteEmail('');
    setMessage(`Invite created: ${data.invite?.code || ''}`);
    void load();
  };

  const removeTeacher = async (id: string) => {
    if (!confirm('Remove this teacher from your school? Their classes will be unassigned.')) return;
    await authFetch(`/api/school/teachers/${id}`, { method: 'DELETE' });
    void load();
  };

  const saveSettings = async () => {
    const res = await authFetch('/api/school', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsDraft),
    });
    if (res.ok) {
      setMessage('School settings saved.');
      void load();
    }
  };

  const exportStudentsCsv = () => {
    const header = 'username,name,level,xp,last_active,class\n';
    const rows = students.map((s) =>
      [
        s.username || '',
        `"${String(s.name || '').replace(/"/g, '""')}"`,
        s.level ?? 0,
        s.xp ?? 0,
        s.last_active_at || '',
        (s as { class_name?: string }).class_name || '',
      ].join(','),
    );
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'school_students.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const nav: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="size-4" /> },
    { id: 'teachers', label: 'Teachers', icon: <Users className="size-4" /> },
    { id: 'students', label: 'Students', icon: <GraduationCap className="size-4" /> },
    { id: 'classes', label: 'Classes', icon: <BookOpen className="size-4" /> },
    { id: 'reports', label: 'Reports', icon: <BarChart3 className="size-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="size-4" /> },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[70vh]">
      <aside className="lg:w-56 shrink-0 rounded-xl border border-slate-200 bg-white p-3 h-fit">
        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700 px-2 mb-2">School</p>
        <p className="text-sm font-bold text-slate-900 px-2 mb-4 truncate">{student.school_record_name || school?.name || 'Your school'}</p>
        <nav className="space-y-1">
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setTab(n.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${
                tab === n.id ? 'bg-indigo-700 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {n.icon}
              {n.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 min-w-0 space-y-4">
        {message && (
          <p className="text-sm text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">{message}</p>
        )}

        {tab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Teachers', value: stats.totals.teachers },
                { label: 'Students', value: stats.totals.students },
                { label: 'Active classes', value: stats.totals.classes },
                { label: 'Completions (7d)', value: stats.totals.completions_this_week },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] uppercase text-slate-500 font-bold">{c.label}</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{c.value}</p>
                </div>
              ))}
            </div>
            {stats.limits && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <UsageBar
                  label="Teachers"
                  current={stats.totals.teachers}
                  max={stats.limits.max_teachers}
                />
                <UsageBar
                  label="Students"
                  current={stats.totals.students}
                  max={stats.limits.max_students}
                />
              </div>
            )}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-bold text-slate-800 mb-3">Daily active students (30 days)</p>
              <div className="flex items-end gap-1 h-32">
                {stats.daily_active_students.map((d) => (
                  <div
                    key={d.day}
                    title={`${d.day}: ${d.count}`}
                    className="flex-1 bg-teal-500/80 rounded-t min-w-[4px]"
                    style={{ height: `${Math.max(4, (d.count / maxDaily) * 100)}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-slate-500 border-b">
                    <th className="p-3">Teacher</th>
                    <th className="p-3">Classes</th>
                    <th className="p-3">Students</th>
                    <th className="p-3">Last active</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.teachers.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100">
                      <td className="p-3 font-medium">{t.name}</td>
                      <td className="p-3">{t.class_count}</td>
                      <td className="p-3">{t.active_students}</td>
                      <td className="p-3 text-slate-500 text-xs">
                        {t.last_active_at ? new Date(t.last_active_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            t.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'teachers' && (
          <div className="space-y-4">
            {(school?.teacher_join_code as string) && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <p className="text-xs font-bold uppercase text-indigo-900 mb-1">Shared teacher code (all teachers)</p>
                <p className="text-sm text-indigo-950 mb-3">
                  Every teacher at your school can use this same code when they sign up or sign in. You do not need a new
                  code for each teacher unless you want a one-time invite below.
                </p>
                <div className="inline-flex items-center gap-2 rounded-lg bg-white border border-indigo-200 px-3 py-2 font-mono text-lg tracking-widest">
                  {String(school.teacher_join_code)}
                  <button
                    type="button"
                    onClick={() => void copyText(String(school.teacher_join_code))}
                    aria-label="Copy shared teacher code"
                  >
                    <Copy className="size-4 text-indigo-700" />
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 items-end">
              <label className="text-sm min-w-[200px]">
                <span className="block font-semibold text-slate-700 mb-1">Teacher email (optional)</span>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  type="email"
                  placeholder="instructor@school.edu"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => void inviteTeacher()}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-700 px-4 py-2 text-xs font-bold text-white"
              >
                <Plus className="size-4" />
                Invite teacher
              </button>
            </div>
            <p className="text-xs text-slate-600">
              <strong>Invite teacher</strong> creates an extra one-time code (for one teacher only). Prefer the shared
              code above for multiple teachers.
            </p>
            {invites.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-bold uppercase text-amber-900 mb-2">One-time invites (single teacher each)</p>
                <div className="flex flex-wrap gap-2">
                  {invites.map((inv) => (
                    <span
                      key={String(inv.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-white border px-2 py-1 text-sm font-mono"
                    >
                      {String(inv.code)}
                      <button type="button" onClick={() => void copyText(String(inv.code))} aria-label="Copy">
                        <Copy className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-slate-500 border-b">
                    <th className="p-3">Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Classes</th>
                    <th className="p-3">Students</th>
                    <th className="p-3">Status</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {(stats?.teachers || []).map((t) => (
                    <tr key={t.id} className="border-b">
                      <td className="p-3">{t.name}</td>
                      <td className="p-3 text-slate-600">{t.email || '—'}</td>
                      <td className="p-3">{t.class_count}</td>
                      <td className="p-3">{t.active_students}</td>
                      <td className="p-3">{t.status}</td>
                      <td className="p-3">
                        <button type="button" onClick={() => void removeTeacher(t.id)} className="text-rose-600">
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'students' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {String(c.name)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={exportStudentsCsv}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
              >
                <Download className="size-4" />
                Export CSV
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-slate-500 border-b">
                    <th className="p-3">Username</th>
                    <th className="p-3">Class</th>
                    <th className="p-3">Level</th>
                    <th className="p-3">XP</th>
                    <th className="p-3">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={String(s.id)} className="border-b">
                      <td className="p-3">{String(s.username || s.name)}</td>
                      <td className="p-3">{(s as { class_name?: string }).class_name || '—'}</td>
                      <td className="p-3">{String(s.level)}</td>
                      <td className="p-3">{String(s.xp)}</td>
                      <td className="p-3 text-xs text-slate-500">
                        {s.last_active_at ? new Date(String(s.last_active_at)).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'classes' && (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-slate-500 border-b">
                    <th className="p-3">Class</th>
                    <th className="p-3">Teacher</th>
                    <th className="p-3">Students</th>
                    <th className="p-3">Journey</th>
                    <th className="p-3">Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => (
                    <tr
                      key={String(c.id)}
                      className={`border-b cursor-pointer hover:bg-slate-50 ${selectedClassId === String(c.id) ? 'bg-indigo-50' : ''}`}
                      onClick={() => setSelectedClassId(String(c.id))}
                    >
                      <td className="p-3 font-medium">{String(c.name)}</td>
                      <td className="p-3">{String(c.teacher_name)}</td>
                      <td className="p-3">{String(c.student_count)}</td>
                      <td className="p-3 text-xs">{String(c.active_journey)}</td>
                      <td className="p-3">{String(c.completion_rate)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-bold mb-3">Class roster</p>
              {!selectedClassId ? (
                <p className="text-sm text-slate-500">Select a class to see students.</p>
              ) : (
                <ul className="space-y-2">
                  {classStudents.map((s) => (
                    <li key={String(s.id)} className="text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{String(s.name)}</span>
                        <span className="text-slate-500">Lvl {String(s.level)}</span>
                      </div>
                      <div className="h-1.5 mt-1 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-teal-500"
                          style={{ width: `${Math.min(100, Number((s as { progress_percent?: number }).progress_percent) || 0)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === 'reports' && reports && (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="font-bold text-lg">School-wide report</h3>
            <p className="text-sm text-slate-600">Top students by XP</p>
            <ul className="text-sm space-y-1">
              {((reports.top_students as Record<string, unknown>[]) || []).map((s) => (
                <li key={String(s.id)}>
                  {String(s.username || s.name)} — Lvl {String(s.level)} · {String(s.xp)} XP
                </li>
              ))}
            </ul>
            <p className="text-sm text-slate-600 mt-4">
              Engagement: {String((reports.engagement as { highest?: string })?.highest)} highest ·{' '}
              {String((reports.engagement as { lowest?: string })?.lowest)} needs attention
            </p>
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white"
              onClick={() => setMessage('PDF export: use browser print on this page for now.')}
            >
              <Download className="size-4" />
              Export school report
            </button>
          </div>
        )}

        {tab === 'settings' && school && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 max-w-lg">
            <h3 className="font-bold">School settings</h3>
            <label className="block text-sm">
              <span className="text-slate-600">School name</span>
              <input
                className="mt-1 w-full border rounded-lg px-3 py-2"
                value={settingsDraft.name}
                onChange={(e) => setSettingsDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">City</span>
              <input
                className="mt-1 w-full border rounded-lg px-3 py-2"
                value={settingsDraft.city}
                onChange={(e) => setSettingsDraft((d) => ({ ...d, city: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Country</span>
              <input
                className="mt-1 w-full border rounded-lg px-3 py-2"
                value={settingsDraft.country}
                onChange={(e) => setSettingsDraft((d) => ({ ...d, country: e.target.value }))}
              />
            </label>
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 space-y-1">
              <p>
                <strong>Tier:</strong> {String(school.tier)}
              </p>
              <p>
                <strong>Status:</strong> {String(school.subscription_status)}
              </p>
              <p>
                <strong>Expires:</strong>{' '}
                {school.subscription_expires_at
                  ? new Date(String(school.subscription_expires_at)).toLocaleDateString()
                  : '—'}
              </p>
              <p>
                <strong>Limits:</strong> {String(school.max_teachers)} teachers · {String(school.max_students)} students
              </p>
            </div>
            <button
              type="button"
              onClick={() => void saveSettings()}
              className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-bold text-white"
            >
              Save changes
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
