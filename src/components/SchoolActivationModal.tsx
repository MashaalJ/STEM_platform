/**
 * Post-signup school linking for principals and teachers.
 */
import React, { useState } from 'react';
import { authFetch } from '../app/api';
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
  const needsActivation = isPrincipal ? student.needs_school_activation : student.needs_teacher_invite;
  if (!needsActivation) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const path = isPrincipal ? '/api/auth/activate-school' : '/api/auth/activate-teacher-invite';
      const body = isPrincipal ? { activation_code: code.trim() } : { code: code.trim() };
      const res = await authFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || data.message || 'Invalid code');
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
            ? 'Enter the 8-character activation code STEMverse gave your school.'
            : 'Enter the invite code from your principal.'}
        </p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXXXXXX"
          maxLength={8}
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-widest uppercase"
        />
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || code.trim().length < 6}
          className="mt-4 w-full rounded-lg bg-indigo-700 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? 'Verifying…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
