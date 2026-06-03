/**
 * Admin: create schools and manage activation codes.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Copy, RefreshCw, Ban } from 'lucide-react';
import { safeFetch, fetchWithAuth } from '../../app/api';
import type { School } from '../../app/types';

export default function AdminSchoolsPanel() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    city: '',
    tier: 'explorer',
    max_teachers: 2,
    max_students: 50,
  });
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

  const createSchool = async () => {
    if (!form.name.trim()) return;
    const res = await fetchWithAuth('/api/admin/schools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || 'Could not create school');
      return;
    }
    setNewCodeModal({ schoolName: form.name, code: String(data.activation_code || '') });
    setShowForm(false);
    setForm({ name: '', city: '', tier: 'explorer', max_teachers: 2, max_students: 50 });
    void load();
  };

  const regenerateCode = async (id: string, name: string) => {
    const res = await fetchWithAuth(`/api/admin/schools/${id}/regenerate-code`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setNewCodeModal({ schoolName: name, code: String(data.activation_code) });
  };

  const suspend = async (id: string) => {
    await fetchWithAuth(`/api/admin/schools/${id}/suspend`, { method: 'POST' });
    void load();
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setMessage('Copied.');
    setTimeout(() => setMessage(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-[#0D1C32]">School accounts</h3>
          <p className="text-sm text-slate-500">Create schools and share activation codes with principals.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-xs font-bold text-white"
        >
          <Plus className="size-4" />
          Add new school
        </button>
      </div>

      {message && <p className="text-sm text-indigo-700">{message}</p>}

      {showForm && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 grid md:grid-cols-2 gap-3">
          <input
            placeholder="School name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={form.tier}
            onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="explorer">Explorer</option>
            <option value="builder">Builder</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <input
            type="number"
            placeholder="Max teachers"
            value={form.max_teachers}
            onChange={(e) => setForm((f) => ({ ...f, max_teachers: Number(e.target.value) }))}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="Max students"
            value={form.max_students}
            onChange={(e) => setForm((f) => ({ ...f, max_students: Number(e.target.value) }))}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void createSchool()}
            className="md:col-span-2 rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white"
          >
            Create school & generate code
          </button>
        </div>
      )}

      {newCodeModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center shadow-xl">
            <p className="text-sm text-slate-600">Activation code for</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{newCodeModal.schoolName}</p>
            <p className="mt-4 font-mono text-3xl font-black tracking-widest text-indigo-700">{newCodeModal.code}</p>
            <p className="text-xs text-slate-500 mt-2">One-time use — principal enters this after signup.</p>
            <button
              type="button"
              onClick={() => void copy(newCodeModal.code)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-bold text-white"
            >
              <Copy className="size-4" />
              Copy code
            </button>
            <button type="button" onClick={() => setNewCodeModal(null)} className="mt-3 block w-full text-sm text-slate-500">
              Close
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        {loading ? (
          <p className="p-6 text-slate-500 text-sm">Loading schools…</p>
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
                  <td className="p-3 text-xs">
                    {s.subscription_expires_at
                      ? new Date(s.subscription_expires_at).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        title="New activation code"
                        onClick={() => void regenerateCode(s.id, s.name)}
                        className="p-1.5 rounded border hover:bg-slate-50"
                      >
                        <RefreshCw className="size-4" />
                      </button>
                      <button
                        type="button"
                        title="Suspend"
                        onClick={() => void suspend(s.id)}
                        className="p-1.5 rounded border hover:bg-rose-50 text-rose-600"
                      >
                        <Ban className="size-4" />
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
