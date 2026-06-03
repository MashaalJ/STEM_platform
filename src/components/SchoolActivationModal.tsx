/**
 * Post-signup school linking for principals and teachers.
 */
import React, { useState } from 'react';
import { authFetch, getAccessToken } from '../app/api';
import type { Student } from '../app/types';

export default function SchoolActivationModal({
  student,
  onLinked,
}: {
  student: Student;
  onLinked: (user: Student) => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isPrincipal = student.role === 'school_admin';
  const needsActivation = isPrincipal
    ? Boolean(student.needs_school_activation ?? !student.school_id)
    : Boolean(student.needs_teacher_invite ?? !student.school_id);
  if (!needsActivation) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError('You must be signed in first. Sign in as Teacher, then enter your invite code.');
        return;
      }
      const path = isPrincipal ? '/api/auth/activate-school' : '/api/auth/activate-teacher-invite';
      const body = isPrincipal ? { activation_code: code.trim() } : { code: code.trim() };
      const res = await authFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = String(data.error || data.message || 'Invalid code');
        if (/no token/i.test(msg)) {
          setError('Session expired. Sign in again, then re-enter your invite code.');
        } else {
          setError(msg);
        }
        return;
      }
      if (data.user) onLinked(data.user as Student);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <h2 className="text-xl font-bold text-slate-900">
          {isPrincipal ? 'Link your school' : 'Join your school'}
        </h2>
        <p className="text-sm text-slate-600 mt-2">
          {isPrincipal
            ? 'Enter the 8-character principal code from Admin → Schools. Each code works once; if it fails, ask admin to click Regenerate (↻) and send the new code.'
            : 'Enter the 8-character teacher invite code from your principal (not the principal school code).'}
        </p>
        <label htmlFor="school-activation-code" className="block mt-4 text-sm font-semibold text-slate-700">
          {isPrincipal ? 'School activation code' : 'Teacher invite code'}
        </label>
        <input
          id="school-activation-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXXXXXX"
          maxLength={8}
          autoComplete="off"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-widest uppercase"
        />
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || code.trim().replace(/[^A-Za-z0-9]/g, '').length < 8}
          className="mt-4 w-full rounded-lg bg-indigo-700 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? 'Verifying…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
