/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Rocket } from 'lucide-react';
import FuturisticBackground from '../components/FuturisticBackground';
import AddToHomeScreenPrompt from '../components/AddToHomeScreenPrompt';
import { supabase } from '../../lib/supabaseClient';
import { authFetch, getAccessToken, safeFetch, SCHOOL_SUSPENDED_BANNER_KEY } from '../app/api';
import { STORY, STORY_LOGIN } from '../lib/story';

async function studentHasClassMembership(studentId: string): Promise<boolean> {
  const classes = await safeFetch(`/api/students/${studentId}/classes`);
  return Array.isArray(classes) && classes.length > 0;
}

async function tryActivateTeacherInvite(
  role: string | undefined,
  rawCode: string,
): Promise<{ ok: true; user?: Record<string, unknown> } | { ok: false; message: string }> {
  if (role !== 'teacher') return { ok: true };
  const code = rawCode.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!code) return { ok: true };
  if (code.length < 8) {
    return { ok: false, message: 'Enter the full 8-character teacher invite code from your principal.' };
  }
  const token = await getAccessToken();
  if (!token) {
    return { ok: false, message: 'Sign in first, then enter your teacher invite code.' };
  }
  const res = await authFetch('/api/auth/activate-teacher-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(data?.error || data?.message || '');
    if (/no token/i.test(msg)) {
      return { ok: false, message: 'Session expired. Sign in again, then enter your invite code.' };
    }
    return { ok: false, message: msg || 'Invalid or already used invite code.' };
  }
  return { ok: true, user: data?.user as Record<string, unknown> | undefined };
}

async function studentNeedsIndividualHold(studentId: string): Promise<boolean> {
  const hasClass = await studentHasClassMembership(studentId);
  if (hasClass) return false;
  const data = await safeFetch(`/api/students/${studentId}/journeys`);
  const journeys = Array.isArray(data?.journeys) ? data.journeys : [];
  return journeys.length === 0;
}

function IndividualAccessHold({
  user,
  inStemverseHub,
  onContinue,
  onSignOut,
}: {
  user: { id: string; name?: string };
  inStemverseHub?: boolean;
  onContinue: () => void;
  onSignOut: () => void;
}) {
  const [showCode, setShowCode] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setJoinError('Enter your class code.');
      return;
    }
    setJoining(true);
    setJoinError('');
    try {
      const res = await authFetch('/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ join_code: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = String(data?.error || data?.message || '');
        if (/already in this class/i.test(msg)) {
          onContinue();
          return;
        }
        setJoinError(msg || 'Invalid class code. Check with your teacher.');
        return;
      }
      onContinue();
    } catch {
      setJoinError('Could not join class. Try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[210] flex min-h-screen items-center justify-center bg-[#0A192F] p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-600/80 bg-[#0d2137] p-8 shadow-2xl text-center">
        <h1 className="text-2xl font-black text-white tracking-tight">
          {inStemverseHub ? 'Your STEMverse path is almost ready' : 'You are on the list'}
        </h1>
        <p className="mt-4 text-sm text-slate-300 leading-relaxed">
          {inStemverseHub
            ? 'You are in the STEMverse learning community. We are still publishing the first missions for solo explorers — check back soon or join a teacher class with a code.'
            : 'STEMverse needs a school hub and published missions before solo sign-in can start. Ask an admin to create the STEMverse school in the dashboard.'}
        </p>
        <p className="mt-3 text-sm text-slate-400 leading-relaxed">
          Have a camp or classroom code? Enter it below to start right away.
        </p>
        {user.name && (
          <p className="mt-4 text-xs text-teal-300/90 font-semibold">Signed in as {user.name}</p>
        )}
        {showCode ? (
          <div className="mt-6 space-y-3 text-left">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.toUpperCase());
                setJoinError('');
              }}
              placeholder="Class join code"
              className="w-full rounded-xl border border-slate-500 bg-slate-900/60 px-4 py-3 text-sm font-mono text-white placeholder:text-slate-500"
            />
            {joinError && <p className="text-xs text-rose-400 font-semibold">{joinError}</p>}
            <button
              type="button"
              disabled={joining}
              onClick={() => void handleJoin()}
              className="w-full rounded-xl bg-teal-500 py-3 text-sm font-bold text-[#0A192F] disabled:opacity-50"
            >
              {joining ? 'Joining…' : 'Join class'}
            </button>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setShowCode(true)}
              className="w-full rounded-xl bg-teal-500 py-3 text-sm font-bold text-[#0A192F]"
            >
              I have a class code
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="w-full rounded-xl border border-slate-500 py-3 text-sm font-bold text-slate-200"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const Login = ({ onLogin, mode }: { onLogin: (user: any) => void; mode: 'login' | 'signup' }) => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [classJoinCode, setClassJoinCode] = useState('');
  const [teacherInviteCode, setTeacherInviteCode] = useState('');
  const [error, setError] = useState('');
  const [signupNotice, setSignupNotice] = useState<string | null>(null);
  const isSignup = mode === 'signup';
  const [forgotStatus, setForgotStatus] = useState<string>('');
  const [sendingForgot, setSendingForgot] = useState(false);
  const [showClassCodeField, setShowClassCodeField] = useState(false);
  const [showTeacherInviteField, setShowTeacherInviteField] = useState(false);
  const formCardRef = useRef<HTMLDivElement | null>(null);
  const [signupData, setSignupData] = useState({
    name: '',
    password: '',
    email: '',
    role: 'student' as 'student' | 'teacher' | 'parent' | 'school_admin',
  });
  const [holdStudent, setHoldStudent] = useState<{ id: string; name?: string; inStemverseHub?: boolean } | null>(null);
  const [schoolSuspendedBanner, setSchoolSuspendedBanner] = useState<string | null>(null);

  useEffect(() => {
    const msg = sessionStorage.getItem(SCHOOL_SUSPENDED_BANNER_KEY);
    if (msg) {
      setSchoolSuspendedBanner(msg);
      sessionStorage.removeItem(SCHOOL_SUSPENDED_BANNER_KEY);
    }
  }, []);

  const roleCards = [
    { id: 'student' as const, emoji: '🎓', label: "I'm a Student" },
    { id: 'teacher' as const, emoji: '👩‍🏫', label: "I'm a Teacher" },
    { id: 'school_admin' as const, emoji: '🏫', label: "I'm a Principal" },
    { id: 'parent' as const, emoji: '👨‍👩‍👧', label: "I'm a Parent" },
  ];

  const handleQuickAccess = (acc: typeof quickAccess[0]) => {
    setName(acc.email);
    setPassword(acc.pass);
    setClassJoinCode('');
    performLogin(acc.email, acc.pass);
  };

  const signOutSession = async () => {
    localStorage.removeItem('stemverse_access_token');
    if (supabase) await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    setHoldStudent(null);
    navigate('/login');
  };

  const finishStudentLogin = async (user: { id: string; role?: string; name?: string }) => {
    if (user?.role === 'student' && user.id) {
      const needsHold = await studentNeedsIndividualHold(String(user.id));
      if (needsHold) {
        setHoldStudent({
          id: String(user.id),
          name: user.name,
          inStemverseHub: Boolean((user as { school_id?: string | null }).school_id),
        });
        return;
      }
    }
    onLogin(user);
  };

  const tryJoinClassWithCode = async (role: string | undefined, code: string) => {
    if (role !== 'student') return { ok: true as const };
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return { ok: true as const };
    const res = await authFetch('/api/classes/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ join_code: cleanCode }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true as const };
    const msg = String(data?.error || data?.message || '');
    if (/already in this class/i.test(msg)) return { ok: true as const };
    return { ok: false as const, message: msg || 'Invalid class code. Please check with your teacher.' };
  };

  const performLogin = async (n: string, p: string) => {
    setError('');
    setSignupNotice(null);
    const identifier = n.trim();
    if (!identifier || !p) {
      setError('Please enter your username or email and password.');
      return;
    }
    try {
      const payload: Record<string, string> = { password: p };
      if (identifier.includes('@')) payload.email = identifier;
      else payload.username = identifier;
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        if (res.status === 503) {
          setError(
            'Sign-in is unavailable: the server is missing Supabase credentials. On Render, set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service_role key from Supabase → Settings → API), then redeploy.',
          );
          return;
        }
        const msg = String(data?.message || 'Invalid credentials');
        if (/invalid api key/i.test(msg)) {
          setError(
            'Supabase rejected the server API key. In Render: use the same Project URL for SUPABASE_URL and VITE_SUPABASE_URL, put the service_role or secret key (not anon) in SUPABASE_SERVICE_ROLE_KEY, and the anon/publishable key in VITE_SUPABASE_ANON_KEY. Save and redeploy, then open /api/auth/health on your site.',
          );
          return;
        }
        if (/email.*not.*confirm|confirm.*email|email.*verify/i.test(msg)) {
          setError('Please verify your email first, then sign in. Check your inbox/spam for the Supabase confirmation email.');
        } else if (/invalid credentials/i.test(msg) && identifier.includes('@')) {
          setError('Invalid credentials. If this email already exists, try your original password or reset it in Supabase Auth.');
        } else {
          setError(msg);
        }
        return;
      }
      if (!data?.access_token) {
        setError('Sign-in succeeded but no session token was returned. Restart the server and try again.');
        return;
      }
      localStorage.setItem('stemverse_access_token', String(data.access_token));
      if (supabase) {
        await supabase.auth.setSession({
          access_token: String(data.access_token),
          refresh_token: String(data.refresh_token || data.access_token),
        });
      }
      let user = data?.user;
      const meRes = await authFetch('/api/me');
      const meData = await meRes.json().catch(() => ({}));
      if (meRes.ok && meData?.user) user = meData.user;
      if (user) {
        const inviteResult = await tryActivateTeacherInvite(user?.role, teacherInviteCode);
        if (inviteResult.ok === false) {
          setError(inviteResult.message);
          return;
        }
        if (inviteResult.user) user = inviteResult.user;
        const joinResult = await tryJoinClassWithCode(user?.role, classJoinCode);
        if (!joinResult.ok) {
          setError(joinResult.message);
          return;
        }
        await finishStudentLogin(user);
      } else {
        setError('Could not load account.');
      }
    } catch {
      setError('Connection failed');
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(name, password);
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSignup();
  };

  const performSignup = async () => {
    setError('');
    setSignupNotice(null);
    const displayName = signupData.name.trim();
    const email = signupData.email.trim();
    const pwd = signupData.password;
    if (!displayName || !email || !pwd) {
      setError('Please fill in display name, email, and password.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (pwd.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!signupData.role) {
      setError('Please choose Student, Teacher, or Parent.');
      return;
    }
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: displayName,
          email,
          password: pwd,
          role: signupData.role,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        if (res.status === 409 || /already exists|already registered/i.test(String(data?.message || ''))) {
          await performLogin(signupData.email, signupData.password);
          return;
        }
        setError(data?.message || 'Signup failed');
        return;
      }
      if (data?.username && signupData.role === 'student') {
        setSignupNotice(`Welcome! Your explorer handle is ${data.username}`);
      }
      if (data?.needs_email_confirmation) {
        setSignupNotice((prev) => `${prev ? `${prev} ` : ''}Check your email to verify your account, then sign in.`);
        return;
      }
      if (data?.access_token) {
        localStorage.setItem('stemverse_access_token', String(data.access_token));
        if (supabase) {
          await supabase.auth.setSession({
            access_token: String(data.access_token),
            refresh_token: String(data.refresh_token || data.access_token),
          });
        }
      } else {
        localStorage.removeItem('stemverse_access_token');
      }
      if (data?.user) {
        let user = data.user;
        const meRes = await authFetch('/api/me');
        const meData = await meRes.json().catch(() => ({}));
        if (meRes.ok && meData?.user) user = meData.user;
        const inviteResult = await tryActivateTeacherInvite(user?.role, teacherInviteCode);
        if (inviteResult.ok === false) {
          setError(inviteResult.message);
          return;
        }
        if (inviteResult.user) user = inviteResult.user;
        await finishStudentLogin(user);
      } else {
        await performLogin(signupData.email, signupData.password);
      }
    } catch {
      setError('Connection failed');
    }
  };

  const handleForgotPassword = async () => {
    if (sendingForgot) return;
    setSendingForgot(true);
    setError('');
    setForgotStatus('');
    const email = name.trim();
    if (!email || !email.includes('@')) {
      setForgotStatus('Type your email first in the username/email box, then click Forgot password.');
      setSendingForgot(false);
      return;
    }
    const redirectTo = `${window.location.origin}/`;
    if (!supabase) {
      setForgotStatus('Password reset requires Supabase to be configured in .env (VITE_SUPABASE_URL).');
      setSendingForgot(false);
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (resetError) {
      setForgotStatus(resetError.message || 'Could not send reset email.');
      setSendingForgot(false);
      return;
    }
    setForgotStatus('Password reset email sent. Check inbox/spam, then open the link and set a new password.');
    setSendingForgot(false);
  };

  useEffect(() => {
    if (formCardRef.current) {
      formCardRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setForgotStatus('');
  }, [isSignup]);

  const quickAccess = [
    { email: 'student@example.com', pass: 'student123', role: 'Student' },
    { email: 'teacher@example.com', pass: 'teacher123', role: 'Teacher' },
    { email: 'admin@example.com', pass: 'admin123', role: 'Admin' }
  ];

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  if (holdStudent) {
    return (
      <IndividualAccessHold
        user={holdStudent}
        inStemverseHub={holdStudent.inStemverseHub}
        onContinue={() => {
          const u = holdStudent;
          setHoldStudent(null);
          onLogin({ id: u.id, role: 'student', name: u.name });
        }}
        onSignOut={() => void signOutSession()}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex min-h-screen overflow-y-auto text-[var(--ca-on-surface)]">
      <FuturisticBackground withParticles={false} />
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="cosmic-login-hero cosmic-inverse hidden lg:flex lg:w-[45%] flex-col justify-center px-12 xl:px-20 py-16 relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none bg-[radial-gradient(circle_at_30%_20%,#76849f_0%,transparent_50%)]" />
        <div className="relative z-10">
          <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }} className="size-24 rounded-[var(--ca-radius-lg)] bg-[rgba(255,255,255,0.08)] flex items-center justify-center border border-[rgba(118,132,159,0.4)] mb-8">
            <Rocket className="text-cyan-400 size-12" />
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="cosmic-h1-hero mb-4">
            STEM<span className="text-cyan-400">VERSE</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="cosmic-body-lg max-w-sm mb-2">
            {STORY_LOGIN.body}
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="cosmic-page-sub text-[var(--ca-secondary-container)]">
            {STORY.tagline}
          </motion.p>
        </div>
      </motion.div>

      <div className="flex-1 flex items-start lg:items-center justify-center p-4 lg:p-12 bg-[var(--ca-background)] overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 280, delay: 0.15 }}
          className="w-full max-w-md my-4 lg:my-0"
        >
          <div ref={formCardRef} className="cosmic-card p-8 lg:p-10 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="lg:hidden flex flex-col items-center mb-8">
              <div className="size-16 rounded-[var(--ca-radius-lg)] bg-[var(--ca-surface-container-low)] flex items-center justify-center border border-[var(--ca-outline-variant)] mb-4">
                <Rocket className="text-cyan-400 size-8" />
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--ca-on-surface)]">STEM<span className="text-cyan-400">VERSE</span></h1>
            </div>
            <p className="cosmic-page-sub text-center mb-6 text-[var(--ca-on-surface-variant)]">
              {isSignup ? 'Create Your Account' : 'Welcome Back'}
            </p>

            {schoolSuspendedBanner && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
              >
                {schoolSuspendedBanner}
              </div>
            )}

            <div className="cosmic-segment mb-6">
              <motion.button
                variants={item}
                type="button"
                data-active={!isSignup ? 'true' : 'false'}
                onClick={() => navigate('/login')}
              >
                Sign In
              </motion.button>
              <motion.button
                variants={item}
                type="button"
                data-active={isSignup ? 'true' : 'false'}
                onClick={() => navigate('/signup')}
              >
                Sign Up
              </motion.button>
            </div>

            {!isSignup ? (
            <form key="stemverse-login" onSubmit={handleLoginSubmit} noValidate className="space-y-6">
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
              <motion.div variants={item} className="space-y-2">
                <label className="cosmic-label" htmlFor="login-identifier">Username or Email</label>
                <input
                  id="login-identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="cosmic-input font-mono text-sm"
                  placeholder="your username or you@example.com"
                />
              </motion.div>
              <motion.div variants={item} className="space-y-2">
                <label className="cosmic-label" htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="cosmic-input font-mono text-sm"
                  placeholder="••••••••"
                />
              </motion.div>
              <motion.div variants={item} className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowClassCodeField((v) => !v)}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-md text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 transition-colors"
                >
                  {showClassCodeField ? 'Hide class code' : 'I have a class code'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTeacherInviteField((v) => !v)}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-md text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                >
                  {showTeacherInviteField ? 'Hide teacher invite' : 'I have a teacher invite'}
                </button>
              </motion.div>
              {showTeacherInviteField && (
              <motion.div variants={item} className="space-y-2">
                <label className="cosmic-label" htmlFor="login-teacher-invite">Teacher invite code</label>
                <input
                  id="login-teacher-invite"
                  type="text"
                  value={teacherInviteCode}
                  onChange={(e) => setTeacherInviteCode(e.target.value.toUpperCase())}
                  className="cosmic-input font-mono text-sm tracking-widest"
                  placeholder="XXXXXXXX"
                  maxLength={8}
                  autoComplete="off"
                />
                <p className="text-[10px] text-[var(--ca-on-surface-variant)]">
                  Shared school teacher code or one-time invite from principal (Teachers tab).
                </p>
              </motion.div>
              )}
              {showClassCodeField && (
              <motion.div variants={item} className="space-y-2">
                <label className="cosmic-label">Class Code (optional)</label>
                <input
                  type="text"
                  value={classJoinCode}
                  onChange={e => setClassJoinCode(e.target.value.toUpperCase())}
                  className="cosmic-input font-mono text-sm"
                  placeholder="Teacher class code"
                />
                <p className="text-[10px] text-[var(--ca-on-surface-variant)]">
                  Ask your teacher for the 6-character class code to connect instantly.
                </p>
              </motion.div>
              )}
              <motion.div variants={item} className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={sendingForgot}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors ${
                    sendingForgot
                      ? 'bg-cyan-500/20 text-cyan-200 cursor-not-allowed'
                      : 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10'
                  }`}
                >
                  {sendingForgot ? 'Sending reset link…' : 'Forgot password?'}
                </button>
              </motion.div>
            </motion.div>
          {signupNotice && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[var(--ca-on-tertiary-container)] text-sm font-semibold text-center bg-[var(--ca-tertiary-fixed)]/40 border border-[var(--ca-outline-variant)] rounded-[var(--ca-radius)] py-2 px-3">
              {signupNotice}
            </motion.p>
          )}
          {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[var(--ca-on-error-container)] text-sm font-semibold text-center bg-[var(--ca-error-container)] border border-[var(--ca-error)]/30 rounded-[var(--ca-radius)] py-2 px-3">{error}</motion.p>}
          {forgotStatus && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[var(--ca-on-secondary-container)] text-xs font-semibold text-center bg-[var(--ca-secondary-container)]/40 border border-[var(--ca-outline-variant)] rounded-[var(--ca-radius)] py-2 px-3"
            >
              {forgotStatus}
            </motion.p>
          )}
          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="cosmic-btn-primary"
          >
            Sign In
          </motion.button>
            </form>
          ) : (
            <form key="stemverse-signup" onSubmit={handleSignupSubmit} noValidate className="space-y-6">
            <input type="hidden" name="role" value={signupData.role} readOnly aria-hidden tabIndex={-1} />
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
              <div className="space-y-2">
                <span className="cosmic-label" id="signup-role-label">I am signing up as</span>
                <div className="grid grid-cols-1 gap-2" role="group" aria-labelledby="signup-role-label">
                  {roleCards.map((card) => {
                    const active = signupData.role === card.id;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSignupData((d) => ({ ...d, role: card.id }))}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                          active
                            ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]'
                            : 'border-[var(--ca-outline-variant)] bg-[var(--ca-surface-container-low)] hover:border-cyan-400/50'
                        }`}
                      >
                        <span className="text-2xl" aria-hidden>{card.emoji}</span>
                        <span className="text-sm font-semibold text-[var(--ca-on-surface)]">{card.label}</span>
                      </button>
                    );
                  })}
                </div>
                {signupData.role === 'student' && (
                  <p className="text-[10px] text-[var(--ca-on-surface-variant)] leading-snug mt-1">
                    Individual signups join the STEMverse learning community automatically (like Duolingo). Use a class code at sign-in if your teacher gave you one.
                  </p>
                )}
                {signupData.role === 'teacher' && (
                  <p className="text-[10px] text-[var(--ca-on-surface-variant)] leading-snug mt-1">
                    Use the shared school teacher code from your principal (Teachers tab), or a one-time invite. Not the principal activation code.
                  </p>
                )}
              </div>
              <motion.div variants={item} className="space-y-2">
                <label className="cosmic-label" htmlFor="signup-name">Display name</label>
                <input
                  id="signup-name"
                  name="display_name"
                  type="text"
                  autoComplete="name"
                  value={signupData.name}
                  onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                  className="cosmic-input text-sm"
                  placeholder="e.g. Sara Khan"
                />
              </motion.div>
              <motion.div variants={item} className="space-y-2">
                <label className="cosmic-label" htmlFor="signup-email">Email</label>
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={signupData.email}
                  onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                  className="cosmic-input text-sm"
                  placeholder="you@school.edu"
                />
              </motion.div>
              <motion.div variants={item} className="space-y-2">
                <label className="cosmic-label" htmlFor="signup-password">Password</label>
                <input
                  id="signup-password"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={signupData.password}
                  onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                  className="cosmic-input text-sm"
                  placeholder="••••••••"
                />
              </motion.div>
              {signupData.role === 'teacher' && (
                <motion.div variants={item} className="space-y-2">
                  <label className="cosmic-label" htmlFor="signup-teacher-invite">
                    Teacher invite code (optional)
                  </label>
                  <input
                    id="signup-teacher-invite"
                    type="text"
                    value={teacherInviteCode}
                    onChange={(e) => setTeacherInviteCode(e.target.value.toUpperCase())}
                    className="cosmic-input font-mono text-sm tracking-widest"
                    placeholder="XXXXXXXX"
                    maxLength={8}
                    autoComplete="off"
                  />
                </motion.div>
              )}
              {signupData.role === 'student' && (
                <p className="text-[10px] text-[var(--ca-on-surface-variant)] leading-snug">
                  Students get a unique explorer handle automatically. Use a class code from your teacher to start learning.
                </p>
              )}
            </motion.div>
          {signupNotice && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[var(--ca-on-tertiary-container)] text-sm font-semibold text-center bg-[var(--ca-tertiary-fixed)]/40 border border-[var(--ca-outline-variant)] rounded-[var(--ca-radius)] py-2 px-3">
              {signupNotice}
            </motion.p>
          )}
          {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[var(--ca-on-error-container)] text-sm font-semibold text-center bg-[var(--ca-error-container)] border border-[var(--ca-error)]/30 rounded-[var(--ca-radius)] py-2 px-3">{error}</motion.p>}
          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="cosmic-btn-primary"
          >
            Create Account
          </motion.button>
            </form>
          )}

            {import.meta.env.MODE !== 'production' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-8 pt-8 border-t border-[var(--ca-outline-variant)]">
                <p className="cosmic-page-sub mb-4 text-center text-[var(--ca-on-surface-variant)]">Quick access (dev)</p>
                <div className="grid grid-cols-1 gap-3">
                  {quickAccess.map((acc, i) => (
                    <motion.button
                      key={acc.email}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.08 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => handleQuickAccess(acc)}
                      type="button"
                      className="flex items-center justify-between p-3.5 rounded-[var(--ca-radius-md)] transition-all group text-left border border-[var(--ca-outline-variant)] bg-[var(--ca-surface-container-low)] hover:bg-[var(--ca-surface-container)]"
                    >
                      <div>
                        <p className="text-xs font-semibold text-[var(--ca-on-surface)] tracking-tight">{acc.email}</p>
                        <p className="cosmic-page-sub text-[8px] mt-0.5 text-[var(--ca-on-surface-variant)]">{acc.role}</p>
                      </div>
                      <p className="text-[8px] font-mono text-[var(--ca-on-secondary-container)]">KEY: {acc.pass}</p>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default function Auth({ onLogin, mode = 'login' }: { onLogin: (user: any) => void; mode?: 'login' | 'signup' }) {
  return (
    <>
      <Login onLogin={onLogin} mode={mode} />
    </>
  );
}
