/**
 * Admin: create schools and manage activation codes.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Copy, RefreshCw, Ban, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { authFetch, getAccessToken, safeFetch } from '../../app/api';
import type { School } from '../../app/types';

const STEMVERSE_SCHOOL_DEFAULTS = {
  max_teachers: 10,
  max_students: 300,
};

type SchoolForm = {
  name: string;
  city: string;
  country: string;
  tier: string;
  max_teachers: number;
  max_students: number;
};

const emptyForm = (): SchoolForm => ({
  name: '',
  city: '',
  country: 'Pakistan',
  tier: 'explorer',
  max_teachers: STEMVERSE_SCHOOL_DEFAULTS.max_teachers,
  max_students: STEMVERSE_SCHOOL_DEFAULTS.max_students,
});

function FieldLabel({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm">
      <span className="font-semibold text-slate-700">{children}</span>
      {hint && <span className="block text-xs text-slate-500 mt-0.5 font-normal">{hint}</span>}
    </label>
  );
}

export default function AdminSchoolsPanel() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SchoolForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCodeModal, setNewCodeModal] = useState<{ schoolName: string; code: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await safeFetch('/api/admin/schools');
    setSchools(Array.isArray(data) ? (data as School[]) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apiError = (data: Record<string, unknown>, fallback: string, status?: number) => {
    if (status === 401) {
      return 'Session expired. Sign out, log in again as admin, then retry.';
    }
    if (status === 502) {
      return 'Server is waking up or restarting (502). Wait 30 seconds, refresh, then try again.';
    }
    if (status === 503) {
      const detail = String(data.message || data.error || '');
      if (/auth not configured|school tables/i.test(detail)) return detail;
      return detail || 'Service unavailable (503). Check Render deploy logs and Supabase env vars.';
    }
    return String(data.message || data.error || fallback);
  };

  const ensureToken = async (): Promise<boolean> => {
    const token = await getAccessToken();
    if (token) return true;
    setMessage('Session expired. Sign out and log in again as admin.');
    return false;
  };

  const createSchool = async () => {
    if (!form.name.trim()) {
      setMessage('School name is required.');
      return;
    }
    if (!(await ensureToken())) return;
    const res = await authFetch('/api/admin/schools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(apiError(data, 'Could not create school', res.status));
      return;
    }
    setNewCodeModal({ schoolName: form.name, code: String(data.activation_code || '') });
    setShowForm(false);
    setForm(emptyForm());
    void load();
  };

  const saveEdit = async () => {
    if (!editingId || !form.name.trim()) return;
    if (!(await ensureToken())) return;
    const res = await authFetch(`/api/admin/schools/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(apiError(data, 'Could not update school', res.status));
      return;
    }
    setEditingId(null);
    setShowForm(false);
    setForm(emptyForm());
    setMessage('School updated.');
    void load();
  };

  const startEdit = (s: School) => {
    setEditingId(s.id);
    setShowForm(true);
    setForm({
      name: s.name,
      city: s.city || '',
      country: s.country || 'Pakistan',
      tier: s.tier || 'explorer',
      max_teachers: s.max_teachers ?? STEMVERSE_SCHOOL_DEFAULTS.max_teachers,
      max_students: s.max_students ?? STEMVERSE_SCHOOL_DEFAULTS.max_students,
    });
  };

  const deleteSchool = async (s: School) => {
    if (
      !confirm(
        `Delete "${s.name}"? Teachers and students stay in STEMverse but are unlinked from this school.`,
      )
    ) {
      return;
    }
    if (!(await ensureToken())) return;
    const res = await authFetch(`/api/admin/schools/${s.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(apiError(data, 'Could not delete school'));
      return;
    }
    setMessage(`Deleted ${s.name}.`);
    void load();
  };

  const regenerateCode = async (id: string, name: string) => {
    if (!(await ensureToken())) return;
    const res = await authFetch(`/api/admin/schools/${id}/regenerate-code`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setNewCodeModal({ schoolName: name, code: String(data.activation_code) });
    else setMessage(apiError(data, 'Could not regenerate code'));
  };

  const suspend = async (id: string) => {
    if (!(await ensureToken())) return;
    await authFetch(`/api/admin/schools/${id}/suspend`, { method: 'POST' });
    void load();
  };

  const unsuspend = async (id: string) => {
    if (!(await ensureToken())) return;
    await authFetch(`/api/admin/schools/${id}/unsuspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_status: 'trial' }),
    });
    void load();
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setMessage('Copied.');
    setTimeout(() => setMessage(null), 2000);
  };

  const applyStemversePreset = () => {
    setForm((f) => ({
      ...f,
      name: f.name || 'STEMverse',
      max_teachers: STEMVERSE_SCHOOL_DEFAULTS.max_teachers,
      max_students: STEMVERSE_SCHOOL_DEFAULTS.max_students,
      tier: 'enterprise',
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-[#0D1C32]">School accounts</h3>
          <p className="text-sm text-slate-500 max-w-xl">
            Create a school (e.g. STEMverse), share the activation code with your principal account, then
            invite instructors. Set limits to the number of teacher and student accounts that can join this
            school — not phone numbers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setForm(emptyForm());
            setShowForm((v) => !v);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-xs font-bold text-white"
        >
          <Plus className="size-4" />
          Add new school
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Suggested limits for STEMverse (camps + individuals)</p>
        <ul className="mt-1 list-disc list-inside text-slate-600 space-y-0.5">
          <li>
            <strong>Max teachers:</strong> headcount of instructors (e.g. 5–10 small program, 10–20 larger)
          </li>
          <li>
            <strong>Max students:</strong> peak learners across camps + self-serve (e.g. 200–500; use 300 as a
            starting default)
          </li>
        </ul>
      </div>

      {message && <p className="text-sm text-indigo-700">{message}</p>}

      {showForm && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-800">
              {editingId ? 'Edit school' : 'New school'}
            </p>
            {!editingId && (
              <button
                type="button"
                onClick={applyStemversePreset}
                className="text-xs font-bold text-indigo-700 hover:underline"
              >
                Apply STEMverse suggested limits
              </button>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="school-name" hint="Shown to principals and teachers">
                School name *
              </FieldLabel>
              <input
                id="school-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <FieldLabel htmlFor="school-city">City</FieldLabel>
              <input
                id="school-city"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <FieldLabel htmlFor="school-country">Country</FieldLabel>
              <input
                id="school-country"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <FieldLabel htmlFor="school-tier" hint="Higher tiers can carry larger limits">
                Subscription tier
              </FieldLabel>
              <select
                id="school-tier"
                value={form.tier}
                onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="explorer">Explorer</option>
                <option value="builder">Builder</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <FieldLabel
                htmlFor="school-max-teachers"
                hint="Cap on teacher accounts linked to this school (not a phone number)"
              >
                Max teacher accounts
              </FieldLabel>
              <input
                id="school-max-teachers"
                type="number"
                min={1}
                value={form.max_teachers}
                onChange={(e) => setForm((f) => ({ ...f, max_teachers: Number(e.target.value) }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <FieldLabel
                htmlFor="school-max-students"
                hint="Cap on student accounts under this school (camp + individual learners)"
              >
                Max student accounts
              </FieldLabel>
              <input
                id="school-max-students"
                type="number"
                min={1}
                value={form.max_students}
                onChange={(e) => setForm((f) => ({ ...f, max_students: Number(e.target.value) }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void (editingId ? saveEdit() : createSchool())}
            className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white"
          >
            {editingId ? 'Save changes' : 'Create school & generate activation code'}
          </button>
        </div>
      )}

      {newCodeModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center shadow-xl">
            <p className="text-sm text-slate-600">Principal activation code for</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{newCodeModal.schoolName}</p>
            <p className="mt-4 font-mono text-3xl font-black tracking-widest text-indigo-700">
              {newCodeModal.code}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Principal signs up as &quot;I&apos;m a Principal&quot;, then enters this code once.
            </p>
            <button
              type="button"
              onClick={() => void copy(newCodeModal.code)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-bold text-white"
            >
              <Copy className="size-4" />
              Copy code
            </button>
            <button
              type="button"
              onClick={() => setNewCodeModal(null)}
              className="mt-3 block w-full text-sm text-slate-500"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        {loading ? (
          <p className="p-6 text-slate-500 text-sm">Loading schools…</p>
        ) : schools.length === 0 ? (
          <p className="p-6 text-slate-500 text-sm">No schools yet. Create STEMverse above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase text-slate-500 border-b bg-slate-50">
                <th className="p-3">School</th>
                <th className="p-3">City</th>
                <th className="p-3">Tier</th>
                <th className="p-3">Status</th>
                <th className="p-3">Teachers</th>
                <th className="p-3">Students</th>
                <th className="p-3">Limits</th>
                <th className="p-3">Principal code</th>
                <th className="p-3">Expires</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((s) => (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="p-3 font-semibold">{s.name}</td>
                  <td className="p-3">{s.city || '—'}</td>
                  <td className="p-3">{s.tier}</td>
                  <td className="p-3 capitalize">{s.subscription_status}</td>
                  <td className="p-3">{s.teacher_count ?? 0}</td>
                  <td className="p-3">{s.student_count ?? 0}</td>
                  <td className="p-3 text-xs text-slate-600">
                    {s.max_teachers ?? '—'} teachers · {s.max_students ?? '—'} students max
                  </td>
                  <td className="p-3">
                    {(s as School & { activation_code?: string | null; has_principal?: boolean }).activation_code ? (
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs font-bold text-indigo-800">
                          {String((s as School & { activation_code?: string }).activation_code)}
                        </span>
                        <button
                          type="button"
                          title="Copy principal code"
                          onClick={() =>
                            void copy(String((s as School & { activation_code?: string }).activation_code))
                          }
                          className="p-1 rounded border text-[10px]"
                        >
                          <Copy className="size-3" />
                        </button>
                      </div>
                    ) : (s as School & { has_principal?: boolean }).has_principal ? (
                      <span className="text-xs text-emerald-700 font-semibold">Principal linked</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void regenerateCode(s.id, s.name)}
                        className="text-xs text-amber-700 font-semibold underline"
                      >
                        Generate code
                      </button>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {s.subscription_expires_at
                      ? new Date(s.subscription_expires_at).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        title="Edit school"
                        onClick={() => startEdit(s)}
                        className="p-1.5 rounded border hover:bg-slate-50"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        title="New activation code"
                        onClick={() => void regenerateCode(s.id, s.name)}
                        className="p-1.5 rounded border hover:bg-slate-50"
                      >
                        <RefreshCw className="size-4" />
                      </button>
                      {s.subscription_status === 'suspended' ? (
                        <button
                          type="button"
                          title="Unsuspend"
                          onClick={() => void unsuspend(s.id)}
                          className="p-1.5 rounded border hover:bg-emerald-50 text-emerald-700"
                        >
                          <CheckCircle2 className="size-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          title="Suspend school"
                          onClick={() => void suspend(s.id)}
                          className="p-1.5 rounded border hover:bg-rose-50 text-rose-600"
                        >
                          <Ban className="size-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        title="Delete school"
                        onClick={() => void deleteSchool(s)}
                        className="p-1.5 rounded border hover:bg-rose-50 text-rose-700"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
