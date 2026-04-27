/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import FuturisticBackground from './components/FuturisticBackground';
import { 
  Rocket, 
  Map as MapIcon, 
  Trophy, 
  Users, 
  User, 
  Settings, 
  Search, 
  Bell, 
  Flame, 
  Lock, 
  CheckCircle2, 
  TrendingUp, 
  ChevronRight,
  ChevronLeft,
  Terminal,
  LayoutDashboard,
  Database,
  Shield,
  ArrowLeft,
  Play,
  School,
  Activity,
  Award,
  Plus,
  BarChart3,
  PieChart,
  ClipboardList,
  Zap,
  X,
  ChevronDown,
  Copy,
  Sparkles,
  Download,
  LogIn,
  Layers,
  LayoutGrid,
  AlertTriangle,
  KeyRound,
  ShieldCheck,
  Share2,
  Printer
} from 'lucide-react';
import { ChallengeBuilder, ChallengeRenderer } from './challenges';
import { QuizPlayer } from './challenges/QuizPlayer';
import { supabase } from '../lib/supabaseClient';

// --- Types ---

/** Attach Bearer from Supabase session or stemverse_access_token; on 401, drop stale stored token and retry with cookie only. */
const fetchWithOptionalBearerRetry = async (input: RequestInfo | URL, init?: RequestInit) => {
  const { data } = await supabase.auth.getSession();
  const stored = localStorage.getItem('stemverse_access_token');
  const token = data.session?.access_token || stored;
  const headers = new Headers(init?.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let res = await fetch(input, { ...init, headers, credentials: init?.credentials ?? 'include' });
  if (res.status === 401 && stored && !data.session?.access_token) {
    localStorage.removeItem('stemverse_access_token');
    const retryHeaders = new Headers(init?.headers || {});
    res = await fetch(input, { ...init, headers: retryHeaders, credentials: init?.credentials ?? 'include' });
  }
  return res;
};

const safeFetch = async (url: string, options?: RequestInit) => {
  try {
    const res = await fetchWithOptionalBearerRetry(url, options);
    if (!res.ok) {
      const text = await res.text();
      console.error(`Fetch error for ${url}: ${res.status} ${text}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`Network error for ${url}:`, err);
    return null;
  }
};

// Same as safeFetch, but returns the raw Response so callers can inspect `ok` / `status`.
const fetchWithAuth = (url: string, options?: RequestInit) => fetchWithOptionalBearerRetry(url, options);

const authFetch = (input: string, init?: RequestInit) => fetchWithOptionalBearerRetry(input, init);

interface Sector {
  id: number;
  name: string;
  description: string;
  xp_reward: number;
  required_level: number;
  mastery_percent: number;
  status: 'active' | 'locked' | 'maintenance';
  image_url: string;
}

interface Mission {
  id: number;
  sector_id: number;
  title: string;
  description: string;
  difficulty: string;
  xp_reward: number;
  status: string;
  image_url: string;
  embed_code?: string;
  grade_level?: string | null;
  prerequisite_mission_id?: number | null;
  learning_outcomes_json?: string | null;
  domains_json?: string | null;
  learning_outcomes?: string[];
  domains?: string[];
}

interface Class {
  id: number;
  name: string;
  teacher_id: number;
  teacher_name?: string;
  description: string;
  student_count?: number;
  join_code?: string;
  curriculum_track?: string | null;
}

interface AdminQuizRow {
  id: number;
  title: string;
  created_at?: string;
}

interface AdminChallengeRow {
  id: number;
  title: string;
  type: string;
  world?: string | null;
  zone?: string | null;
  xp_reward?: number;
}

interface StudentProgress {
  badges: any[];
  quizzes: any[];
  missions_completed?: number;
}

interface AssignedQuizRow {
  id: number;
  title: string;
  created_at?: string;
  latest_score?: number | null;
  latest_total_questions?: number | null;
  latest_completed_at?: string | null;
}

interface AssignedMissionRow {
  id: number;
  sector_id: number;
  title: string;
  description?: string;
  difficulty?: string;
  xp_reward?: number;
  latest_completed_at?: string | null;
}

interface QuizReviewItem {
  id: number;
  student_quiz_id: number;
  student_id: number;
  student_name: string;
  quiz_id: number;
  quiz_title: string;
  question_index: number;
  prompt: string;
  response_text: string;
  max_score: number;
  created_at: string;
}

interface Student {
  id: number;
  name: string;
  level: number;
  xp: number;
  avatar_url: string;
  role: string;
  age?: number;
  grade?: string;
  school?: string;
  city?: string;
  email?: string;
  parent_email?: string;
  contact_number?: string;
  username?: string;
  created_at?: string;
  gender?: string | null;
  country_code?: string | null;
  region?: string | null;
  timezone?: string | null;
  subscription_status?: string | null;
  subscription_plan?: string | null;
  billing_provider?: string | null;
  mrr_cents?: number | null;
  ltv_cents?: number | null;
  last_active_at?: string | null;
}

interface AdminMetricsPayload {
  byRole: { role: string; n: number }[];
  bySubscriptionStatus: { subscription_status: string; n: number }[];
  byPlan: { subscription_plan: string; n: number }[];
  byGender: { gender: string; n: number }[];
  byCountry: { country_code: string; n: number }[];
  byCity: { city: string; n: number }[];
  ageBuckets: { bucket: string; n: number }[];
  gradeDistribution: { grade: string; n: number }[];
  interestTrends: { interest_key: string; n: number }[];
  signupsLast30Days: { day: string; n: number }[];
  monetization: {
    mrrCents: number;
    arpuCents: number;
    payingUsers: number;
    trialUsers: number;
    pastDueUsers: number;
    freeOrUnpaidUsers: number;
    ltvSumCents: number;
  };
  product: {
    studentCount: number;
    activatedStudents: number;
    activationRatePct: number;
    dau: number;
    wau: number;
    mau: number;
    weeklyReturningSharePct: number;
    classCount: number;
    avgMissionsPerClass: number;
    avgQuizzesPerClass: number;
    avgChallengesPerClass: number;
  };
  aiUsageByDay: { day: string; endpoint: string; ok: number; total: number }[];
}

interface MissionRecommendation {
  mission_id: number;
  title: string;
  difficulty?: string;
  sector?: string;
  reason: string;
}

interface SystemLog {
  id: number;
  timestamp: string;
  message: string;
  type: string;
  xp_change: number;
}

interface StudentBadgeRow {
  id: number;
  student_id: number;
  badge_name: string;
  badge_icon: string | null;
  earned_at: string;
}

interface StudentQuizAttemptRow {
  id?: number;
  quiz_id: number;
  score: number;
  total_questions: number;
  completed_at: string;
  title?: string;
}

interface StudentProgressPayload {
  badges: StudentBadgeRow[];
  quizzes: StudentQuizAttemptRow[];
  missions_completed: number;
}

const STUDENT_INTEREST_OPTIONS = [
  { key: 'robotics', label: 'Robotics', emoji: '🤖' },
  { key: 'ai_ml', label: 'AI & ML', emoji: '🧠' },
  { key: 'space_tech', label: 'Space Tech', emoji: '🚀' },
  { key: 'game_dev', label: 'Game Dev', emoji: '🎮' },
  { key: 'web_dev', label: 'Web Dev', emoji: '🌐' },
  { key: 'app_dev', label: 'App Dev', emoji: '📱' },
  { key: 'electronics', label: 'Electronics', emoji: '⚡' },
  { key: '3d_printing', label: '3D Printing', emoji: '🧩' },
  { key: 'biotech', label: 'Health Tech', emoji: '🧬' },
  { key: 'fintech', label: 'FinTech', emoji: '💸' },
  { key: 'math_puzzles', label: 'Math Puzzles', emoji: '🧮' },
  { key: 'science_experiments', label: 'Science Experiments', emoji: '🧪' },
];

const Login = ({ onLogin }: { onLogin: (user: any) => void }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [signupNotice, setSignupNotice] = useState<string | null>(null);
  const [isSignup, setIsSignup] = useState(false);
  const [forgotStatus, setForgotStatus] = useState<string>('');
  const [sendingForgot, setSendingForgot] = useState(false);
  const [schoolOptions, setSchoolOptions] = useState<string[]>([]);
  const formCardRef = useRef<HTMLDivElement | null>(null);
  const [signupData, setSignupData] = useState({
    name: '',
    password: '',
    role: 'student',
    age: '',
    grade: '',
    school: '',
    city: '',
    email: '',
    parent_email: '',
    contact_number: '',
    gender: '',
    country_code: '',
    region: '',
    timezone: '',
  });

  const handleQuickAccess = (acc: typeof quickAccess[0]) => {
    setName(acc.email);
    setPassword(acc.pass);
    performLogin(acc.email, acc.pass);
  };

  const performLogin = async (n: string, p: string) => {
    setError('');
    setSignupNotice(null);
    try {
      const identifier = n.trim();
      const payload: any = { password: p };
      if (identifier.includes('@')) payload.email = identifier;
      else payload.username = identifier;
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        const msg = String(data?.message || 'Invalid credentials');
        if (/email.*not.*confirm|confirm.*email|email.*verify/i.test(msg)) {
          setError('Please verify your email first, then sign in. Check your inbox/spam for the Supabase confirmation email.');
        } else if (/invalid credentials/i.test(msg) && identifier.includes('@')) {
          setError('Invalid credentials. If this email already exists, try your original password or reset it in Supabase Auth.');
        } else {
          setError(msg);
        }
        return;
      }
      if (data?.access_token) {
        localStorage.setItem('stemverse_access_token', String(data.access_token));
      } else {
        localStorage.removeItem('stemverse_access_token');
      }
      if (data?.user) {
        onLogin(data.user);
      } else {
        const me = await safeFetch('/api/me');
        if (me?.authenticated && me?.user) onLogin(me.user);
        else setError('Could not load account.');
      }
    } catch {
      setError('Connection failed');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignup) {
      performSignup();
    } else {
      performLogin(name, password);
    }
  };

  const performSignup = async () => {
    setError('');
    setSignupNotice(null);
    if (signupData.role === 'teacher' && !signupData.school.trim()) {
      setError('Teacher signup requires selecting a school.');
      return;
    }
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...signupData,
          age: signupData.age ? parseInt(signupData.age) : undefined,
          gender: signupData.gender.trim() || undefined,
          country_code: signupData.country_code.trim() || undefined,
          region: signupData.region.trim() || undefined,
          timezone: signupData.timezone.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        if (res.status === 409 || /already exists|already registered/i.test(String(data?.message || ''))) {
          // Smooth path: existing email should behave like sign-in attempt with same password.
          await performLogin(signupData.email, signupData.password);
          return;
        }
        setError(data?.message || 'Signup failed');
        return;
      }
      if (data?.username) {
        setSignupNotice(`Your username is "${data.username}" (not case sensitive).`);
      }
      if (data?.needs_email_confirmation) {
        setSignupNotice((prev) => `${prev ? `${prev} ` : ''}Check your email to verify your account, then sign in.`);
        return;
      }
      if (data?.access_token) {
        localStorage.setItem('stemverse_access_token', String(data.access_token));
      } else {
        localStorage.removeItem('stemverse_access_token');
      }
      if (data?.user) {
        onLogin(data.user);
      } else {
        // Some Supabase setups complete signup without returning an immediately usable session/user.
        // Fall back to explicit login with the same credentials.
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

  useEffect(() => {
    safeFetch('/api/schools').then((data) => {
      setSchoolOptions(Array.isArray(data) ? data.map((s) => String(s)).filter(Boolean) : []);
    });
  }, []);

  const quickAccess = [
    { email: 'student@example.com', pass: 'student123', role: 'Student' },
    { email: 'teacher@example.com', pass: 'teacher123', role: 'Teacher' },
    { email: 'admin@example.com', pass: 'admin123', role: 'Admin' }
  ];

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

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
            Learn STEM through games and quizzes. Track progress, level up, and compete with your class.
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="cosmic-page-sub text-[var(--ca-secondary-container)]">
            Learn. Play. Grow.
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

            <div className="cosmic-segment mb-6">
              <motion.button
                variants={item}
                type="button"
                data-active={!isSignup ? 'true' : 'false'}
                onClick={() => setIsSignup(false)}
              >
                Sign In
              </motion.button>
              <motion.button
                variants={item}
                type="button"
                data-active={isSignup ? 'true' : 'false'}
                onClick={() => setIsSignup(true)}
              >
                Sign Up
              </motion.button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
          {!isSignup ? (
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
              <motion.div variants={item} className="space-y-2">
                <label className="cosmic-label">Username or Email</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="cosmic-input font-mono text-sm"
                  placeholder="your username or you@example.com"
                />
              </motion.div>
              <motion.div variants={item} className="space-y-2">
                <label className="cosmic-label">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="cosmic-input font-mono text-sm"
                  placeholder="••••••••"
                />
              </motion.div>
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
          ) : (
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
              <motion.div variants={item} className="space-y-2">
                <label className="cosmic-label">Full Name</label>
                <input
                  type="text"
                  required
                  value={signupData.name}
                  onChange={e => setSignupData({ ...signupData, name: e.target.value })}
                  className="cosmic-input text-sm"
                  placeholder="e.g. Sara Khan"
                />
              </motion.div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="cosmic-label">Role</label>
                  <select
                    value={signupData.role}
                    onChange={e => setSignupData({ ...signupData, role: e.target.value })}
                    className="cosmic-input text-[11px] py-3"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="cosmic-label">Age</label>
                  <input
                    type="number"
                    value={signupData.age}
                    onChange={e => setSignupData({ ...signupData, age: e.target.value })}
                    className="cosmic-input text-[11px] py-3"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="cosmic-label">Grade</label>
                  <input
                    value={signupData.grade}
                    onChange={e => setSignupData({ ...signupData, grade: e.target.value })}
                    className="cosmic-input text-[11px] py-3"
                  />
                </div>
                <div className="space-y-2">
                  <label className="cosmic-label">School</label>
                  <select
                    value={signupData.school}
                    onChange={e => setSignupData({ ...signupData, school: e.target.value })}
                    className="cosmic-input text-[11px] py-3"
                    required={signupData.role === 'teacher'}
                  >
                    <option value="">
                      {signupData.role === 'teacher' ? 'Select school (required)' : 'Select school (optional)'}
                    </option>
                    {schoolOptions.map((schoolName) => (
                      <option key={schoolName} value={schoolName}>
                        {schoolName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="cosmic-label">City</label>
                  <input
                    value={signupData.city}
                    onChange={e => setSignupData({ ...signupData, city: e.target.value })}
                    className="cosmic-input text-[11px] py-3"
                  />
                </div>
                <div className="space-y-2">
                  <label className="cosmic-label">Contact Number</label>
                  <input
                    value={signupData.contact_number}
                    onChange={e => setSignupData({ ...signupData, contact_number: e.target.value })}
                    className="cosmic-input text-[11px] py-3"
                  />
                </div>
              </div>
              <p className="text-[10px] text-[var(--ca-on-surface-variant)] leading-snug">
                Optional — helps your school with anonymized reports. You can skip these.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="cosmic-label">Gender (optional)</label>
                  <select
                    value={signupData.gender}
                    onChange={(e) => setSignupData({ ...signupData, gender: e.target.value })}
                    className="cosmic-input text-[11px] py-3"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="prefer_not_say">Prefer not to say (explicit)</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="cosmic-label">Country (ISO2)</label>
                  <input
                    value={signupData.country_code}
                    onChange={(e) => setSignupData({ ...signupData, country_code: e.target.value.toUpperCase().slice(0, 2) })}
                    className="cosmic-input text-[11px] py-3 font-mono"
                    placeholder="US"
                    maxLength={2}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="cosmic-label">Region / state</label>
                  <input
                    value={signupData.region}
                    onChange={(e) => setSignupData({ ...signupData, region: e.target.value })}
                    className="cosmic-input text-[11px] py-3"
                    placeholder="e.g. CA"
                  />
                </div>
                <div className="space-y-2">
                  <label className="cosmic-label">Timezone (IANA)</label>
                  <input
                    value={signupData.timezone}
                    onChange={(e) => setSignupData({ ...signupData, timezone: e.target.value })}
                    className="cosmic-input text-[11px] py-3"
                    placeholder="America/New_York"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="cosmic-label">Student / Teacher Email</label>
                <input
                  type="email"
                  required
                  value={signupData.email}
                  onChange={e => setSignupData({ ...signupData, email: e.target.value })}
                  className="cosmic-input text-[11px] py-3"
                />
              </div>
              <div className="space-y-2">
                <label className="cosmic-label">Parent / Guardian Email</label>
                <input
                  type="email"
                  value={signupData.parent_email}
                  onChange={e => setSignupData({ ...signupData, parent_email: e.target.value })}
                  className="cosmic-input text-[11px] py-3"
                />
              </div>
              <div className="space-y-2">
                <label className="cosmic-label">Create Password</label>
                <input
                  type="password"
                  required
                  value={signupData.password}
                  onChange={e => setSignupData({ ...signupData, password: e.target.value })}
                  className="cosmic-input text-[11px] py-3"
                  placeholder="••••••••"
                />
              </div>
            </motion.div>
          )}
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
            {isSignup ? 'Create Account' : 'Sign In'}
          </motion.button>
            </form>

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

const AddStudentForm = ({ onStudentAdded }: { onStudentAdded: () => void }) => {
  const [formData, setFormData] = useState({
    name: '',
    role: 'student',
    level: 1,
    xp: 0,
    avatar_url: '',
    password: 'password123'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    setFormData({ name: '', role: 'student', level: 1, xp: 0, avatar_url: '', password: 'password123' });
    onStudentAdded();
  };

  return (
    <div className="bg-slate-800/70 backdrop-blur-md p-8 rounded-3xl border border-slate-600/50 shadow-xl shadow-black/20">
      <div className="flex items-center gap-3 mb-8">
        <div className="size-10 rounded-xl bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center">
          <Plus className="text-brand-blue size-5" />
        </div>
        <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter">Register New Operator</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
          <input 
            placeholder="e.g. Commander Shepard" 
            className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-300 focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/50 outline-none transition-all font-bold"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Level</label>
            <select 
              className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3 text-slate-100 focus:border-brand-blue/50 outline-none appearance-none font-bold"
              value={formData.role}
              onChange={e => setFormData({...formData, role: e.target.value})}
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Initial Level</label>
            <input 
              type="number" 
              className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3 text-slate-100 font-mono focus:border-brand-blue/50 outline-none font-bold"
              value={formData.level}
              onChange={e => setFormData({...formData, level: parseInt(e.target.value)})}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Avatar Seed</label>
          <input 
            placeholder="e.g. neuro-link-01" 
            className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3 text-slate-100 text-xs focus:border-brand-blue/50 outline-none font-bold"
            value={formData.avatar_url}
            onChange={e => setFormData({...formData, avatar_url: e.target.value})}
          />
        </div>
        <button type="submit" className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white font-black py-4 rounded-xl uppercase tracking-widest transition-all shadow-lg shadow-brand-blue/20 active:scale-[0.98]">
          Initialize Account
        </button>
      </form>
    </div>
  );
};

// --- Components ---

type NotificationItem = {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  is_read: number;
  created_at: string;
};

const Navbar = ({
  activeView,
  setActiveView,
  student,
  onOpenSettings,
  notifications = [],
  onMarkRead,
  onMarkAllRead,
  onOpenLink,
}: {
  activeView: string;
  setActiveView: (v: string) => void;
  student: Student | null;
  onOpenSettings?: () => void;
  notifications?: NotificationItem[];
  onMarkRead?: (id: number) => void;
  onMarkAllRead?: () => void;
  onOpenLink?: (link: string | null | undefined) => void;
}) => {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.is_read).length;
  return (
  <header className="fixed top-0 left-0 right-0 z-50 cosmic-header-bar">
    <div className="cosmic-inverse max-w-[var(--ca-container-max)] mx-auto px-[var(--ca-gutter)] h-[var(--ca-header-height)] flex items-center justify-between gap-8 relative">
      <div
        className={`absolute left-[var(--ca-gutter)] top-0 h-full w-0.5 rounded-full transition-colors ${
          activeView === 'dashboard' || activeView === 'galaxy' ? 'bg-[var(--ca-secondary-container)]' : 'bg-[var(--ca-on-primary-container)]'
        }`}
        aria-hidden
      />

      <div className="flex items-center gap-6 pl-2">
        <div className="relative group cursor-pointer" onClick={() => setActiveView('profile')}>
            <div className={`absolute -inset-2 rounded-full blur-md opacity-25 group-hover:opacity-45 transition duration-300 ${activeView === 'profile' ? 'bg-[var(--ca-secondary-container)]' : 'bg-[var(--ca-on-primary-container)]'}`} />
            <div className="relative size-14 p-1 rounded-full border-2 border-[rgba(118,132,159,0.5)] bg-[rgba(13,28,50,0.5)] overflow-hidden">
              <img 
                className="size-full rounded-full object-cover" 
                src={student?.avatar_url || "https://picsum.photos/seed/avatar/100/100"} 
                alt="Avatar"
                referrerPolicy="no-referrer"
              />
            </div>
        </div>
        <div className="hidden sm:block cursor-pointer" onClick={() => setActiveView('galaxy')}>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <Rocket className="size-7 cosmic-brand-accent shrink-0" aria-hidden />
            <span className="cosmic-brand-wordmark">STEM</span>
            <span className="cosmic-brand-accent">VERSE</span>
          </h1>
          <p className="cosmic-page-sub text-[8px] -mt-1 ml-9 opacity-90">Kid Learning Hub</p>
        </div>
      </div>

      {student?.role === 'student' && (
        <div className="flex-1 max-w-xl hidden md:flex flex-col gap-1.5">
          <div className="flex justify-between items-end text-[10px]">
            <span className="flex items-center gap-1 text-[var(--ca-on-primary-container)] font-black uppercase tracking-[0.12em]">
              <Activity className="size-3 text-[var(--ca-secondary-container)]" /> Progress
            </span>
            <span className="text-[var(--ca-secondary-container)] font-mono font-bold tracking-wide">
              {(student?.xp || 0).toLocaleString()} / 1000 XP
            </span>
          </div>
          <div className="h-2 w-full rounded-full overflow-hidden border border-[rgba(118,132,159,0.4)] bg-[rgba(13,28,50,0.55)] p-0.5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${((student?.xp || 0) % 1000) / 10}%` }}
              className="h-full rounded-full bg-gradient-to-r from-[var(--ca-secondary-container)] to-[var(--ca-tertiary-container)]"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 lg:gap-6">
        {student?.role === 'student' && (
          <div className="flex items-center gap-3 px-4 py-2 rounded-[var(--ca-radius-md)] border border-[rgba(118,132,159,0.35)] bg-[rgba(13,28,50,0.45)]">
            <div className="flex flex-col items-end">
              <span className="cosmic-page-sub text-[9px] opacity-90">Level</span>
              <span className="text-cyan-400 font-bold text-base leading-none">LVL {student?.level || 1}</span>
            </div>
            <div className="size-10 rounded-[var(--ca-radius)] border border-[rgba(255,178,4,0.35)] bg-[rgba(255,178,4,0.12)] text-cyan-400 flex items-center justify-center">
              <Award className="size-5" />
            </div>
          </div>
        )}
        <button
          onClick={() => onOpenSettings?.()}
          className="p-3 rounded-[var(--ca-radius)] border border-[rgba(118,132,159,0.35)] bg-[rgba(13,28,50,0.35)] transition-all text-slate-400 hover:text-cyan-400 hover:border-[rgba(255,178,4,0.45)]"
          title="Settings"
        >
          <Settings className="size-5" />
        </button>

        {student?.role === 'student' && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="p-3 rounded-[var(--ca-radius)] border border-[rgba(118,132,159,0.35)] bg-[rgba(13,28,50,0.35)] transition-all text-slate-400 hover:text-cyan-400 hover:border-[rgba(255,178,4,0.45)] relative"
              title="Notifications"
            >
              <Bell className="size-5" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 size-3 rounded-full bg-[var(--ca-error)] border-2 border-[var(--ca-primary-container)]" />
              )}
            </button>

            {open && (
              <div className="cosmic-inverse absolute right-0 mt-3 w-[360px] max-w-[90vw] z-50 rounded-[var(--ca-radius-lg)] border border-[rgba(118,132,159,0.4)] bg-[rgba(13,28,50,0.92)] backdrop-blur-xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(118,132,159,0.35)]">
                  <p className="cosmic-page-sub text-[10px]">Notifications</p>
                  <button
                    type="button"
                    onClick={() => onMarkAllRead?.()}
                    className="cosmic-page-sub text-[10px] text-cyan-400 hover:opacity-90"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-slate-400 text-sm">No notifications yet.</div>
                  ) : (
                    notifications.slice(0, 30).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          onMarkRead?.(n.id);
                          if (n.link) onOpenLink?.(n.link);
                          setOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 border-b border-[rgba(118,132,159,0.25)] hover:bg-[rgba(255,255,255,0.06)] transition-all ${
                          n.is_read ? 'opacity-80' : 'bg-[rgba(255,178,4,0.06)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-100 truncate">{n.title}</p>
                            <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-slate-500 mt-1 font-mono">{new Date(n.created_at).toLocaleString()}</p>
                          </div>
                          {!n.is_read && <span className="mt-1 size-2 rounded-full bg-[var(--ca-secondary-container)] shrink-0" />}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  </header>
  );
};

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

/** Spawn away from orbit nodes — bottom-center (50,88) often overlaps the lower ring and triggers instant sector entry. */
const GALAXY_SPAWN_CANDIDATES: { x: number; y: number }[] = [
  { x: 12, y: 86 },
  { x: 88, y: 86 },
  { x: 14, y: 72 },
  { x: 86, y: 72 },
  { x: 10, y: 52 },
  { x: 90, y: 48 },
];

function pickGalaxySpawn(sectorCenters: { x: number; y: number }[]): { x: number; y: number } {
  if (sectorCenters.length === 0) return { x: 12, y: 86 };
  const minSafe = 9.5;
  let best = { x: 12, y: 86 };
  let bestMinDist = -1;
  for (const c of GALAXY_SPAWN_CANDIDATES) {
    const x = Math.max(6, Math.min(94, c.x));
    const y = Math.max(14, Math.min(90, c.y));
    const minDist = Math.min(...sectorCenters.map((p) => Math.hypot(x - p.x, y - p.y)));
    if (minDist > bestMinDist) {
      bestMinDist = minDist;
      best = { x, y };
    }
  }
  if (bestMinDist >= minSafe) return best;
  const step = 8;
  for (let y = 86; y >= 20; y -= step) {
    for (const x of [12, 50, 88]) {
      const cx = Math.max(6, Math.min(94, x));
      const cy = Math.max(14, Math.min(90, y));
      const minDist = Math.min(...sectorCenters.map((p) => Math.hypot(cx - p.x, cy - p.y)));
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        best = { x: cx, y: cy };
      }
    }
  }
  return best;
}

function galaxyHudTooltipClass(i: number): string {
  const m = i % 4;
  if (m === 0) return 'absolute -right-24 sm:-right-28 top-0';
  if (m === 1) return 'absolute -left-24 sm:-left-28 top-2';
  if (m === 2) return 'absolute right-full mr-3 bottom-0';
  return 'absolute left-1/2 -translate-x-1/2 top-full mt-2';
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
  const sectorPositions = useMemo(() => galaxyOrbitPositions(sectors.length), [sectors.length]);
  const [playerPos, setPlayerPos] = useState(() => pickGalaxySpawn([]));
  const [nearSectorId, setNearSectorId] = useState<number | null>(null);
  const lastEnterRef = useRef<{ id: number | null; at: number }>({ id: null, at: 0 });
  /** Avoid auto-opening a sector on load when spawn overlaps the orbit ring; must move once to enable walk-in entry. */
  const [movementPrimed, setMovementPrimed] = useState(false);

  useEffect(() => {
    setPlayerPos(pickGalaxySpawn(sectorPositions));
    setMovementPrimed(false);
    lastEnterRef.current = { id: null, at: 0 };
  }, [sectorPositions]);

  const firstUnlocked = useMemo(
    () => sectors.find((s) => s.status !== 'locked'),
    [sectors]
  );

  const moveStep = 2.2;
  const nudge = useCallback((dx: number, dy: number) => {
    setMovementPrimed(true);
    setPlayerPos((prev) => ({
      x: Math.max(6, Math.min(94, prev.x + dx * moveStep)),
      y: Math.max(14, Math.min(90, prev.y + dy * moveStep)),
    }));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isMoveKey =
        key === 'arrowup' ||
        key === 'arrowdown' ||
        key === 'arrowleft' ||
        key === 'arrowright' ||
        key === 'w' ||
        key === 'a' ||
        key === 's' ||
        key === 'd';
      if (!isMoveKey) return;
      e.preventDefault();
      if (key === 'arrowup' || key === 'w') nudge(0, -1);
      else if (key === 'arrowdown' || key === 's') nudge(0, 1);
      else if (key === 'arrowleft' || key === 'a') nudge(-1, 0);
      else if (key === 'arrowright' || key === 'd') nudge(1, 0);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nudge]);

  useEffect(() => {
    let collided: Sector | null = null;
    for (let i = 0; i < sectors.length; i++) {
      const sector = sectors[i];
      if (sector.status === 'locked') continue;
      const pos = sectorPositions[i];
      if (!pos) continue;
      const dx = playerPos.x - pos.x;
      const dy = playerPos.y - pos.y;
      if (Math.hypot(dx, dy) < 7.5) {
        collided = sector;
        break;
      }
    }
    setNearSectorId(collided?.id ?? null);
    if (!collided) return;
    if (!movementPrimed) return;

    const now = Date.now();
    const recentlyEnteredSame = lastEnterRef.current.id === collided.id && now - lastEnterRef.current.at < 1000;
    if (recentlyEnteredSame) return;
    lastEnterRef.current = { id: collided.id, at: now };
    onSelectSector(collided);
  }, [playerPos, sectors, onSelectSector, sectorPositions, movementPrimed]);

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
  const systemAlert =
    sectors.length === 0
      ? 'Loading sectors…'
      : student && (!student.grade || !student.school)
        ? 'Refuel module required — finish profile setup'
        : !activeMission
          ? 'Select a mission in any open sector'
          : 'All systems nominal';

  return (
    <div className="space-y-8">
      <div className="relative w-full min-h-[108vh] max-w-none mx-auto overflow-visible ca-starfield shadow-[0_8px_40px_rgba(2,6,23,0.45)]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(96%,1200px)] aspect-square max-w-[1200px] pointer-events-none">
          <div className="ca-orbit-line w-[37.5%] h-[37.5%]" />
          <div className="ca-orbit-line w-[68.75%] h-[68.75%]" />
          <div className="ca-orbit-line w-[93.75%] h-[93.75%]" />
        </div>

        <div className="relative z-10 h-full min-h-[inherit] flex items-center justify-center p-4 sm:p-8">
          <div className="relative w-full h-full max-w-[1240px] min-h-[820px]">
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
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-500">Core Curriculum</p>
                <p className="text-xs font-mono text-slate-500 mt-0.5">
                  {sectors.length ? `${avgMastery}% synchronized` : '—'}
                </p>
              </div>
            </div>

            {sectors.map((sector, i) => {
              const pos = sectorPositions[i];
              if (!pos) return null;
              const isLocked = sector.status === 'locked';
              const shortLabel =
                sector.name.length > 14 ? `${sector.name.slice(0, 12)}…` : sector.name;

              return (
                <motion.div
                  key={sector.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.06 }}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                >
                  <div className={`relative group ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                    <motion.button
                      type="button"
                      whileHover={isLocked ? {} : { scale: 1.04 }}
                      whileTap={isLocked ? {} : { scale: 0.97 }}
                      onClick={() => !isLocked && onSelectSector(sector)}
                      className={`relative rounded-full overflow-hidden border-2 border-amber-500/30 transition-[border-color,transform] duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 ${sectorSizeClass(
                        i
                      )} ${isLocked ? 'opacity-75' : 'group-hover:border-amber-500 group-hover:scale-[1.02]'}`}
                      aria-label={sector.name}
                    >
                      {isLocked ? (
                        <div className="size-full bg-[#0A192F]/80 flex items-center justify-center">
                          <Lock className="size-6 text-slate-400" aria-hidden />
                        </div>
                      ) : (
                        <div
                          className="size-full"
                          style={{
                            background:
                              i % 4 === 0
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

                    {!isLocked && (
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

                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white bg-[#0A192F] px-2 py-0.5 rounded border border-slate-800/80 max-w-[140px] truncate">
                      {isLocked ? `Lvl ${sector.required_level}` : shortLabel}
                    </div>
                  </div>
                </motion.div>
              );
            })}

            <div
              className="absolute z-[25] -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none"
              style={{ left: `${playerPos.x}%`, top: `${playerPos.y}%` }}
              aria-label="Explorer"
            >
              <div className="size-10 rounded-xl bg-amber-50/95 border-2 border-amber-400 flex items-center justify-center shadow-lg shadow-amber-900/20">
                <span className="text-xl leading-none" role="img" aria-hidden>
                  🧑
                </span>
              </div>
            </div>

            <div className="absolute top-4 left-4 flex flex-col gap-0.5 max-w-[200px] z-[26] pointer-events-none">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Galaxy controls</span>
              <span className="text-[11px] font-mono text-slate-400">Arrow keys or WASD to navigate</span>
              <span className="text-[10px] text-slate-500">
                {!movementPrimed
                  ? 'Use WASD or arrows to move, then enter a sector'
                  : nearSectorId
                    ? 'Entering sector…'
                    : 'Move onto a sector to enter'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-6xl mx-auto">
        <div className="ca-glass-hud p-5 rounded-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 mb-1">Total XP</p>
          <p className="text-2xl font-bold text-amber-500 tabular-nums">{xpDisplay.toLocaleString()}</p>
          <div className="flex items-center gap-1 mt-2 text-xs text-emerald-400">
            <TrendingUp className="size-3.5 shrink-0" aria-hidden />
            <span>
              {student != null ? `Level ${student.level} · expand your orbit` : 'Sign in to track XP'}
            </span>
          </div>
        </div>
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
                  s.status === 'locked' ? 'bg-slate-600' : 'ring-1 ring-amber-500/40'
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
    { from: 'bot', text: 'Hi commander. Ask me anything about STEMverse missions or topics.' },
  ]);
  const [input, setInput] = useState('');

  const replyFor = (text: string) => {
    const q = text.toLowerCase();
    if (q.includes('robot') || q.includes('robotics')) return 'Robotics focuses on sensing, control, and autonomous behavior. Start with Sensors 101 then move to Actuators and Control Loops.';
    if (q.includes('ai') || q.includes('machine learning')) return 'AI track starts with data basics, then models, then applied projects. I can suggest a starter mission if you tell me your level.';
    if (q.includes('math')) return 'Math missions are scaffolded by level. Begin with algebra foundations and progress to statistics for AI and physics simulations.';
    return 'I can help with curriculum guidance, mission suggestions, and quick concept explainers. Try asking about robotics, AI, math, or science.';
  };

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { from: 'user', text }, { from: 'bot', text: replyFor(text) }]);
    setInput('');
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
            Rocket Assistant
          </h2>
          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-4 h-[52vh] overflow-y-auto space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[85%] px-4 py-2 rounded-xl text-sm ${m.from === 'user' ? 'ml-auto bg-cyan-500/20 text-cyan-100 border border-cyan-400/40' : 'bg-[#0d1c32] text-slate-100 border border-amber-400/25'}`}>
                {m.text}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Ask a question..."
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-white"
            />
            <button type="button" onClick={send} className="px-5 py-3 rounded-xl bg-amber-500 text-slate-950 font-black">
              Send
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
  completedMissionIds?: number[];
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
          <div
            key={mission.id}
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
                <CheckCircle2 className="size-8 text-amber-400" aria-hidden />
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
          </div>
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
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
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
                  <CheckCircle2 className="size-10 text-slate-950" />
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
  const [completedMissionIds, setCompletedMissionIds] = useState<number[]>([]);
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
            <p className="text-slate-200 font-medium mb-1">No missions assigned in this sector yet</p>
            <p className="text-slate-400 text-sm">Try another sector, or ask your teacher to publish missions here.</p>
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

const SUBSCRIPTION_STATUSES = ['none', 'free', 'trial', 'active', 'past_due', 'canceled'] as const;
const BILLING_PROVIDERS = ['none', 'manual', 'stripe'] as const;

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
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={() => !saving && onClose()} />
      <div className="relative bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
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
      </div>
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
  const [creatingSector, setCreatingSector] = useState(false);
  const [sectorForm, setSectorForm] = useState({
    name: '',
    description: '',
    required_level: 1,
    xp_reward: 0,
    status: 'locked',
    image_url: '',
  });

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

  const handleCreateSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectorForm.name.trim()) {
      showNotice('Sector name is required.');
      return;
    }
    setCreatingSector(true);
    try {
      const res = await fetchWithAuth('/api/sectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sectorForm.name.trim(),
          description: sectorForm.description.trim(),
          required_level: Number(sectorForm.required_level) || 1,
          xp_reward: Number(sectorForm.xp_reward) || 0,
          status: sectorForm.status,
          image_url: sectorForm.image_url.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        showNotice(data?.message || 'Could not create sector.');
        return;
      }
      setSectorForm({
        name: '',
        description: '',
        required_level: 1,
        xp_reward: 0,
        status: 'locked',
        image_url: '',
      });
      showNotice('Sector created.');
      refreshData();
    } catch {
      showNotice('Network error creating sector.');
    } finally {
      setCreatingSector(false);
    }
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
    { id: 'clusters' as const, label: 'School Clusters', icon: School },
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

                  <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <h4 className="font-semibold text-[#0D1C32] mb-3">Top student interests</h4>
                    {adminMetrics.interestTrends?.length ? (
                      <ul className="text-sm space-y-1 text-slate-600 max-h-48 overflow-y-auto">
                        {adminMetrics.interestTrends.map((r) => (
                          <li key={r.interest_key} className="flex justify-between gap-2">
                            <span className="truncate capitalize">{r.interest_key.replace(/_/g, ' ')}</span>
                            <span className="font-mono shrink-0">{r.n}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-slate-400 text-sm">No student interest data yet.</p>
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
              <h3 className="text-xl font-semibold text-[#0D1C32] mb-2">School Clusters</h3>
              <p className="text-sm text-slate-500 mb-4">
                {classes.length} class{classes.length === 1 ? '' : 'es'} · {classAggregates.enrolled.toLocaleString()} enrolled (from class rollups) ·{' '}
                {classAggregates.uniqueTeachers} teacher{classAggregates.uniqueTeachers === 1 ? '' : 's'} with classes
              </p>
              <div className="space-y-3">
                {classes.length === 0 && <p className="text-slate-500">No classes found.</p>}
                {classes.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50">
                    <div>
                      <p className="font-semibold text-[#0D1C32]">{c.name}</p>
                      <p className="text-xs text-slate-500">
                        {c.teacher_name ? `Teacher: ${c.teacher_name}` : `Teacher ID: ${c.teacher_id}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-amber-700">{c.student_count ?? 0} students</p>
                      <p className="text-xs text-slate-500">{c.join_code ? `Code: ${c.join_code}` : 'No join code'}</p>
                    </div>
                  </div>
                ))}
              </div>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(10,25,47,0.05)] p-6">
                <h3 className="text-xl font-semibold text-[#0D1C32] mb-4">Sectors</h3>
                <form onSubmit={handleCreateSector} className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="text-xs uppercase tracking-wider text-slate-600 font-semibold">Create sector</p>
                  <input
                    value={sectorForm.name}
                    onChange={(e) => setSectorForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="cosmic-input text-sm"
                    placeholder="Sector name"
                    required
                  />
                  <textarea
                    value={sectorForm.description}
                    onChange={(e) => setSectorForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="cosmic-input text-sm min-h-[72px]"
                    placeholder="Short description"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={1}
                      value={sectorForm.required_level}
                      onChange={(e) => setSectorForm((prev) => ({ ...prev, required_level: Number(e.target.value) || 1 }))}
                      className="cosmic-input text-sm"
                      placeholder="Required level"
                    />
                    <input
                      type="number"
                      min={0}
                      value={sectorForm.xp_reward}
                      onChange={(e) => setSectorForm((prev) => ({ ...prev, xp_reward: Number(e.target.value) || 0 }))}
                      className="cosmic-input text-sm"
                      placeholder="XP reward"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={sectorForm.status}
                      onChange={(e) => setSectorForm((prev) => ({ ...prev, status: e.target.value }))}
                      className="cosmic-input text-sm"
                    >
                      <option value="locked">Locked</option>
                      <option value="active">Active</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                    <input
                      value={sectorForm.image_url}
                      onChange={(e) => setSectorForm((prev) => ({ ...prev, image_url: e.target.value }))}
                      className="cosmic-input text-sm"
                      placeholder="Image URL (optional)"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={creatingSector}
                    className="w-full rounded-lg bg-[#0A192F] text-white text-sm font-semibold py-2 disabled:opacity-60"
                  >
                    {creatingSector ? 'Creating…' : 'Create sector'}
                  </button>
                </form>
                <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                  {sectors.map((s) => (
                    <div key={s.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-[#0D1C32] truncate">{s.name}</p>
                        <span className="text-xs uppercase text-slate-500 shrink-0">{s.status}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-xs text-slate-600">
                        <span>Mastery {s.mastery_percent}%</span>
                        <span className="text-slate-400">Lv.{s.required_level}+</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{s.description}</p>
                    </div>
                  ))}
                  {!sectors.length && <p className="text-sm text-slate-500">No sectors yet.</p>}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(10,25,47,0.05)] p-6">
                <h3 className="text-xl font-semibold text-[#0D1C32] mb-1">Missions</h3>
                <p className="text-xs text-slate-500 mb-3">
                  {missionsWithEmbed} with embed · {missions.length} total
                </p>
                <div className="space-y-3 max-h-[26rem] overflow-y-auto pr-1">
                  {missions.map((m) => (
                    <div key={m.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-[#0D1C32] truncate">{m.title}</p>
                        <span className="text-xs text-amber-700 font-semibold shrink-0">+{m.xp_reward} XP</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{m.description}</p>
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
        <AdminBillingModal
          user={billingUser}
          onClose={() => setBillingUser(null)}
          onSaved={() => void refreshData()}
        />
      )}
    </div>
  );
};

const TeacherHub = ({ sectors, students, student, refetchStudents }: { sectors: Sector[], students: Student[], student: Student, refetchStudents?: () => void }) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'classroom' | 'library' | 'missions' | 'reviews' | 'reports'>('analytics');
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [assignedMissions, setAssignedMissions] = useState<Mission[]>([]);
  const [libraryMissions, setLibraryMissions] = useState<Mission[]>([]);
  const [libraryAssigning, setLibraryAssigning] = useState<{ missionId: number; classId: number } | null>(null);
  const [libraryAssignFeedback, setLibraryAssignFeedback] = useState<{ missionTitle: string; className: string } | null>(null);
  const [libraryAccessFeedback, setLibraryAccessFeedback] = useState<string | null>(null);
  const [libraryAssignError, setLibraryAssignError] = useState<string | null>(null);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [librarySectorFilter, setLibrarySectorFilter] = useState<number | 'all'>('all');
  const [pendingReviews, setPendingReviews] = useState<QuizReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reportPreview, setReportPreview] = useState<any[]>([]);

  useEffect(() => {
    safeFetch('/api/classes').then(data => {
      if (data) {
        const teacherClasses = data.filter((c: Class) => c.teacher_id === student.id);
        setClasses(teacherClasses);
        if (teacherClasses.length > 0 && !selectedClassId) setSelectedClassId(teacherClasses[0].id);
      }
    });
  }, [student.id]);

  useEffect(() => {
    if (activeTab === 'library') safeFetch('/api/missions').then(data => setLibraryMissions(Array.isArray(data) ? data : []));
  }, [activeTab]);

  useEffect(() => {
    if (!selectedClassId) {
      setReportPreview([]);
      return;
    }
    safeFetch(`/api/report-card/${selectedClassId}`).then((data) => {
      setReportPreview(Array.isArray(data) ? data : []);
    });
  }, [selectedClassId]);

  const refreshPendingReviews = useCallback(async () => {
    setReviewsLoading(true);
    const query = selectedClassId ? `?class_id=${selectedClassId}` : '';
    const data = await safeFetch(`/api/teacher/quiz-reviews/pending${query}`);
    setPendingReviews(Array.isArray(data) ? data : []);
    setReviewsLoading(false);
  }, [selectedClassId]);

  useEffect(() => {
    if (activeTab === 'reviews') {
      refreshPendingReviews();
    }
  }, [activeTab, refreshPendingReviews]);

  const gradeReview = async (reviewId: number, awardedScore: number) => {
    await fetchWithAuth(`/api/teacher/quiz-reviews/${reviewId}/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ awarded_score: awardedScore }),
    });
    refreshPendingReviews();
  };

  const assignMissionToClassFromLibrary = async (missionId: number, classId: number) => {
    setLibraryAssigning({ missionId, classId });
    setLibraryAssignError(null);
    const mission = libraryMissions.find((m: Mission) => m.id === missionId);
    const cls = classes.find(c => c.id === classId);
    try {
      const res = await fetchWithAuth(`/api/classes/${classId}/missions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission_id: missionId })
      });
      if (res.ok && mission && cls) {
        setLibraryAssignFeedback({ missionTitle: mission.title, className: cls.name });
        setTimeout(() => setLibraryAssignFeedback(null), 2500);
      } else {
        const data = await res.json().catch(() => ({}));
        setLibraryAssignError(data.error || data.message || 'Could not assign activity to class.');
      }
    } finally {
      setLibraryAssigning(null);
    }
  };

  const accessMissionFromLibrary = (mission: Mission) => {
    localStorage.setItem(
      'mission_setup_draft',
      JSON.stringify({
        title: mission.title || '',
        sector_id: mission.sector_id || sectors[0]?.id || 1,
        description: mission.description || '',
        difficulty: mission.difficulty || 'Medium',
        grade_level: mission.grade_level || '',
        xp_reward: Number(mission.xp_reward || 500),
        embed_code: mission.embed_code || '',
      })
    );
    setLibraryAccessFeedback(`Opened "${mission.title}" in Activity Builder.`);
    setTimeout(() => setLibraryAccessFeedback(null), 2200);
    setActiveTab('missions');
  };

  const selectedClass = classes.find(c => c.id === selectedClassId) || null;
  const filteredLibraryMissions = useMemo(() => {
    return libraryMissions.filter((m) => {
      const matchesQuery =
        !libraryQuery.trim() ||
        m.title.toLowerCase().includes(libraryQuery.toLowerCase()) ||
        (m.description || '').toLowerCase().includes(libraryQuery.toLowerCase());
      const matchesSector = librarySectorFilter === 'all' || m.sector_id === librarySectorFilter;
      return matchesQuery && matchesSector;
    });
  }, [libraryMissions, libraryQuery, librarySectorFilter]);

  return (
    <div className="space-y-8">
      {/* Top class selector: everything below is scoped to this class where applicable */}
      <div className="mb-6 rounded-2xl border border-[var(--ca-outline-variant)] bg-[var(--ca-surface-container-low)] px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-black text-[var(--ca-on-surface-variant)] uppercase tracking-[0.14em]">Viewing class</span>
          <select
            value={selectedClassId ?? ''}
            onChange={e => setSelectedClassId(e.target.value ? parseInt(e.target.value) : null)}
            className="min-w-[170px] bg-[var(--ca-surface-container-lowest)] border border-[var(--ca-outline-variant)] rounded-xl px-4 py-2 text-sm font-black text-[var(--ca-on-surface)] uppercase tracking-tight outline-none focus:border-[var(--ca-secondary-container)]"
          >
            <option value="">Select a class…</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            {classes.length === 0 && <option disabled>No classrooms yet</option>}
          </select>
          {selectedClass && (
            <span className="text-[var(--ca-on-surface-variant)] text-xs font-medium">
              Analytics, reports, and assignments use this class.
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-10">
        {[
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'classroom', label: 'Classes', icon: Users },
          { id: 'library', label: 'Mission Library', icon: LayoutGrid },
          { id: 'missions', label: 'Create Activity', icon: Rocket },
          { id: 'reviews', label: 'Review Queue', icon: ClipboardList },
          { id: 'reports', label: 'Report Cards', icon: ClipboardList },
        ].map(tab => (
            <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.12em] transition-all border ${
              activeTab === tab.id 
                ? 'bg-[#0A192F] text-[var(--ca-secondary-container)] border-[#0A192F] shadow-md'
                : 'bg-[var(--ca-surface-container)] border-[var(--ca-outline-variant)] text-[var(--ca-on-surface)] hover:border-[var(--ca-secondary-container)] hover:bg-[var(--ca-surface-container-high)]'
            }`}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="rounded-3xl p-8 bg-[#0A192F] border border-amber-500/20 shadow-xl teacher-tactical">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
              <h3 className="text-2xl font-black flex items-center gap-3 text-white tracking-tight">
                <BarChart3 className="text-amber-500 size-6" />
                Subject Performance
              </h3>
              {selectedClass && (
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/30">
                  {selectedClass.name}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div className="relative w-64 h-64 mx-auto">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                  <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                  <circle cx="100" cy="100" r="50" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                  <path d="M 100,20 L 160,70 L 140,160 L 60,160 L 40,70 Z" stroke="rgba(251,191,36,0.7)" strokeWidth="1.5" fill="rgba(251,191,36,0.12)" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-4xl font-bold text-white">82%</span>
                  <span className="text-[10px] text-amber-500 uppercase tracking-widest">Aggregate</span>
                </div>
              </div>
              <div className="space-y-5">
                {[
                  { label: 'Robotics', value: 92 },
                  { label: 'Astrophysics', value: 65 },
                  { label: 'Bio-Engineering', value: 78 },
                ].map((skill) => (
                  <div key={skill.label} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">{skill.label}</span>
                      <span className="text-amber-500 font-bold">{skill.value}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400" style={{ width: `${skill.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-3xl p-8 bg-[#0A192F] border border-amber-500/20 shadow-xl teacher-tactical">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white text-xl font-bold">Recent Activity</h4>
              <span className="text-slate-400 text-sm">Latest updates</span>
            </div>
            <div className="space-y-3">
              {[
                'Tanaka completed Robotics Lab Level 4.',
                'Orion class submitted Mars Rover v2.',
                'Rodriguez requested help in Biology.',
              ].map((line, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5">
                  <span className="size-2 rounded-full bg-amber-500" />
                  <span className="text-amber-300/70 text-xs font-mono">{['14:22:01', '14:19:45', '14:15:12'][i]}</span>
                  <span className="text-slate-200 text-sm">{line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'classroom' && (
        <ClassroomManager teacherId={student.id} students={students} onStudentsAdded={refetchStudents} />
      )}

      {activeTab === 'library' && (
        <div className="space-y-6">
          <div className="rounded-xl bg-[#0A192F] border border-[#1B2B44] px-4 py-3 text-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs tracking-[0.16em] uppercase font-semibold">
              <span className="size-2 rounded-full bg-amber-400 inline-block" />
              Mission Library
            </div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-amber-100">
              {filteredLibraryMissions.length} Missions
            </div>
          </div>

          <div className="bg-[#0A192F] border border-[#1B2B44] rounded-xl px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-6">
              <h3 className="text-2xl font-bold text-amber-500 tracking-tight">MISSION LIBRARY</h3>
              <div className="relative w-full lg:w-80">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={libraryQuery}
                  onChange={(e) => setLibraryQuery(e.target.value)}
                  className="bg-[#1B2B44]/60 border border-[#1B2B44] text-slate-200 text-sm rounded-lg pl-10 pr-4 py-2 w-full focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="Search missions..."
                  type="text"
                />
              </div>
            </div>
          <div className="text-slate-300 text-xs">Use search and filters to find missions.</div>
          </div>

          {libraryAssignFeedback && (
            <p className="text-amber-700 text-sm font-bold">
              Assigned "{libraryAssignFeedback.missionTitle}" to {libraryAssignFeedback.className}.
            </p>
          )}
          {libraryAssignError && (
            <p className="text-rose-600 text-sm font-bold">{libraryAssignError}</p>
          )}
          {libraryAccessFeedback && (
            <p className="text-cyan-700 text-sm font-bold">{libraryAccessFeedback}</p>
          )}

          <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] font-black text-[var(--ca-secondary)]">Mission List</p>
              <h4 className="text-3xl font-bold text-[#0D1C32]">Available Missions</h4>
            </div>
            <div className="flex flex-wrap items-center gap-2 bg-[var(--ca-surface-container-low)] p-2 rounded-xl">
              <button
                type="button"
                onClick={() => setLibrarySectorFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm transition-all ${
                  librarySectorFilter === 'all' ? 'bg-[#0A192F] text-amber-500 font-bold' : 'text-[var(--ca-on-surface-variant)] hover:bg-[var(--ca-surface-variant)]'
                }`}
              >
                All Sectors
              </button>
              {sectors.slice(0, 3).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setLibrarySectorFilter(s.id)}
                  className={`px-4 py-2 rounded-lg text-sm transition-all ${
                    librarySectorFilter === s.id ? 'bg-[#0A192F] text-amber-500 font-bold' : 'text-[var(--ca-on-surface-variant)] hover:bg-[var(--ca-surface-variant)]'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {filteredLibraryMissions.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-slate-500">
              No activities yet. Create one in <strong>Create Activity</strong>.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredLibraryMissions.map((m: Mission, index: number) => {
                const sector = sectors.find(s => s.id === m.sector_id);
                const isAssigning = libraryAssigning?.missionId === m.id;
                const levelText = m.difficulty || 'Medium';
                const levelDots = levelText === 'Hard' ? 3 : levelText === 'Easy' ? 1 : 2;
                return (
                  <div
                    key={m.id}
                    onClick={() => accessMissionFromLibrary(m)}
                    className={`group rounded-xl overflow-hidden border transition-all cursor-pointer ${index === 0 ? 'md:col-span-2 bg-[#0A192F] border-[#1B2B44] text-white' : 'bg-white border-slate-100 shadow-[0px_4px_20px_rgba(10,25,47,0.05)]'}`}
                  >
                    <div className={`p-6 ${index === 0 ? '' : 'space-y-4'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${index === 0 ? 'bg-amber-500 text-[#0A192F]' : 'bg-amber-100 text-amber-700'}`}>
                          {sector?.name ?? 'Sector'}
                        </span>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Zap key={i} className={`size-3 ${i < levelDots ? 'text-amber-500' : index === 0 ? 'text-slate-500' : 'text-slate-300'}`} />
                          ))}
                          <span className={`text-xs ml-1 ${index === 0 ? 'text-slate-300' : 'text-slate-500'}`}>Level: {levelText}</span>
                        </div>
                      </div>

                      <div className={index === 0 ? 'mt-4 mb-5' : ''}>
                        <h5 className={`font-bold text-xl ${index === 0 ? 'text-white' : 'text-[#0D1C32] group-hover:text-amber-600 transition-colors'}`}>{m.title}</h5>
                        <p className={`mt-2 text-sm line-clamp-2 ${index === 0 ? 'text-slate-300' : 'text-[var(--ca-on-surface-variant)]'}`}>
                          {m.description || 'No mission details available yet.'}
                        </p>
                      </div>

                      {index === 0 && (
                        <div className="mb-5">
                          <div className="flex justify-between text-xs text-slate-400 mb-2">
                            <span>PROGRESS</span>
                            <span>{Math.min(96, Math.max(34, Math.round((m.xp_reward || 0) / 12)))}%</span>
                          </div>
                          <div className="h-2 w-full bg-[#1B2B44] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(96, Math.max(34, Math.round((m.xp_reward || 0) / 12)))}%`,
                                background: 'linear-gradient(90deg, #ffb204 0%, #ff8c00 100%)',
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className={`text-[11px] font-bold uppercase tracking-wider ${index === 0 ? 'text-amber-300' : 'text-slate-500'}`}>
                          +{m.xp_reward ?? 0} XP
                        </p>
                        <div className="flex items-center gap-2">
                          <select
                            value=""
                            onChange={e => {
                              e.stopPropagation();
                              const classId = e.target.value ? parseInt(e.target.value, 10) : 0;
                              if (classId) assignMissionToClassFromLibrary(m.id, classId);
                              e.target.value = '';
                            }}
                            disabled={isAssigning || classes.length === 0}
                            className={`${index === 0 ? 'bg-[#1B2B44] border-[#1B2B44] text-slate-100' : 'bg-white border-slate-300 text-slate-700'} border rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-amber-500 disabled:opacity-60`}
                          >
                            <option value="">Assign to class...</option>
                            {classes.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              accessMissionFromLibrary(m);
                            }}
                            disabled={isAssigning}
                            className={`${index === 0 ? 'bg-amber-500 text-[#0A192F] hover:bg-amber-400' : 'bg-[#0A192F] text-white hover:bg-[var(--ca-secondary-container)] hover:text-[var(--ca-on-secondary-fixed)]'} px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50`}
                          >
                            Access
                            <ChevronRight className="size-4" />
                          </button>
                        </div>
                        {isAssigning && <span className="text-[10px] text-amber-500 font-bold">Assigning...</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'missions' && (
        <MissionSetup sectors={sectors} canEmbed={false} assignClassId={selectedClassId} />
      )}

      {activeTab === 'reviews' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-500/30 bg-[#0A192F] p-6 text-slate-100">
            <h3 className="text-2xl font-bold text-amber-400">Short-Answer Review Queue</h3>
            <p className="text-slate-300 text-sm mt-1">
              Objective questions are auto-marked instantly. Only short-answer responses appear here for quick teacher checking.
            </p>
          </div>
          {reviewsLoading ? (
            <p className="text-slate-400 text-sm">Loading pending responses…</p>
          ) : pendingReviews.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-slate-500">
              No pending short-answer reviews for this class.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingReviews.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <p className="text-sm font-black text-[#0D1C32] uppercase tracking-tight">
                      {r.quiz_title} · Q{r.question_index + 1}
                    </p>
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">
                      {r.student_name} · {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 font-semibold mb-2">{r.prompt || 'Short answer question'}</p>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-800 text-sm mb-4">
                    {r.response_text || <span className="text-slate-400 italic">No response submitted</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => gradeReview(r.id, Math.max(1, Number(r.max_score || 1)))}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-black uppercase tracking-wider hover:bg-emerald-500"
                    >
                      ✓ Correct
                    </button>
                    <button
                      type="button"
                      onClick={() => gradeReview(r.id, 0)}
                      className="px-4 py-2 rounded-lg bg-slate-800 text-slate-100 text-xs font-black uppercase tracking-wider hover:bg-slate-700"
                    >
                      Mark incorrect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          {selectedClassId && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h4 className="text-lg font-bold text-[#0D1C32] mb-3">Quiz Scores (by student)</h4>
              {reportPreview.length === 0 ? (
                <p className="text-sm text-slate-500">No student quiz scores yet for this class.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="py-2 pr-2">Student</th>
                        <th className="py-2 pr-2">Quizzes completed</th>
                        <th className="py-2">Average score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportPreview.map((row: any) => (
                        <tr key={row.id} className="border-b border-slate-100">
                          <td className="py-2 pr-2 font-semibold text-[#0D1C32]">{row.name}</td>
                          <td className="py-2 pr-2 font-mono text-slate-700">{Number(row.quizzes_completed || 0)}</td>
                          <td className="py-2 font-mono text-slate-700">{Math.round(Number(row.avg_quiz_score || 0))}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {selectedClassId ? (
            <ReportCard classId={selectedClassId} />
          ) : (
            <div className="bg-slate-900/50 backdrop-blur-md p-20 rounded-3xl border border-slate-800 text-center">
              <Users className="size-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-mono text-sm italic">Select a class from the dropdown above to view report cards.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ClassroomManager = ({ teacherId, students, onStudentsAdded }: { teacherId: number, students: Student[], onStudentsAdded?: () => void }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [assignedMissions, setAssignedMissions] = useState<Mission[]>([]);
  const [allChallenges, setAllChallenges] = useState<{ id: number; title: string; type: string }[]>([]);
  const [assignedChallenges, setAssignedChallenges] = useState<{ id: number; title: string; type: string }[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ studentId: number; message: string } | null>(null);
  const [copyCodeFeedback, setCopyCodeFeedback] = useState(false);
  const [pasteNames, setPasteNames] = useState('');
  const [importingRoster, setImportingRoster] = useState(false);
  const [pasteResult, setPasteResult] = useState<{ added: number; created: string[]; error?: string } | null>(null);
  const [pasteLoading, setPasteLoading] = useState(false);
  const [generateCodeLoading, setGenerateCodeLoading] = useState(false);
  const [generateCodeError, setGenerateCodeError] = useState<string | null>(null);
  const [classesLoadError, setClassesLoadError] = useState<string | null>(null);
  const [assigningMissionId, setAssigningMissionId] = useState<number | null>(null);
  const [assigningChallengeId, setAssigningChallengeId] = useState<number | null>(null);
  const [curriculumDraft, setCurriculumDraft] = useState('');
  const [savingCurriculum, setSavingCurriculum] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  const CURRICULUM_TRACK_OPTIONS = [
    'Robotics',
    'AI',
    'Science',
    'Mathematics',
    '3D Modelling and Printing',
    'Electricity and Electronics',
    'FinTech',
    'Space Tech',
    'Health Tech',
    'Game Dev',
    'Web Dev',
    'App Dev',
  ];

  const fetchClasses = async (): Promise<Class[]> => {
    setClassesLoadError(null);
    const res = await fetchWithAuth('/api/classes');
    let list: Class[] = [];
    if (res.ok) {
      const data = await res.json().catch(() => null);
      list = (data && Array.isArray(data) ? data : []) as Class[];
    } else {
      setClassesLoadError(res.status === 401 ? 'Please log in again.' : 'Could not load classrooms. Try refreshing.');
    }
    setClasses(list);
    const missionsData = await safeFetch('/api/missions');
    if (missionsData) setMissions(missionsData);
    const challengesData = await safeFetch('/api/challenges');
    if (challengesData) setAllChallenges(Array.isArray(challengesData) ? challengesData : []);
    setLoading(false);
    return list;
  };

  const fetchClassContent = async (classId: number) => {
    const data = await safeFetch(`/api/classes/${classId}/content`);
    if (data) {
      setAssignedMissions(data.missions || []);
      setAssignedChallenges(data.challenges || []);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  // When a class is selected, ensure we have join_code (fetch or generate)
  useEffect(() => {
    if (!selectedClass?.id) return;
    const current = classes.find(c => c.id === selectedClass.id) || selectedClass;
    if (current?.join_code) return;
    (async () => {
      const data = await safeFetch(`/api/classes/${selectedClass.id}`);
      if (data?.join_code != null) {
        setClasses(prev => prev.map(c => c.id === selectedClass.id ? { ...c, join_code: data.join_code } : c));
        return;
      }
      const res = await fetchWithAuth('/api/classes/ensure-join-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_id: selectedClass.id })
      });
      const json = await res.json().catch(() => ({}));
      if (json.join_code)
        setClasses(prev => prev.map(c => c.id === selectedClass.id ? { ...c, join_code: json.join_code } : c));
    })();
  }, [selectedClass?.id]);

  useEffect(() => {
    setCurriculumDraft(selectedClass?.curriculum_track || '');
    setAssignmentError(null);
  }, [selectedClass?.id, selectedClass?.curriculum_track]);

  const createClass = async () => {
    if (!newClassName.trim()) return;
    setCreateError(null);
    setCreating(true);
    try {
      const res = await fetchWithAuth('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClassName.trim(), teacher_id: teacherId, description: '' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(data.error || data.message || 'Failed to create class');
        return;
      }
      const name = newClassName.trim();
      setNewClassName('');
      const list = await fetchClasses();
      const newId = typeof data.id === 'number' ? data.id : Number(data.id);
      const newClass = list.find(c => c.id === newId) || {
        id: newId,
        name,
        teacher_id: teacherId,
        description: '',
        join_code: data.join_code ?? undefined,
        student_count: 0
      };
      setSelectedClass(newClass);
      fetchClassContent(newId);
    } finally {
      setCreating(false);
    }
  };

  const copyJoinCodeToClipboard = (code: string) => {
    const doCopy = (text: string) => {
      try {
        const input = document.createElement('input');
        input.value = text;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        return true;
      } catch {
        return false;
      }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        setCopyCodeFeedback(true);
        setTimeout(() => setCopyCodeFeedback(false), 2000);
      }).catch(() => {
        if (doCopy(code)) { setCopyCodeFeedback(true); setTimeout(() => setCopyCodeFeedback(false), 2000); }
      });
    } else {
      if (doCopy(code)) { setCopyCodeFeedback(true); setTimeout(() => setCopyCodeFeedback(false), 2000); }
    }
  };

  const addStudentsByNames = async () => {
    if (!selectedClass || !pasteNames.trim()) return;
    // Accept names separated by newlines or commas
    const names = pasteNames
      .split(/[\n,]+/)
      .map(n => n.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    setPasteLoading(true);
    setPasteResult(null);
    try {
      const res = await fetchWithAuth('/api/classes/add-students-by-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_id: selectedClass.id, names })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPasteResult({ added: data.added ?? 0, created: data.created ?? [] });
        setPasteNames('');
        await fetchClasses();
        onStudentsAdded?.();
      } else {
        setPasteResult({ added: 0, created: [], error: data.error || data.message || `Request failed (${res.status})` });
      }
    } catch (e: any) {
      setPasteResult({ added: 0, created: [], error: e?.message || 'Network error' });
    } finally {
      setPasteLoading(false);
    }
  };

  const importStudentsFromFile = async (file: File) => {
    if (!selectedClass) return;
    setImportingRoster(true);
    setPasteResult(null);
    try {
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      let extractedNames: string[] = [];
      if (isCsv) {
        const text = await file.text();
        extractedNames = text
          .split(/\r?\n/)
          .map((line) => line.split(',')[0]?.trim() || '')
          .filter(Boolean);
      } else {
        const XLSX = await import('xlsx');
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const firstSheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
        extractedNames = rows
          .map((row) => {
            const values = Object.values(row).map((v) => String(v || '').trim()).filter(Boolean);
            return values[0] || '';
          })
          .filter(Boolean);
      }
      const cleanNames = [...new Set(extractedNames.map((n) => n.trim()).filter(Boolean))].slice(0, 500);
      if (cleanNames.length === 0) {
        setPasteResult({ added: 0, created: [], error: 'No student names found in file.' });
        return;
      }
      const res = await fetchWithAuth('/api/classes/add-students-by-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_id: selectedClass.id, names: cleanNames }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPasteResult({ added: 0, created: [], error: data.error || data.message || `Request failed (${res.status})` });
        return;
      }
      setPasteResult({ added: data.added ?? 0, created: data.created ?? [] });
      await fetchClasses();
      onStudentsAdded?.();
    } catch (e: any) {
      setPasteResult({ added: 0, created: [], error: e?.message || 'Could not parse file.' });
    } finally {
      setImportingRoster(false);
    }
  };

  const addStudentToClass = async (studentId: number) => {
    if (!selectedClass) return;
    setSyncFeedback(null);
    try {
      const res = await fetchWithAuth(`/api/classes/${selectedClass.id}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncFeedback({ studentId, message: data.error || data.message || 'Failed to add' });
        return;
      }
      setSyncFeedback({ studentId, message: 'Added!' });
      setTimeout(() => setSyncFeedback(null), 2000);
      await fetchClasses();
    } catch {
      setSyncFeedback({ studentId, message: 'Network error' });
    }
  };

  const assignMissionToClass = async (missionId: number) => {
    if (!selectedClass) return;
    setAssignmentError(null);
    setAssigningMissionId(missionId);
    try {
      const res = await fetchWithAuth(`/api/classes/${selectedClass.id}/missions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission_id: missionId })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAssignmentError(data.error || data.message || 'Could not assign mission.');
        return;
      }
      fetchClassContent(selectedClass.id);
    } finally {
      setAssigningMissionId(null);
    }
  };

  const assignQuizToClass = async (quizId: number) => {
    if (!selectedClass) return;
    setAssignmentError(null);
    const res = await fetchWithAuth(`/api/classes/${selectedClass.id}/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz_id: quizId })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setAssignmentError(data.error || data.message || 'Could not assign quiz.');
      return;
    }
    fetchClassContent(selectedClass.id);
  };

  const unassignMissionFromClass = async (missionId: number) => {
    if (!selectedClass) return;
    await fetchWithAuth(`/api/classes/${selectedClass.id}/missions/${missionId}`, {
      method: 'DELETE',
    });
    fetchClassContent(selectedClass.id);
  };

  const assignChallengeToClass = async (challengeId: number) => {
    if (!selectedClass) return;
    setAssignmentError(null);
    setAssigningChallengeId(challengeId);
    try {
      const res = await fetchWithAuth(`/api/classes/${selectedClass.id}/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAssignmentError(data.error || data.message || 'Could not assign challenge.');
        return;
      }
      fetchClassContent(selectedClass.id);
    } finally {
      setAssigningChallengeId(null);
    }
  };

  const saveCurriculumTrack = async () => {
    if (!selectedClass || !curriculumDraft.trim()) return;
    setSavingCurriculum(true);
    setAssignmentError(null);
    try {
      const res = await fetchWithAuth(`/api/classes/${selectedClass.id}/curriculum`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curriculum_track: curriculumDraft.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAssignmentError(data.error || data.message || 'Could not save curriculum track.');
        return;
      }
      setClasses((prev) => prev.map((c) => (c.id === selectedClass.id ? { ...c, curriculum_track: curriculumDraft.trim() } : c)));
      setSelectedClass((prev) => (prev && prev.id === selectedClass.id ? { ...prev, curriculum_track: curriculumDraft.trim() } : prev));
    } finally {
      setSavingCurriculum(false);
    }
  };

  const unassignChallengeFromClass = async (challengeId: number) => {
    if (!selectedClass) return;
    await fetchWithAuth(`/api/classes/${selectedClass.id}/challenges/${challengeId}`, {
      method: 'DELETE',
    });
    fetchClassContent(selectedClass.id);
  };

  return (
    <div className="space-y-10">
      <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 teacher-tactical">
        <div className="flex items-center gap-3">
          <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-400">System Status</span>
          <span className="text-[10px] font-mono text-slate-400">Online</span>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400">
          <span className="hover:text-amber-400 cursor-default">Logs</span>
          <span className="text-amber-500 font-bold">v2.1</span>
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm teacher-tactical">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="size-5 text-amber-500" />
          <h3 className="text-2xl font-semibold text-slate-900">Create Class</h3>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex gap-4">
            <input 
              type="text" 
              value={newClassName}
              onChange={e => { setNewClassName(e.target.value); setCreateError(null); }}
              placeholder="Class name (e.g. Physics Alpha)"
              className="flex-1 bg-white border border-slate-300 rounded px-4 py-3 focus:ring-amber-500 focus:border-amber-500 text-slate-900 font-medium"
            />
            <button 
              onClick={createClass}
              disabled={creating}
              className="bg-slate-900 text-amber-500 px-6 py-3 rounded font-black uppercase tracking-wider hover:bg-slate-800 transition-colors border border-amber-500/20 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating…' : 'Initialize'}
            </button>
          </div>
          {createError && (
            <p className="text-rose-400 text-sm font-medium">{createError}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">

        {selectedClass && (() => {
          const currentClass = classes.find(c => c.id === selectedClass.id) || selectedClass;
          return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-8"
          >
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
              <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-2">Curriculum track (required before deployment)</p>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={curriculumDraft}
                  onChange={(e) => setCurriculumDraft(e.target.value)}
                  className="min-w-[260px] bg-white border border-indigo-200 rounded px-3 py-2 text-sm text-slate-800"
                >
                  <option value="">Select a curriculum track</option>
                  {CURRICULUM_TRACK_OPTIONS.map((track) => (
                    <option key={track} value={track}>
                      {track}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={saveCurriculumTrack}
                  disabled={savingCurriculum || !curriculumDraft.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-700 text-white font-black text-xs uppercase tracking-widest disabled:opacity-60"
                >
                  {savingCurriculum ? 'Saving…' : 'Set Track'}
                </button>
                {currentClass.curriculum_track && (
                  <span className="text-[11px] font-black text-indigo-700 uppercase tracking-wider">
                    Active: {currentClass.curriculum_track}
                  </span>
                )}
              </div>
              <p className="text-slate-600 text-xs mt-2">Deployment unlocks after a curriculum track is selected.</p>
            </div>

            {/* Class join code – always visible, never masked */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Class join code – share with students</p>
              <div className="flex items-center gap-4 flex-wrap">
                <code className="text-2xl font-mono font-black text-amber-600 tracking-[0.2em] select-all bg-white border border-slate-200 px-3 py-2 rounded-xl" title="Class code – select and copy if needed">
                  {currentClass.join_code ?? '—'}
                </code>
                {currentClass.join_code ? (
                  <button
                    type="button"
                    onClick={() => copyJoinCodeToClipboard(currentClass.join_code!)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                      copyCodeFeedback
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-amber-500 hover:bg-slate-800'
                    }`}
                  >
                    {copyCodeFeedback ? <><CheckCircle2 className="size-4" /> Copied to clipboard</> : <><Copy className="size-4" /> Copy code</>}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={generateCodeLoading}
                      onClick={async () => {
                        setGenerateCodeError(null);
                        setGenerateCodeLoading(true);
                        try {
                          const res = await fetchWithAuth('/api/classes/ensure-join-code', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ class_id: selectedClass.id })
                          });
                          const json = await res.json().catch(() => ({}));
                          if (res.ok && json.join_code) {
                            const code = json.join_code;
                            setClasses(prev => prev.map(c => c.id === selectedClass.id ? { ...c, join_code: code } : c));
                            setSelectedClass(prev => prev && prev.id === selectedClass.id ? { ...prev, join_code: code } : prev);
                          } else {
                            setGenerateCodeError(json.error || json.message || `Could not generate code (${res.status})`);
                          }
                        } catch {
                          setGenerateCodeError('Network error');
                        } finally {
                          setGenerateCodeLoading(false);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-slate-900 border border-amber-500 font-black text-xs uppercase disabled:opacity-60"
                    >
                      {generateCodeLoading ? 'Generating…' : 'Generate code'}
                    </button>
                    {generateCodeError && <span className="text-rose-400 text-xs">{generateCodeError}</span>}
                  </>
                )}
              </div>
              <p className="text-slate-500 text-xs mt-2">Students enter this code in Squad → My Classes → Join with code.</p>
            </div>

            {/* Add many students by pasting names (one per line); create accounts if needed */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Add students by name list</p>
              <p className="text-slate-500 text-xs mb-3">Paste one name per line. New accounts are created for any name that doesn’t exist (default password: password123).</p>
              <textarea
                value={pasteNames}
                onChange={e => { setPasteNames(e.target.value); setPasteResult(null); }}
                placeholder={'Paste names (one per line or comma-separated)\ne.g. Alice Smith, Bob Jones\nCharlie Lee'}
                rows={4}
                className="w-full bg-white border border-slate-300 rounded px-4 py-3 text-slate-900 text-sm font-mono placeholder:text-slate-500 outline-none focus:border-amber-500 resize-y"
              />
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <button
                  type="button"
                  onClick={addStudentsByNames}
                  disabled={pasteLoading || !pasteNames.trim()}
                  className="px-4 py-2 rounded bg-slate-900 text-amber-500 font-black text-xs uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all"
                >
                  {pasteLoading ? 'Adding…' : 'Add to class'}
                </button>
                {pasteResult && (
                  <span className="text-sm">
                    {pasteResult.error ? (
                      <span className="text-rose-400">{pasteResult.error}</span>
                    ) : (
                      <>
                        <span className="text-amber-700 font-black">Added {pasteResult.added} to class</span>
                        {pasteResult.created.length > 0 && (
                          <span className="text-slate-600 ml-2"> · Created {pasteResult.created.length} new account(s); default password: password123</span>
                        )}
                      </>
                    )}
                  </span>
                )}
              </div>
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-3">
                <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-2">Or upload roster (CSV/XLSX)</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="px-3 py-2 rounded bg-slate-900 text-amber-500 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-800">
                    {importingRoster ? 'Importing…' : 'Choose file'}
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void importStudentsFromFile(file);
                        e.currentTarget.value = '';
                      }}
                      disabled={importingRoster}
                    />
                  </label>
                  <span className="text-[11px] text-slate-500">Use first column for student names. Supports 500 rows per upload.</span>
                </div>
              </div>
            </div>

                <h3 className="text-xl font-semibold text-slate-900 mb-2">
              Add Students: {currentClass.name}
            </h3>
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-4 custom-scrollbar">
              {students.filter(s => s.role === 'student').map(s => {
                const feedback = syncFeedback?.studentId === s.id ? syncFeedback.message : null;
                return (
                <div key={s.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl group hover:border-amber-300 transition-all">
                  <div className="flex items-center gap-4">
                    <img src={s.avatar_url} className="size-12 rounded-xl object-cover border border-slate-200" alt="" referrerPolicy="no-referrer" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{s.name}</p>
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">Lvl {s.level} Operator</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {feedback && (
                      <span className={`text-[10px] font-black uppercase ${feedback === 'Added!' ? 'text-amber-600' : 'text-rose-400'}`}>
                        {feedback}
                      </span>
                    )}
                    <button 
                      onClick={() => addStudentToClass(s.id)}
                      className="px-4 py-2 bg-slate-900 text-amber-500 rounded text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all border border-amber-500/20"
                    >
                      Add
                    </button>
                  </div>
                </div>
              );})}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-200">
              {!currentClass.curriculum_track && (
                <div className="md:col-span-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                  Select a curriculum track first to unlock mission/challenge/quiz deployment.
                </div>
              )}
              <div>
                <h4 className="text-sm font-black text-slate-700 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Rocket className="size-4 text-amber-600" />
                  Assign Missions
                </h4>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {missions.map(m => (
                    (() => {
                      const isAssigned = assignedMissions.some(am => am.id === m.id);
                      const isAssigning = assigningMissionId === m.id;
                      return (
                    <button
                      key={m.id}
                      onClick={() => assignMissionToClass(m.id)}
                      disabled={isAssigned || isAssigning || !currentClass.curriculum_track}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left text-xs font-bold transition-all ${
                        isAssigned
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 cursor-default'
                          : isAssigning
                            ? 'border-amber-300 bg-amber-50 text-amber-800 cursor-wait'
                            : 'border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50'
                      }`}
                    >
                      <span className="text-slate-700 line-clamp-1">{m.title}</span>
                      <span className={`text-[9px] uppercase tracking-widest ${
                        isAssigned ? 'text-emerald-700' : isAssigning ? 'text-amber-700' : 'text-amber-700'
                      }`}>
                        {isAssigned ? 'Assigned' : isAssigning ? 'Assigning...' : 'Assign'}
                      </span>
                    </button>
                      );
                    })()
                  ))}
                  {missions.length === 0 && (
                    <p className="text-slate-500 text-xs italic">No missions created yet.</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-black text-slate-700 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Layers className="size-4 text-amber-600" />
                  Assign Quizzes / Challenges
                </h4>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {allChallenges.map(ch => (
                    (() => {
                      const isAssigned = assignedChallenges.some(ac => ac.id === ch.id);
                      const isAssigning = assigningChallengeId === ch.id;
                      return (
                    <button
                      key={ch.id}
                      onClick={() => assignChallengeToClass(ch.id)}
                      disabled={isAssigned || isAssigning || !currentClass.curriculum_track}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left text-xs font-bold transition-all ${
                        isAssigned
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 cursor-default'
                          : isAssigning
                            ? 'border-amber-300 bg-amber-50 text-amber-800 cursor-wait'
                            : 'border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50'
                      }`}
                    >
                      <span className="text-slate-700 line-clamp-1">{ch.title}</span>
                      <span className={`text-[9px] uppercase tracking-widest ${
                        isAssigned ? 'text-emerald-700' : isAssigning ? 'text-amber-700' : 'text-amber-700'
                      }`}>
                        {isAssigned ? 'Assigned' : isAssigning ? 'Assigning...' : 'Assign'}
                      </span>
                    </button>
                      );
                    })()
                  ))}
                  {allChallenges.length === 0 && (
                    <p className="text-slate-500 text-xs italic">No challenges yet. Create them in Challenges.</p>
                  )}
                </div>
              </div>
            </div>
            {assignmentError && <p className="text-rose-500 text-xs font-semibold">{assignmentError}</p>}

            <div className="pt-6 border-t border-slate-200">
              <h4 className="text-sm font-black text-slate-700 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                <Rocket className="size-4 text-amber-600" />
                Assigned Missions
              </h4>
              <div className="flex flex-wrap gap-2 mb-6">
                {assignedMissions.length === 0 && (
                  <p className="text-[11px] text-slate-500 italic">No missions assigned to this squad yet.</p>
                )}
                {assignedMissions.map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-black text-amber-700">
                    <span className="truncate max-w-[140px]">{m.title}</span>
                    <button
                      onClick={() => unassignMissionFromClass(m.id)}
                      className="text-[10px] text-slate-500 hover:text-red-500 ml-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <h4 className="text-sm font-black text-slate-700 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                <Layers className="size-4 text-amber-600" />
                Assigned Quizzes &amp; Challenges
              </h4>
              <div className="flex flex-wrap gap-2">
                {assignedChallenges.length === 0 && (
                  <p className="text-[11px] text-slate-500 italic">No interactive challenges assigned yet.</p>
                )}
                {assignedChallenges.map(c => (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-black text-slate-700">
                    <span className="truncate max-w-[140px]">{c.title}</span>
                    <button
                      onClick={() => unassignChallengeFromClass(c.id)}
                      className="text-[10px] text-slate-500 hover:text-red-500 ml-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
          ); })()}

          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Users className="size-5 text-amber-500" />
                <h3 className="text-2xl font-semibold text-slate-900">Active Classes</h3>
              </div>
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Manifest Parser v4.2</span>
            </div>
            {classesLoadError && (
              <p className="text-rose-400 text-sm font-medium mb-4">{classesLoadError}</p>
            )}
            {loading ? (
              <p className="text-slate-400 text-sm">Loading…</p>
            ) : (
              <div className="space-y-3">
                {classes.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedClass(c);
                      fetchClassContent(c.id);
                    }}
                    className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all relative overflow-hidden group ${
                      selectedClass?.id === c.id
                        ? 'bg-slate-900 text-amber-500 border-slate-900 shadow-md'
                        : 'bg-white border-slate-200 hover:border-amber-400'
                    }`}
                  >
                    <div className="text-left relative z-10">
                      <p className="font-bold text-slate-900 text-sm">{c.name}</p>
                      <p className={`text-[9px] uppercase font-black tracking-widest mt-1 ${
                        selectedClass?.id === c.id ? 'text-amber-300' : 'text-slate-500'
                      }`}>
                        {c.student_count} Crew Members
                      </p>
                    </div>
                    <ChevronRight className={`size-6 relative z-10 transition-transform group-hover:translate-x-1 ${
                      selectedClass?.id === c.id ? 'text-amber-300' : 'text-slate-400'
                    }`} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
const STUDENT_SKIPPED_JOIN_KEY = 'stemverse_student_skipped_join';

const StudentDashboard = ({ student, onOpenSettings, setActiveView }: { student: Student; onOpenSettings?: () => void; setActiveView?: (v: string) => void }) => {
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
    { label: 'Email', value: student.email || '—' },
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
            <h2 className="text-5xl font-black text-slate-100 uppercase tracking-tighter mb-4 italic">{student.name}</h2>
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
                onClick={() => setActiveView?.('dashboard')}
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
const ReportCard = ({ classId }: { classId: number }) => {
  const [report, setReport] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingStudentId, setExportingStudentId] = useState<number | null>(null);

  useEffect(() => {
    safeFetch(`/api/report-card/${classId}`).then(data => {
      if (Array.isArray(data)) {
        setReport(data);
      }
    });
  }, [classId]);

  useEffect(() => {
    if (!selectedStudent && report.length > 0) {
      setSelectedStudent(report[0]);
    }
  }, [report, selectedStudent]);

  const exportStudentPdf = async (studentData: any) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 48;
    const maxTextWidth = pageWidth - margin * 2;
    let y = 56;

    const line = (label: string, value: string, gap = 20) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(label.toUpperCase(), margin, y);
      y += 16;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      const wrapped = doc.splitTextToSize(value || '—', maxTextWidth);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 16 + gap;
    };

    doc.setFillColor(13, 28, 50);
    doc.rect(0, 0, pageWidth, 90, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('STEMverse Report Card', margin, 46);
    doc.setFontSize(12);
    doc.text(String(studentData?.name || 'Student'), margin, 68);
    doc.setTextColor(15, 23, 42);
    y = 120;

    line('Level', `Level ${studentData?.level ?? '—'}`, 14);
    line('Average Quiz Score', `${Math.round(Number(studentData?.avg_quiz_score || 0))}%`, 14);
    line('Quizzes Completed', String(studentData?.quizzes_completed ?? 0), 14);
    line(
      'Mastery Domains',
      Array.isArray(studentData?.mastery_domains) && studentData.mastery_domains.length
        ? studentData.mastery_domains.join(', ')
        : 'No mastery domains available',
      14
    );
    line(
      'Skills Learned',
      Array.isArray(studentData?.skills_learned) && studentData.skills_learned.length
        ? studentData.skills_learned.join(', ')
        : 'No skills recorded',
      14
    );
    line('Teacher Assessment', String(studentData?.ai_assessment || 'No AI assessment generated yet.'), 0);

    doc.save(`${String(studentData?.name || 'student').replace(/\s+/g, '_')}_report_card.pdf`);
  };

  const handleDownloadSquad = async () => {
    if (!report.length) return;
    setExportingAll(true);
    try {
      for (const s of report) {
        await exportStudentPdf(s);
      }
    } finally {
      setExportingAll(false);
    }
  };

  const handleDownloadStudent = async (student: any) => {
    setSelectedStudent(student);
    setExportingStudentId(Number(student?.id || 0));
    try {
      await exportStudentPdf(student);
    } finally {
      setExportingStudentId(null);
    }
  };

  const activeStudent = selectedStudent || report[0] || null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h3 className="text-4xl font-bold text-[#0D1C32] tracking-tight">Report Cards</h3>
          <p className="text-[var(--ca-on-primary-container)] max-w-2xl">
            View progress summaries for each student in this class.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDownloadSquad}
            disabled={exportingAll || report.length === 0}
            className="flex items-center gap-2 px-5 py-3 border-2 border-[#0D1C32] rounded-lg font-bold text-[#0D1C32] hover:bg-slate-100 transition-colors"
          >
            <Download className="size-4" />
            {exportingAll ? 'Exporting PDFs…' : 'Export All PDFs'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-[var(--ca-surface-container-lowest)] p-6 rounded-xl border border-slate-100 shadow-[0px_4px_20px_rgba(10,25,47,0.05)]">
            <h4 className="text-2xl font-semibold text-[#0D1C32] mb-5 flex items-center gap-2">
              <Users className="size-5 text-amber-500" />
              Students
            </h4>
            <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
              {report.map((r) => {
                const isActive = activeStudent?.id === r.id;
                const initials = String(r.name || 'ST')
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedStudent(r)}
                    className={`w-full text-left flex items-center p-4 rounded-xl border transition-colors ${
                      isActive
                        ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white hover:border-amber-400/50'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold ${
                      isActive ? 'bg-amber-500 text-[#0A192F]' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {initials}
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                      <p className="font-bold text-[#0D1C32] truncate">{r.name}</p>
                      <p className="text-xs text-slate-500">Rank: Level {r.level}</p>
                    </div>
                    {isActive ? <CheckCircle2 className="size-4 text-amber-500" /> : null}
                  </button>
                );
              })}
              {report.length === 0 && (
                <div className="p-4 rounded-xl border border-slate-200 text-sm text-slate-500">
                  No report data yet for this class.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-[0px_4px_20px_rgba(10,25,47,0.05)] min-h-[700px] flex flex-col">
            {activeStudent ? (
              <>
                <div className="flex justify-between items-start mb-8 gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl border-2 border-amber-500 p-1">
                      <div className="w-full h-full rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 text-xl font-black">
                        {String(activeStudent.name || 'ST')
                          .split(' ')
                          .map((n: string) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <p className="text-amber-500 text-[11px] uppercase tracking-[0.2em] font-black mb-1">
                        Student Progress
                      </p>
                      <h4 className="text-3xl font-bold text-[#0D1C32] leading-tight">{activeStudent.name}</h4>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className="bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full text-xs font-bold border border-amber-500/30">
                          LEVEL {activeStudent.level}
                        </span>
                        <span className="bg-blue-500/20 text-blue-200 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/30">
                          SYNC {Math.round(activeStudent.avg_quiz_score || 0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-600 text-xs font-mono uppercase tracking-wider">Cycle 04</p>
                    <p className="text-slate-500 text-xs font-mono uppercase tracking-wider">Q3 Report</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-bold tracking-wider text-slate-600 mb-2">TOTAL XP GAINED</p>
                    <p className="text-2xl font-bold text-[#0D1C32] mb-2">{(activeStudent.level || 1) * 320}</p>
                    <div className="h-2 bg-[#1B2B44] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--ca-secondary-container)] to-amber-500"
                        style={{ width: `${Math.min(100, Math.max(15, Math.round(activeStudent.avg_quiz_score || 0)))}%` }}
                      />
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-bold tracking-wider text-slate-600 mb-2">CORE COMPETENCIES</p>
                    <div className="space-y-1 text-sm">
                      {(activeStudent.mastery_domains || []).slice(0, 3).map((d: string) => (
                        <div key={d} className="flex items-center justify-between">
                          <span className="text-slate-200">{d}</span>
                          <span className="text-amber-300 font-mono text-xs">MASTER</span>
                        </div>
                      ))}
                      {(activeStudent.mastery_domains || []).length === 0 && (
                        <p className="text-slate-400 text-xs">No mastery domains available.</p>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-bold tracking-wider text-slate-600 mb-2">MERIT BADGES</p>
                    <div className="flex flex-wrap gap-2">
                      {(activeStudent.skills_learned || []).slice(0, 4).map((s: string) => (
                        <span key={s} className="px-2 py-1 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] uppercase tracking-wide font-bold">
                          {s}
                        </span>
                      ))}
                      {(activeStudent.skills_learned || []).length === 0 && (
                        <span className="text-slate-400 text-xs">No badges unlocked.</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1">
                  <p className="text-amber-500 text-[11px] uppercase tracking-[0.2em] font-black mb-3">
                    Mission Master Evaluation
                  </p>
                  <div className="bg-slate-50 border border-slate-200 border-l-4 border-l-amber-500 p-5 rounded-r-xl text-slate-700 leading-relaxed">
                    {activeStudent.ai_assessment || 'No AI assessment generated for this student yet.'}
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-200 flex justify-between items-center flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-amber-500" />
                    <span className="text-slate-600 text-sm">Reviewed by teacher</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedStudent(activeStudent)}
                      className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 hover:bg-amber-500/30"
                      aria-label="Share report"
                    >
                      <Share2 className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadStudent(activeStudent)}
                      disabled={exportingStudentId === Number(activeStudent.id)}
                      className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 hover:bg-amber-500/30"
                      aria-label="Print report"
                    >
                      <Printer className="size-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="relative z-10 flex flex-col items-center justify-center h-full text-center py-20">
                <ClipboardList className="size-10 text-amber-400 mb-3" />
                <p className="text-slate-300">Select a squad member to preview their report card.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
function toEmbeddableUrl(rawUrl: string): string {
  const url = rawUrl.trim();
  // YouTube: watch?v= -> /embed/
  const ytWatch = url.match(/^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([^&]+).*/i);
  if (ytWatch?.[1]) return `https://www.youtube.com/embed/${encodeURIComponent(ytWatch[1])}`;
  const ytShort = url.match(/^https?:\/\/youtu\.be\/([^?&/]+).*/i);
  if (ytShort?.[1]) return `https://www.youtube.com/embed/${encodeURIComponent(ytShort[1])}`;

  // Vimeo: vimeo.com/<id> -> player.vimeo.com/video/<id>
  const vimeo = url.match(/^https?:\/\/(?:www\.)?vimeo\.com\/(\d+).*/i);
  if (vimeo?.[1]) return `https://player.vimeo.com/video/${encodeURIComponent(vimeo[1])}`;

  // Scratch: scratch.mit.edu/projects/<id>/ -> embed
  const scratch = url.match(/^https?:\/\/scratch\.mit\.edu\/projects\/(\d+)\/?/i);
  if (scratch?.[1]) return `https://scratch.mit.edu/projects/${scratch[1]}/embed`;

  return url;
}

/** Normalize + sanitize game URL/embed and return a safe src URL. */
function extractEmbedSrc(embed: string | null | undefined): string | null {
  if (!embed || typeof embed !== 'string') return null;
  const s = embed.trim();
  if (!s) return null;

  // Plain URL (http/https)
  if (/^https?:\/\/[^\s<>"']+$/i.test(s)) {
    return toEmbeddableUrl(s).replace(/["'<>]/g, '');
  }

  // Iframe snippet: extract src (src may have no leading space in markup)
  const srcMatch = s.match(/<iframe[^>]*\s*src\s*=\s*["']([^"']+)["'][^>]*>/i);
  const src = (srcMatch?.[1] || '').trim();
  if (src && /^https?:\/\//i.test(src)) {
    return toEmbeddableUrl(src).replace(/["'<>]/g, '');
  }

  // Already a single safe iframe (e.g. stored from server)
  if (/<iframe\s*[^>]*\s*src\s*=\s*["']https?:\/\/[^"']+["'][^>]*>/i.test(s) && !/<(script|object)/i.test(s)) {
    const one = s.match(/src\s*=\s*["'](https?:\/\/[^"']+)["']/i);
    if (one?.[1]) {
      return toEmbeddableUrl(one[1]).replace(/["'<>]/g, '');
    }
  }

  return null;
}

const GamePlayer = ({ mission, onComplete }: { mission: Mission, onComplete: () => void }) => {
  const embedSrc = extractEmbedSrc(mission.embed_code);
  return (
    <div className="space-y-8">
      <div className="bg-black rounded-2xl border border-brand-blue/30 overflow-hidden aspect-video relative shadow-2xl shadow-brand-blue/10 min-h-[400px]">
        {embedSrc ? (
          <iframe
            src={embedSrc}
            className="size-full min-h-[400px]"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer"
            title={mission.title}
          />
        ) : (
          <div className="size-full flex flex-col items-center justify-center p-12 text-center relative">
            <div className="absolute inset-0 opacity-10 pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #003c71 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            
            <div className="size-24 bg-brand-blue/10 rounded-2xl flex items-center justify-center mb-8 border border-brand-blue/20 shadow-[0_0_30px_rgba(0,60,113,0.1)]">
              <Terminal className="text-brand-blue size-12" />
            </div>
            <h3 className="text-4xl font-black text-white uppercase italic mb-4 tracking-tighter">{mission.title}</h3>
            <p className="text-brand-blue/60 max-w-md font-mono text-xs mb-10 uppercase tracking-widest">{mission.description}</p>
            
            <div className="p-10 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-600/40 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="text-left">
                  <p className="text-[9px] uppercase font-black text-brand-blue/50 tracking-[0.2em] mb-1">Skill Practice</p>
                  <p className="text-xs font-black text-white uppercase">Simulation Ready</p>
                </div>
                <div className="size-2 bg-brand-blue rounded-full animate-pulse shadow-[0_0_8px_rgba(0,60,113,0.5)]" />
              </div>
              <button 
                onClick={onComplete}
                className="w-full bg-brand-blue text-white font-black py-5 rounded-2xl uppercase tracking-[0.2em] text-xs hover:bg-brand-blue/90 transition-all shadow-xl shadow-brand-blue/20 active:scale-95"
              >
                Complete Activity
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-8">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Difficulty</span>
            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
              mission.difficulty === 'Hard' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-brand-blue/10 text-brand-blue border-brand-blue/20'
            }`}>
              {mission.difficulty}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">XP Reward</span>
            <span className="text-brand-blue font-black font-mono text-lg">+{mission.xp_reward} XP</span>
          </div>
        </div>
        <button 
          onClick={onComplete}
          className="group flex items-center gap-2 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-red-500 transition-colors"
        >
          <X className="size-4 group-hover:rotate-90 transition-transform" />
          Terminate Session
        </button>
      </div>
    </div>
  );
};
const MissionSetup = ({
  sectors,
  canEmbed = false,
  assignClassId = null,
}: {
  sectors: Sector[],
  canEmbed?: boolean,
  assignClassId?: number | null,
}) => {
  const LEARNING_OUTCOME_OPTIONS = ['Conceptual Understanding', 'Problem Solving', 'Collaboration', 'Creativity', 'Data Literacy', 'Critical Thinking'];
  const DOMAIN_OPTIONS = ['Robotics', 'AI', 'Science', 'Mathematics', '3D Modelling', 'Electronics', 'Fin Tech', 'Space Tech', 'Health Tech', 'Game Dev', 'Web Dev', 'App Dev'];
  const GRADE_LEVEL_OPTIONS = ['K-2', '3-5', '6-8', '9-12', 'College'];
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [publishMode, setPublishMode] = useState<'library' | 'assign'>('library');
  const [allMissions, setAllMissions] = useState<Mission[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    sector_id: sectors[0]?.id || 1,
    description: '',
    difficulty: 'Medium',
    grade_level: '',
    xp_reward: 500,
    embed_code: '',
    prerequisite_mission_id: null as number | null,
    learning_outcomes: [] as string[],
    domains: [] as string[],
  });

  const toggleChoice = (field: 'learning_outcomes' | 'domains', value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].includes(value) ? prev[field].filter((v) => v !== value) : [...prev[field], value],
    }));
  };

  useEffect(() => {
    const raw = localStorage.getItem('mission_setup_draft');
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      if (draft && typeof draft === 'object') {
        setFormData((prev) => ({
          ...prev,
          title: String(draft.title ?? prev.title),
          sector_id: Number(draft.sector_id ?? prev.sector_id) || prev.sector_id,
          description: String(draft.description ?? prev.description),
          difficulty: String(draft.difficulty ?? prev.difficulty),
          grade_level: String(draft.grade_level ?? prev.grade_level),
          xp_reward: Number(draft.xp_reward ?? prev.xp_reward) || prev.xp_reward,
          embed_code: String(draft.embed_code ?? prev.embed_code),
          prerequisite_mission_id: Number(draft.prerequisite_mission_id || 0) || null,
          learning_outcomes: Array.isArray(draft.learning_outcomes) ? draft.learning_outcomes.map((x: unknown) => String(x)) : prev.learning_outcomes,
          domains: Array.isArray(draft.domains) ? draft.domains.map((x: unknown) => String(x)) : prev.domains,
        }));
        setInfoMessage('Loaded selected activity into builder.');
      }
    } catch {
      // ignore malformed draft
    }
  }, []);

  useEffect(() => {
    safeFetch('/api/missions').then((data) => {
      setAllMissions(Array.isArray(data) ? data : []);
    });
  }, []);

  const relevantPrereqs = useMemo(
    () => allMissions.filter((m) => Number(m.sector_id) === Number(formData.sector_id) && m.title !== formData.title),
    [allMissions, formData.sector_id, formData.title]
  );

  const projectedImpact = useMemo(() => {
    const words = formData.description.trim().split(/\s+/).filter(Boolean).length;
    const outcomes = formData.learning_outcomes.length;
    const domains = formData.domains.length;
    const difficultyWeight = formData.difficulty === 'Hard' ? 1.25 : formData.difficulty === 'Medium' ? 1.1 : 1;
    const depth = Math.min(100, Math.round((words * 1.2 + outcomes * 10 + domains * 8) * difficultyWeight));
    return {
      engagement: Math.max(20, Math.min(100, 25 + outcomes * 12 + Math.round(words * 0.35))),
      retention: Math.max(20, Math.min(100, 20 + domains * 14 + Math.round(words * 0.25))),
      rigor: Math.max(20, Math.min(100, 30 + (formData.difficulty === 'Hard' ? 40 : formData.difficulty === 'Medium' ? 25 : 10))),
      transfer: Math.max(20, Math.min(100, 18 + domains * 10 + outcomes * 8)),
      depth,
    };
  }, [formData.description, formData.learning_outcomes, formData.domains, formData.difficulty]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setInfoMessage(null);
    const embed = formData.embed_code?.trim();
    const payload = {
      ...formData,
      embed_code: embed || undefined,
      learning_outcomes: formData.learning_outcomes,
      domains: formData.domains,
      prerequisite_mission_id: formData.prerequisite_mission_id || undefined,
    };
    try {
      const response = await fetchWithAuth('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const json = await response.json().catch(() => ({}));
        const missionId = Number(json?.id || 0);
        if (publishMode === 'assign' && assignClassId && Number.isInteger(assignClassId) && assignClassId > 0 && missionId > 0) {
          await fetchWithAuth(`/api/classes/${assignClassId}/missions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mission_id: missionId }),
          });
          setInfoMessage('Mission deployed and assigned to selected class.');
        } else {
          setInfoMessage('Mission saved to Mission Library. Assign it later from Mission Library or Classroom Manager.');
        }
        setStatus('success');
        setFormData({
          title: '',
          sector_id: sectors[0]?.id || 1,
          description: '',
          difficulty: 'Medium',
          grade_level: '',
          xp_reward: 500,
          embed_code: '',
          prerequisite_mission_id: null,
          learning_outcomes: [],
          domains: [],
        });
        setTimeout(() => setStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('Failed to deploy mission:', error);
      setStatus('idle');
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      <div className="rounded-xl bg-[#0A192F] border border-[#1B2B44] px-4 py-3 text-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs tracking-[0.16em] uppercase font-semibold">
          <span className="size-2 rounded-full bg-amber-400 inline-block" />
          Activity Builder
        </div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-amber-200">
          Ready {canEmbed ? '| Embed Enabled' : ''}
        </div>
      </div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h3 className="text-3xl font-bold text-[var(--ca-on-surface)] tracking-tight">Create Activity</h3>
          <p className="text-[var(--ca-on-surface-variant)] text-sm">Set up a mission and assign it to a class.</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('mission_setup_draft', JSON.stringify(formData));
              const stamp = new Date().toLocaleString();
              setDraftSavedAt(stamp);
              setInfoMessage(`Draft saved on this browser at ${stamp}.`);
            }}
            className="px-5 py-3 border-2 border-[#0D1C32] text-[#0D1C32] font-bold rounded-lg hover:bg-slate-100 transition-all flex items-center gap-2"
          >
            <Copy className="size-4" />
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => {
              const raw = localStorage.getItem('mission_setup_draft');
              if (!raw) {
                setInfoMessage('No draft found on this browser yet.');
                return;
              }
              try {
                const draft = JSON.parse(raw);
                setFormData((prev) => ({
                  ...prev,
                  title: String(draft.title ?? prev.title),
                  sector_id: Number(draft.sector_id ?? prev.sector_id) || prev.sector_id,
                  description: String(draft.description ?? prev.description),
                  difficulty: String(draft.difficulty ?? prev.difficulty),
                  grade_level: String(draft.grade_level ?? prev.grade_level),
                  xp_reward: Number(draft.xp_reward ?? prev.xp_reward) || prev.xp_reward,
                  embed_code: String(draft.embed_code ?? prev.embed_code),
                  prerequisite_mission_id: Number(draft.prerequisite_mission_id || 0) || null,
                  learning_outcomes: Array.isArray(draft.learning_outcomes) ? draft.learning_outcomes.map((x: unknown) => String(x)) : prev.learning_outcomes,
                  domains: Array.isArray(draft.domains) ? draft.domains.map((x: unknown) => String(x)) : prev.domains,
                }));
                setInfoMessage('Draft loaded from this browser.');
              } catch {
                setInfoMessage('Draft data is invalid.');
              }
            }}
            className="px-5 py-3 border-2 border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-100 transition-all"
          >
            Load Draft
          </button>
          <button
            type="submit"
            form="mission-setup-form"
            disabled={status !== 'idle'}
            onClick={() => setPublishMode('library')}
            className="px-6 py-3 bg-[#0D1C32] text-white font-bold rounded-lg hover:bg-[#0A192F] transition-all flex items-center gap-2 disabled:opacity-60"
          >
            {status === 'submitting' ? <Activity className="size-4 animate-spin" /> : <Zap className="size-4" />}
            Save to Library
          </button>
          {assignClassId ? (
            <button
              type="submit"
              form="mission-setup-form"
              disabled={status !== 'idle'}
              onClick={() => setPublishMode('assign')}
              className="px-6 py-3 bg-amber-500 text-[#0D1C32] font-bold rounded-lg hover:bg-amber-400 transition-all disabled:opacity-60"
            >
              Publish & Assign
            </button>
          ) : null}
        </div>
      </div>

      <form id="mission-setup-form" className="grid grid-cols-12 gap-6" onSubmit={handleSubmit}>
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <section className="bg-white p-6 rounded-xl border border-slate-100 shadow-[0px_4px_20px_rgba(10,25,47,0.05)]">
            <div className="flex items-center gap-2 mb-6">
              <ClipboardList className="size-5 text-amber-500" />
              <h4 className="text-xl font-semibold text-[#0D1C32] uppercase tracking-tight">Activity Details</h4>
            </div>
            {assignClassId ? (
              <p className="text-[11px] text-amber-700 font-bold uppercase tracking-wider mb-4">
                You can save to library or publish and assign to the selected class.
              </p>
            ) : (
              <p className="text-[11px] text-[var(--ca-on-surface-variant)] mb-4">
                Tip: Students only see missions assigned to their class.
              </p>
            )}
            {draftSavedAt && (
              <p className="text-[11px] text-slate-500 mb-4">Last draft saved on this browser: {draftSavedAt}</p>
            )}
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] uppercase font-black text-[var(--ca-on-surface-variant)] mb-2 tracking-[0.15em]">Mission Designation</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Operation: Orbital Mechanics 101"
                  className="w-full bg-white border border-slate-300 rounded-lg p-4 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black text-[var(--ca-on-surface-variant)] mb-2 tracking-[0.15em]">Description</label>
                <textarea
                  rows={5}
                  required
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what students should do and learn..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-4 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] uppercase font-black text-[var(--ca-on-surface-variant)] mb-2 tracking-[0.15em]">Sector Assignment</label>
                  <div className="relative">
                    <select
                      value={formData.sector_id}
                      onChange={e => setFormData({ ...formData, sector_id: parseInt(e.target.value, 10) })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-4 pr-10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none appearance-none"
                    >
                      {sectors.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-[var(--ca-on-surface-variant)] mb-2 tracking-[0.15em]">Grade Level</label>
                  <select
                    value={formData.grade_level}
                    onChange={e => setFormData({ ...formData, grade_level: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-4 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                  >
                    <option value="">All grades</option>
                    {GRADE_LEVEL_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-[var(--ca-on-surface-variant)] mb-2 tracking-[0.15em]">XP Reward</label>
                  <input
                    type="number"
                    required
                    value={formData.xp_reward}
                    onChange={e => setFormData({ ...formData, xp_reward: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-4 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] uppercase font-black text-[var(--ca-on-surface-variant)] mb-2 tracking-[0.15em]">Learning Outcomes (multi-select)</label>
                  <div className="flex flex-wrap gap-2">
                    {LEARNING_OUTCOME_OPTIONS.map((opt) => {
                      const active = formData.learning_outcomes.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleChoice('learning_outcomes', opt)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            active ? 'bg-[#0D1C32] text-white border-[#0D1C32]' : 'bg-white text-slate-600 border-slate-300 hover:border-amber-400'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-[var(--ca-on-surface-variant)] mb-2 tracking-[0.15em]">Domains (multi-select)</label>
                  <div className="flex flex-wrap gap-2">
                    {DOMAIN_OPTIONS.map((opt) => {
                      const active = formData.domains.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleChoice('domains', opt)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            active ? 'bg-amber-500 text-[#0D1C32] border-amber-500' : 'bg-white text-slate-600 border-slate-300 hover:border-amber-400'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black text-[var(--ca-on-surface-variant)] mb-2 tracking-[0.15em]">Prerequisite Mission (locks until completed)</label>
                <select
                  value={formData.prerequisite_mission_id ?? ''}
                  onChange={(e) => setFormData({ ...formData, prerequisite_mission_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-4 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                >
                  <option value="">No prerequisite</option>
                  {relevantPrereqs.map((m) => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="ca-glass-hud p-6 rounded-xl text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Rocket className="size-5 text-amber-500" />
                  <h4 className="text-xl font-semibold uppercase tracking-tight">Embed Preview</h4>
                </div>
                <span className="bg-amber-500 text-[#0D1C32] px-3 py-1 rounded text-xs font-black">Embed Link</span>
              </div>
              <div className="space-y-4">
                <textarea
                  rows={3}
                  value={formData.embed_code}
                  onChange={e => setFormData({ ...formData, embed_code: e.target.value })}
                  placeholder="https://unity-cloud.stemverse.com/simulations/uuid-7782-x"
                  className="w-full bg-[#0A192F]/80 border border-amber-500/30 rounded-lg p-4 font-mono text-amber-300 placeholder:text-amber-500/50 outline-none focus:border-amber-400"
                />
                <div className="w-full aspect-video bg-[#0A192F] rounded-lg border border-slate-700 flex flex-col items-center justify-center text-slate-400">
                  <Play className="size-10 mb-3" />
                  <p className="text-xs font-mono uppercase tracking-widest">Preview Pending</p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-xl border border-slate-100 shadow-[0px_4px_20px_rgba(10,25,47,0.05)]">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="size-5 text-amber-500" />
              <h4 className="text-xl font-semibold text-[#0D1C32] uppercase tracking-tight">Settings</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-[var(--ca-surface-container-low)] rounded-lg border border-slate-100">
                <label className="block text-[10px] uppercase font-black text-[var(--ca-on-surface-variant)] mb-3 tracking-[0.15em]">Difficulty</label>
                <div className="flex gap-2">
                  {['Easy', 'Medium', 'Hard'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setFormData({ ...formData, difficulty: d })}
                      className={`flex-1 py-2 rounded text-xs font-black uppercase tracking-widest border transition-all ${
                        formData.difficulty === d
                          ? 'bg-[#0D1C32] text-white border-[#0D1C32]'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-[var(--ca-surface-container-low)] rounded-lg border border-slate-100">
                <label className="block text-[10px] uppercase font-black text-[var(--ca-on-surface-variant)] mb-3 tracking-[0.15em]">Data Telemetry</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked readOnly className="accent-amber-500" />
                    Record telemetry for report cards
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" readOnly className="accent-amber-500" />
                    Enable multiplayer co-op lobby
                  </label>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <section className="bg-[#0A192F] p-6 rounded-xl shadow-2xl text-white">
            <div className="flex items-center gap-2 mb-6">
              <Award className="size-5 text-amber-500" />
              <h4 className="text-xl font-semibold uppercase tracking-tight">Points</h4>
            </div>
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-slate-400 text-xs uppercase tracking-widest">XP Payout</span>
                <span className="text-amber-500 font-mono font-bold">{formData.xp_reward.toLocaleString()} XP</span>
              </div>
              <div className="h-3 bg-[#1B2B44] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-yellow-400 to-amber-500" style={{ width: `${Math.min(100, Math.max(10, formData.xp_reward / 40))}%` }} />
              </div>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-[#1B2B44]/60 rounded-lg border border-[#1B2B44] flex justify-between">
                <span className="text-slate-400 text-xs uppercase">Base</span>
                <span className="font-mono font-bold">{Math.round(formData.xp_reward * 0.7)}</span>
              </div>
              <div className="p-3 bg-[#1B2B44]/60 rounded-lg border border-[#1B2B44] flex justify-between">
                <span className="text-slate-400 text-xs uppercase">Difficulty Multiplier</span>
                <span className="font-mono font-bold text-amber-400">
                  {formData.difficulty === 'Hard' ? 'x1.5' : formData.difficulty === 'Medium' ? 'x1.25' : 'x1.0'}
                </span>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-xl border border-slate-100 shadow-[0px_4px_20px_rgba(10,25,47,0.05)]">
            <h4 className="text-sm font-black uppercase tracking-[0.15em] text-[#0D1C32] mb-4">Projected Mission Impact</h4>
            <div className="space-y-4">
              <div className="flex items-end gap-1 h-24">
                {[projectedImpact.engagement, projectedImpact.retention, projectedImpact.rigor, projectedImpact.transfer, projectedImpact.depth].map((h, i) => (
                  <div key={i} className={`flex-1 rounded-t ${i % 2 === 0 ? 'bg-[#0D1C32]' : 'bg-amber-500'}`} style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                <span>ENGAGE</span><span>RETAIN</span><span>RIGOR</span><span>TRANSFER</span><span>DEPTH</span>
              </div>
            </div>
          </section>
        </div>

        {infoMessage && (
          <div className="col-span-12">
            <p className="text-sm font-bold text-amber-700">{infoMessage}</p>
          </div>
        )}
      </form>
    </div>
  );
};

const SquadLeaderboard = ({ student }: { student: Student }) => {
  const [classmates, setClassmates] = useState<Student[]>([]);
  const [levelPeers, setLevelPeers] = useState<Student[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<Class[]>([]);
  const [teacherClassId, setTeacherClassId] = useState<number | null>(null);
  const [teacherStudents, setTeacherStudents] = useState<Student[]>([]);

  useEffect(() => {
    if (student.role === 'student') {
      safeFetch(`/api/students/${student.id}/classmates`).then((data) => {
        if (Array.isArray(data)) setClassmates(data as Student[]);
      });
      safeFetch('/api/students').then((data) => {
        if (!Array.isArray(data)) return;
        const peers = (data as Student[])
          .filter((s) => s.role === 'student' && s.level === student.level)
          .sort((a, b) => b.xp - a.xp);
        setLevelPeers(peers);
      });
    }
  }, [student.id, student.level, student.role]);

  useEffect(() => {
    if (student.role === 'teacher' || student.role === 'admin') {
      safeFetch('/api/classes').then((data) => {
        if (!Array.isArray(data)) return;
        const list = (data as Class[]).filter((c) =>
          student.role === 'teacher' ? c.teacher_id === student.id : true
        );
        setTeacherClasses(list);
        if (list.length > 0 && !teacherClassId) setTeacherClassId(list[0].id);
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
          if (!cancelled && Array.isArray(data)) setClassmates(data as Student[]);
        });
        safeFetch('/api/students').then((data) => {
          if (!cancelled && Array.isArray(data)) {
            const peers = (data as Student[])
              .filter((s) => s.role === 'student' && s.level === student.level)
              .sort((a, b) => b.xp - a.xp);
            setLevelPeers(peers);
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
  }, [student.id, student.role, student.level, teacherClassId]);

  const currentClass = useMemo(
    () => teacherClasses.find((c) => c.id === teacherClassId) || null,
    [teacherClasses, teacherClassId]
  );

  const operativeSource = useMemo(() => {
    if (student.role === 'teacher' || student.role === 'admin') return teacherStudents;
    if (levelPeers.length > 0) return levelPeers;
    const fallback = [student, ...classmates.filter((s) => s.id !== student.id)];
    return fallback.sort((a, b) => b.xp - a.xp);
  }, [student, classmates, levelPeers, teacherStudents]);

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
          ? `${classmates.length} classmates · ${n} explorers in this ranking`
          : levelPeers.length > 0
            ? `${n} students at level ${student.level} (same level pool)`
            : n > 0
              ? `${n} explorer${n === 1 ? '' : 's'} in this ranking`
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
    levelPeers.length,
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
            onChange={(e) => setTeacherClassId(e.target.value ? parseInt(e.target.value, 10) : null)}
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
                <p className={`${isChampion ? 'text-amber-400 text-2xl' : 'text-amber-500 text-lg'} font-black tracking-tight`}>{p.name}</p>
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
                      <p className="text-slate-200 font-bold truncate">{s.name}</p>
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
                    <p className="text-slate-200 font-bold text-sm truncate">You ({student.name})</p>
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

const MissionSimulation = ({ mission, onComplete, onCancel }: { mission: Mission, onComplete: (mission: Mission) => void, onCancel: () => void }) => {
  const [step, setStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const steps = [
    { title: "Learning Session Started", log: "> PREPARING ACTIVITIES... READY" },
    { title: "Analyzing Data Streams", log: "> PROCESSING STEM VARIABLES... [QUANTUM_FLUX: 0.82]" },
    { title: "Executing Protocol", log: "> APPLYING THEORETICAL MODELS... SUCCESS" },
    { title: "Mission Finalizing", log: "> CALCULATING NEURAL GROWTH... COMPLETE" }
  ];

  useEffect(() => {
    if (step < steps.length) {
      const timer = setTimeout(() => {
        setLogs(prev => [...prev, steps[step].log]);
        setStep(s => s + 1);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setTimeout(() => {
        onComplete(mission);
      }, 1000);
    }
  }, [step]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-2xl" />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-2xl bg-black rounded-2xl border border-brand-blue/30 overflow-hidden shadow-[0_0_50px_rgba(0,60,113,0.2)]"
      >
        {/* Terminal Header */}
        <div className="bg-slate-900 px-8 py-4 border-b border-brand-blue/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-3 rounded-full bg-red-500/20 border border-red-500/50" />
            <div className="size-3 rounded-full bg-brand-yellow/20 border border-brand-yellow/50" />
            <div className="size-3 rounded-full bg-brand-blue/20 border border-brand-blue/50" />
          </div>
          <span className="text-[10px] font-black text-brand-blue/50 uppercase tracking-[0.4em]">Mission Execution Terminal</span>
          <div className="size-4" />
        </div>

        <div className="p-12 space-y-10">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">{mission.title}</h2>
            <div className="flex items-center justify-center gap-4">
              <div className="h-1 w-32 bg-brand-blue/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(step / steps.length) * 100}%` }}
                  className="h-full bg-brand-blue shadow-[0_0_10px_rgba(0,60,113,0.5)]"
                />
              </div>
              <span className="text-xs font-mono text-brand-blue">{Math.round((step / steps.length) * 100)}%</span>
            </div>
          </div>

          <div className="bg-slate-950 rounded-3xl p-8 border border-brand-blue/10 font-mono text-xs space-y-2 min-h-[200px]">
            {logs.map((log, i) => (
              <motion.p 
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-brand-blue/80"
              >
                {log}
              </motion.p>
            ))}
            {step < steps.length && (
              <motion.p 
                animate={{ opacity: [0, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="text-brand-blue"
              >
                _
              </motion.p>
            )}
          </div>

          <div className="flex justify-center">
            <button 
              onClick={onCancel}
              className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-red-500 transition-colors"
            >
              Abort Protocol
            </button>
          </div>
        </div>

        {/* HUD Elements */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-1/2 left-0 w-full h-px bg-brand-blue/5" />
          <div className="absolute top-0 left-1/2 w-px h-full bg-brand-blue/5" />
        </div>
      </motion.div>
    </div>
  );
};

// --- Settings Modal (Profile + Password for all; avatar customization for students and teachers) ---

const SettingsModal = ({
  student,
  setStudent,
  onClose,
}: {
  student: Student;
  setStudent: (s: Student | null) => void;
  onClose: () => void;
}) => {
  const isTeacher = student.role === 'teacher' || student.role === 'admin';
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [profileForm, setProfileForm] = useState({
    name: student.name,
    avatar_url: student.avatar_url || '',
    age: student.age ?? '',
    grade: student.grade || '',
    school: student.school || '',
    city: student.city || '',
    email: student.email || '',
    parent_email: student.parent_email || '',
    contact_number: student.contact_number || '',
  });
  useEffect(() => {
    setProfileForm({
      name: student.name,
      avatar_url: student.avatar_url || '',
      age: student.age ?? '',
      grade: student.grade || '',
      school: student.school || '',
      city: student.city || '',
      email: student.email || '',
      parent_email: student.parent_email || '',
      contact_number: student.contact_number || '',
    });
  }, [student.id, student.name, student.avatar_url, student.age, student.grade, student.school, student.city, student.email, student.parent_email, student.contact_number]);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    setSavingProfile(true);
    try {
      const res = await authFetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileForm.name,
          avatar_url: profileForm.avatar_url || undefined,
          age: profileForm.age === '' ? undefined : Number(profileForm.age),
          grade: profileForm.grade || undefined,
          school: profileForm.school || undefined,
          city: profileForm.city || undefined,
          email: profileForm.email || undefined,
          parent_email: profileForm.parent_email || undefined,
          contact_number: profileForm.contact_number || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setStudent(data.user);
        setProfileMessage({ type: 'success', text: 'Profile updated.' });
      } else {
        setProfileMessage({ type: 'error', text: data.message || 'Update failed.' });
      }
    } catch {
      setProfileMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (passwordForm.new.length < 6) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    setSavingPassword(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session) {
        const { error } = await supabase.auth.updateUser({ password: passwordForm.new });
        if (error) {
          setPasswordMessage({ type: 'error', text: error.message || 'Change failed.' });
        } else {
          setPasswordForm({ current: '', new: '', confirm: '' });
          setPasswordMessage({ type: 'success', text: 'Password updated for your account.' });
        }
      } else {
        const res = await authFetch('/api/me/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_password: passwordForm.current,
            new_password: passwordForm.new,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setPasswordForm({ current: '', new: '', confirm: '' });
          setPasswordMessage({ type: 'success', text: 'Password changed.' });
        } else {
          setPasswordMessage({ type: 'error', text: data.message || 'Change failed.' });
        }
      }
    } catch {
      setPasswordMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="cosmic-modal-overlay absolute inset-0" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="cosmic-modal relative w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="cosmic-inverse flex items-center justify-between p-6 border-b border-[rgba(118,132,159,0.35)] bg-[var(--ca-primary-container)]">
          <h2 className="cosmic-page-heading text-xl mb-0 text-[var(--ca-inverse-on-surface)]">Settings</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-[var(--ca-radius)] text-[var(--ca-on-primary-container)] hover:text-[var(--ca-secondary-container)] hover:bg-[rgba(255,255,255,0.06)] transition-colors">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex border-b border-[var(--ca-outline-variant)] bg-[var(--ca-surface-container-low)]">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 cosmic-page-sub text-[10px] transition-colors ${activeTab === 'profile' ? 'text-[var(--ca-on-secondary-container)] border-b-2 border-[var(--ca-secondary-container)] bg-[var(--ca-secondary-fixed)]/30' : 'text-[var(--ca-on-surface-variant)] hover:text-[var(--ca-on-surface)]'}`}
          >
            Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`flex-1 py-3 cosmic-page-sub text-[10px] transition-colors ${activeTab === 'password' ? 'text-[var(--ca-on-secondary-container)] border-b-2 border-[var(--ca-secondary-container)] bg-[var(--ca-secondary-fixed)]/30' : 'text-[var(--ca-on-surface-variant)] hover:text-[var(--ca-on-surface)]'}`}
          >
            Password
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {profileMessage && (
                <p className={`text-sm font-semibold ${profileMessage.type === 'success' ? 'text-[var(--ca-on-tertiary-container)]' : 'text-[var(--ca-error)]'}`}>
                  {profileMessage.text}
                </p>
              )}
              <div>
                <label className="cosmic-label">Display name</label>
                <input
                  value={profileForm.name}
                  onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="cosmic-input text-sm"
                  required
                />
              </div>
              <div>
                <label className="cosmic-label">Avatar URL</label>
                <input
                  value={profileForm.avatar_url}
                  onChange={e => setProfileForm({ ...profileForm, avatar_url: e.target.value })}
                  className="cosmic-input text-sm"
                  placeholder="https://..."
                />
              </div>
              {!isTeacher && (
              <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="cosmic-label">Age</label>
                  <input
                    type="number"
                    value={profileForm.age}
                    onChange={e => setProfileForm({ ...profileForm, age: e.target.value })}
                    className="cosmic-input text-sm"
                  />
                </div>
                <div>
                  <label className="cosmic-label">Grade</label>
                  <input
                    value={profileForm.grade}
                    onChange={e => setProfileForm({ ...profileForm, grade: e.target.value })}
                    className="cosmic-input text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="cosmic-label">School</label>
                <input
                  value={profileForm.school}
                  onChange={e => setProfileForm({ ...profileForm, school: e.target.value })}
                  className="cosmic-input text-sm"
                />
              </div>
              <div>
                <label className="cosmic-label">City</label>
                <input
                  value={profileForm.city}
                  onChange={e => setProfileForm({ ...profileForm, city: e.target.value })}
                  className="cosmic-input text-sm"
                />
              </div>
              <div>
                <label className="cosmic-label">Email</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="cosmic-input text-sm"
                />
              </div>
              <div>
                <label className="cosmic-label">Parent / Guardian email</label>
                <input
                  type="email"
                  value={profileForm.parent_email}
                  onChange={e => setProfileForm({ ...profileForm, parent_email: e.target.value })}
                  className="cosmic-input text-sm"
                />
              </div>
              <div>
                <label className="cosmic-label">Contact number</label>
                <input
                  value={profileForm.contact_number}
                  onChange={e => setProfileForm({ ...profileForm, contact_number: e.target.value })}
                  className="cosmic-input text-sm"
                />
              </div>
              </>
              )}
              <button
                type="submit"
                disabled={savingProfile}
                className="cosmic-btn-primary disabled:opacity-50"
              >
                {savingProfile ? 'Saving…' : 'Save profile'}
              </button>
            </form>
          )}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordMessage && (
                <p className={`text-sm font-semibold ${passwordMessage.type === 'success' ? 'text-[var(--ca-on-tertiary-container)]' : 'text-[var(--ca-error)]'}`}>
                  {passwordMessage.text}
                </p>
              )}
              <div>
                <label className="cosmic-label">Current password</label>
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  className="cosmic-input text-sm"
                  required
                />
              </div>
              <div>
                <label className="cosmic-label">New password</label>
                <input
                  type="password"
                  value={passwordForm.new}
                  onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })}
                  className="cosmic-input text-sm"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="cosmic-label">Confirm new password</label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  className="cosmic-input text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={savingPassword}
                className="cosmic-btn-primary disabled:opacity-50"
              >
                {savingPassword ? 'Updating…' : 'Change password'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeView, setActiveView] = useState('galaxy');
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [assignedChallenges, setAssignedChallenges] = useState<{
    id: number;
    title: string;
    type: string;
    xp_reward: number;
    latest_score?: number | null;
    latest_correct?: number | null;
    latest_attempted_at?: string | null;
  }[]>([]);
  const [assignedMissions, setAssignedMissions] = useState<AssignedMissionRow[]>([]);
  const [recentlyCompletedChallengeIds, setRecentlyCompletedChallengeIds] = useState<number[]>([]);
  const [assignedQuizzes, setAssignedQuizzes] = useState<AssignedQuizRow[]>([]);
  const [studentQuizHistory, setStudentQuizHistory] = useState<StudentQuizAttemptRow[]>([]);
  const [activeChallengeId, setActiveChallengeId] = useState<number | null>(null);
  const [generatedQuizId, setGeneratedQuizId] = useState<number | null>(null);
  const [generatedQuizTitle, setGeneratedQuizTitle] = useState<string>('');
  const [quizPromptMission, setQuizPromptMission] = useState<Mission | null>(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizGenerateError, setQuizGenerateError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [missionRecommendations, setMissionRecommendations] = useState<MissionRecommendation[]>([]);
  const [interestModalOpen, setInterestModalOpen] = useState(false);
  const [interestSelections, setInterestSelections] = useState<string[]>([]);
  const [savingInterests, setSavingInterests] = useState(false);
  const [interestError, setInterestError] = useState<string | null>(null);
  const isImmersivePlay = activeView === 'dashboard' && (generatedQuizId != null || activeChallengeId != null);
  const isImmersiveSection =
    activeView === 'galaxy' ||
    activeView === 'curriculum' ||
    activeView === 'rocket-chat' ||
    activeView === 'challenges' ||
    isImmersivePlay;

  const refreshAssignedContent = useCallback((studentId: number) => {
    safeFetch(`/api/students/${studentId}/assigned-missions`).then((data) =>
      setAssignedMissions(Array.isArray(data) ? data : [])
    );
    safeFetch(`/api/students/${studentId}/assigned-challenges`).then((data) =>
      setAssignedChallenges(Array.isArray(data) ? data : [])
    );
    safeFetch(`/api/students/${studentId}/assigned-quizzes`).then((data) =>
      setAssignedQuizzes(Array.isArray(data) ? data : [])
    );
    safeFetch(`/api/students/${studentId}/progress`).then((data) =>
      setStudentQuizHistory(Array.isArray(data?.quizzes) ? data.quizzes : [])
    );
  }, []);

  const challengeAccent = (kind: string) => {
    const k = String(kind || '').toLowerCase();
    if (k.includes('mcq')) return { ring: 'border-blue-400/40', glow: 'from-blue-500/20 to-blue-600/5', badge: 'text-blue-300', symbol: '◆' };
    if (k.includes('flash')) return { ring: 'border-amber-400/40', glow: 'from-amber-500/20 to-amber-600/5', badge: 'text-amber-300', symbol: '⬡' };
    if (k.includes('drag')) return { ring: 'border-rose-400/40', glow: 'from-rose-500/20 to-rose-600/5', badge: 'text-rose-300', symbol: '▲' };
    return { ring: 'border-emerald-400/40', glow: 'from-emerald-500/20 to-emerald-600/5', badge: 'text-emerald-300', symbol: '●' };
  };

  useEffect(() => {
    safeFetch('/api/sectors').then(data => data && setSectors(data));
    safeFetch('/api/students').then(data => data && setStudents(data));

    // Restore session if a valid cookie exists
    safeFetch('/api/me').then(data => {
      if (data?.authenticated && data.user) {
        setStudent(data.user);
        setIsLoggedIn(true);
      }
    });
  }, []);

  useEffect(() => {
    if (student?.role === 'student' && student?.id) {
      refreshAssignedContent(student.id);
      safeFetch('/api/notifications').then((data) => setNotifications(Array.isArray(data) ? data : []));
      safeFetch(`/api/students/${student.id}/recommendations`).then((data) =>
        setMissionRecommendations(Array.isArray(data?.recommendations) ? data.recommendations : [])
      );
      safeFetch(`/api/students/${student.id}/interests`).then((data) => {
        const selected = Array.isArray(data?.selected) ? data.selected.map((x: unknown) => String(x)) : [];
        setInterestSelections(selected);
        setInterestModalOpen(selected.length === 0);
      });
    } else {
      setAssignedMissions([]);
      setAssignedChallenges([]);
      setAssignedQuizzes([]);
      setStudentQuizHistory([]);
      setNotifications([]);
      setMissionRecommendations([]);
      setInterestModalOpen(false);
      setInterestSelections([]);
      setInterestError(null);
    }
  }, [student?.id, student?.role, refreshAssignedContent]);

  useEffect(() => {
    if (student?.role !== 'student') return;
    const t = window.setInterval(() => {
      if (document.hidden) return;
      safeFetch('/api/notifications').then((data) => setNotifications(Array.isArray(data) ? data : []));
    }, 15000);
    return () => window.clearInterval(t);
  }, [student?.role]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const pollCore = () => {
      if (document.hidden) return;
      safeFetch('/api/me').then((data) => {
        if (data?.authenticated && data.user) setStudent(data.user);
      });
      safeFetch('/api/sectors').then((data) => data && setSectors(data));
      safeFetch('/api/students').then((data) => data && setStudents(data));
    };
    const id = window.setInterval(pollCore, 30000);
    const onVis = () => {
      if (!document.hidden) pollCore();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !student?.id || student.role !== 'student') return;
    const sid = student.id;
    const pollStudent = () => {
      if (document.hidden) return;
      refreshAssignedContent(sid);
      safeFetch(`/api/students/${sid}/recommendations`).then((data) =>
        setMissionRecommendations(Array.isArray(data?.recommendations) ? data.recommendations : [])
      );
    };
    const id = window.setInterval(pollStudent, 35000);
    const onVis = () => {
      if (!document.hidden) pollStudent();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isLoggedIn, student?.id, student?.role, refreshAssignedContent]);

  useEffect(() => {
    (window as any).__studentId = student?.id ?? 0;
  }, [student?.id]);

  const markNotificationRead = async (id: number) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH', credentials: 'include' }).catch(() => {});
  };

  const markAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    await fetch('/api/notifications/read-all', { method: 'PATCH', credentials: 'include' }).catch(() => {});
  };

  const openNotificationLink = (link: string | null | undefined) => {
    if (!link) return;
    // Current link format: "challenge:<id>"
    if (link.startsWith('challenge:')) {
      const id = Number(link.split(':')[1]);
      if (Number.isInteger(id) && id > 0) {
        setActiveView('dashboard');
        setActiveChallengeId(id);
      } else {
        setActiveView('dashboard');
      }
      return;
    }
    // Fallback: just go to dashboard
    setActiveView('dashboard');
  };

  const toggleInterest = (key: string) => {
    setInterestError(null);
    setInterestSelections((prev) => {
      if (prev.includes(key)) return prev.filter((x) => x !== key);
      if (prev.length >= 6) return prev;
      return [...prev, key];
    });
  };

  const saveStudentInterests = async () => {
    if (!student?.id) return;
    if (interestSelections.length < 2) {
      setInterestError('Pick at least 2 interests.');
      return;
    }
    setSavingInterests(true);
    setInterestError(null);
    try {
      const res = await fetchWithAuth(`/api/students/${student.id}/interests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected: interestSelections }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInterestError(data.message || data.error || 'Could not save interests.');
        return;
      }
      setInterestModalOpen(false);
      safeFetch(`/api/students/${student.id}/recommendations`).then((out) =>
        setMissionRecommendations(Array.isArray(out?.recommendations) ? out.recommendations : [])
      );
    } finally {
      setSavingInterests(false);
    }
  };

  const handleLogin = (user: any) => {
    setStudent(user);
    setIsLoggedIn(true);
    // Set initial view based on role (teachers see hub on dashboard; no separate Teacher tab)
    if (user.role === 'admin') setActiveView('admin');
    else setActiveView('dashboard');
  };

  const handleSelectSector = (sector: Sector) => {
    setSelectedSector(sector);
    setActiveView('sector-detail');
  };

  const handleMissionComplete = async (mission: Mission) => {
    if (!student) return;
    const xp = mission.xp_reward ?? 0;

    const newXp = student.xp + xp;
    const newLevel = Math.floor(newXp / 1000) + 1;
    setStudent({ ...student, xp: newXp, level: newLevel });
    setActiveMission(null);

    if (student.role === "student") {
      await fetch(`/api/students/${student.id}/missions/${mission.id}/complete`, {
        method: "POST",
        credentials: "include",
      });
    }
    await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Game "${mission.title}" completed successfully by ${student.name}.`,
        type: "mission",
        xp_change: xp,
      }),
    });
    if (student.role === "student") {
      setQuizPromptMission(mission);
      setQuizGenerateError(null);
    }
  };

  const handleGenerateQuizFromMission = async () => {
    if (!quizPromptMission) return;
    setGeneratingQuiz(true);
    setQuizGenerateError(null);
    try {
      const res = await fetch(`/api/missions/${quizPromptMission.id}/generate-quiz`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) {
        setQuizGenerateError(data.message || data.error || 'Could not generate quiz.');
        return;
      }
      setGeneratedQuizId(Number(data.id));
      setGeneratedQuizTitle(String(data.title || `${quizPromptMission.title} Quiz`));
      setQuizPromptMission(null);
      setActiveView('dashboard');
      setActiveChallengeId(null);
    } catch {
      setQuizGenerateError('Network error while generating quiz.');
    } finally {
      setGeneratingQuiz(false);
    }
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen font-sans text-[var(--ca-on-background)] bg-[var(--ca-background)] relative overflow-x-hidden">
      <FuturisticBackground withParticles={false} />

      {!isImmersiveSection && (
        <Navbar
          activeView={activeView}
          setActiveView={setActiveView}
          student={student}
          onOpenSettings={() => setSettingsOpen(true)}
          notifications={notifications}
          onMarkRead={markNotificationRead}
          onMarkAllRead={markAllNotificationsRead}
          onOpenLink={openNotificationLink}
        />
      )}

      {settingsOpen && student && (
        <SettingsModal
          student={student}
          setStudent={setStudent}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <main className={`relative z-10 ${isImmersiveSection ? 'px-0 py-0' : 'cosmic-page-shell'}`}>
        <AnimatePresence mode="wait">
          {activeView === 'dashboard' && student && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-10"
            >
              {(student.role === 'teacher' || student.role === 'admin') ? (
                <>
                  <div className="mb-6">
                    <h2 className="cosmic-page-heading text-4xl font-bold mb-2">
                      Dashboard
                    </h2>
                    <p className="cosmic-page-sub text-[10px] text-[var(--ca-on-surface-variant)]">
                      Classes, analytics &amp; assignments
                    </p>
                  </div>
                  <TeacherHub sectors={sectors} students={students} student={student} refetchStudents={() => safeFetch('/api/students').then(data => data && setStudents(data))} />
                </>
              ) : (
              <>
              {generatedQuizId ? (
                <div className="fixed inset-0 z-[120] bg-slate-950 text-white overflow-y-auto">
                  <div className="w-full min-h-full">
                    <button
                      type="button"
                      onClick={() => setGeneratedQuizId(null)}
                      className="fixed top-6 left-6 z-[140] w-12 h-12 flex items-center justify-center rounded-full bg-[#0d1c32]/70 backdrop-blur-xl border border-amber-400/25 text-amber-500 hover:scale-110 active:scale-95 transition-all shadow-[0_0_15px_rgba(245,158,11,0.35)]"
                      aria-label="Back"
                    >
                      <ArrowLeft className="size-5" />
                    </button>
                    <QuizPlayer
                      quizId={generatedQuizId}
                      onComplete={async () => {
                        if (student?.id) {
                          setTimeout(() => refreshAssignedContent(student.id), 1200);
                        }
                      }}
                    />
                  </div>
                </div>
              ) : activeChallengeId ? (
                <div className="fixed inset-0 z-[120] bg-slate-950 text-white overflow-y-auto">
                  <div className="w-full min-h-full">
                    <button
                      type="button"
                      onClick={() => setActiveChallengeId(null)}
                      className="fixed top-6 left-6 z-[140] w-12 h-12 flex items-center justify-center rounded-full bg-[#0d1c32]/70 backdrop-blur-xl border border-amber-400/25 text-amber-500 hover:scale-110 active:scale-95 transition-all shadow-[0_0_15px_rgba(245,158,11,0.35)]"
                      aria-label="Back"
                    >
                      <ArrowLeft className="size-5" />
                    </button>
                    <ChallengeRenderer
                      challengeId={activeChallengeId}
                      onComplete={(result) => {
                        if (student && result.total_xp != null) {
                          setStudent((s) => s ? { ...s, xp: result.total_xp } : null);
                        }
                        if (student?.id) {
                          const now = new Date().toISOString();
                          setAssignedChallenges((prev) =>
                            prev.map((c) =>
                              c.id === activeChallengeId
                                ? {
                                    ...c,
                                    latest_attempted_at: now,
                                    latest_correct: result.correct ? 1 : 0,
                                    latest_score: result.correct ? 1 : 0,
                                  }
                                : c
                            )
                          );
                          setRecentlyCompletedChallengeIds((prev) =>
                            activeChallengeId != null && !prev.includes(activeChallengeId) ? [...prev, activeChallengeId] : prev
                          );
                          setTimeout(() => refreshAssignedContent(student.id), 1200);
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
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
                                onClick={() => setActiveView('galaxy')}
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
                                      setActiveView('sector-detail');
                                    } else {
                                      setActiveView('galaxy');
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
              )}
              </>
              )}
            </motion.div>
          )}
          {activeView === 'galaxy' && (
            <motion.div
              key="galaxy"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="ca-galaxy-view px-0 py-0"
            >
              <div className="text-center mb-6 sm:mb-8 max-w-2xl mx-auto px-4 pt-4 sm:pt-6">
                <h2 className="cosmic-page-heading text-3xl sm:text-4xl font-bold mb-2 sm:mb-3 text-white">Galaxy Sector Hub</h2>
                <p className="cosmic-page-sub text-sm sm:text-base text-slate-300">
                  Navigate the star systems of knowledge and enter a sector to begin.
                </p>
              </div>
              <GalaxyMap
                sectors={sectors}
                onSelectSector={handleSelectSector}
                onOpenCurriculum={() => setActiveView('curriculum')}
                onOpenRocketChat={() => setActiveView('rocket-chat')}
                student={student}
                activeMission={activeMission}
              />
            </motion.div>
          )}

          {activeView === 'curriculum' && (
            <motion.div key="curriculum" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CoreCurriculumHub student={student} onBack={() => setActiveView('galaxy')} />
            </motion.div>
          )}

          {activeView === 'rocket-chat' && (
            <motion.div key="rocket-chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <RocketChatPanel onBack={() => setActiveView('galaxy')} />
            </motion.div>
          )}

          {activeView === 'sector-detail' && selectedSector && (
            <SectorView 
              key="sector-detail"
              sector={selectedSector} 
              onBack={() => setActiveView('galaxy')} 
              onPlayMission={(m) => setActiveMission(m)}
              allUnlocked={student?.role === 'teacher' || student?.role === 'admin'}
            />
          )}

          {activeView === 'admin' && student?.role === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AdminDashboard />
            </motion.div>
          )}

          {activeView === 'challenges' && (student?.role === 'teacher' || student?.role === 'admin') && (
            <motion.div
              key="challenges"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col flex-1 min-h-0 overflow-hidden px-0"
            >
              <ChallengeBuilder />
            </motion.div>
          )}

          {activeView === 'profile' && student && (
            (student.role === 'teacher' || student.role === 'admin') ? (
              <motion.div key="profile-teacher" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="mb-12">
                  <h2 className="cosmic-page-heading text-4xl font-bold mb-2">Profile</h2>
                  <p className="cosmic-page-sub text-[10px] text-[var(--ca-on-surface-variant)]">Your account and avatar</p>
                </div>
                <div className="glass-panel rounded-[var(--ca-radius-lg)] p-10 card-hover-glow flex flex-col sm:flex-row gap-10 items-center">
                  <div className="relative">
                    <div className="size-40 rounded-[var(--ca-radius-lg)] border-2 border-[var(--ca-outline-variant)] overflow-hidden shadow-xl bg-[var(--ca-surface-container-low)]">
                      <img src={student.avatar_url || 'https://picsum.photos/seed/avatar/200/200'} className="size-full object-cover" alt="" referrerPolicy="no-referrer" />
                    </div>
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <p className="cosmic-page-sub text-[10px] mb-1 text-[var(--ca-on-surface-variant)]">Display name</p>
                    <h2 className="text-3xl font-bold text-[var(--ca-on-surface)] mb-4">{student.name}</h2>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="cosmic-btn-secondary !normal-case !tracking-normal !text-sm !font-semibold px-5 py-3 inline-flex items-center gap-2"
                    >
                      <Settings className="size-4" />
                      Edit profile &amp; password
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="profile"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="mb-12">
                  <h2 className="cosmic-page-heading text-4xl font-bold mb-2">Operator Profile</h2>
                  <p className="cosmic-page-sub text-[10px] text-[var(--ca-on-surface-variant)]">Your details, progress, and achievement logs</p>
                </div>
                <StudentDashboard student={student} onOpenSettings={() => setSettingsOpen(true)} setActiveView={setActiveView} />
              </motion.div>
            )
          )}

          {activeView === 'create-mission' && (student?.role === 'teacher' || student?.role === 'admin') && (
            <motion.div 
              key="create-mission"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-12">
                <h2 className="cosmic-page-heading text-4xl font-bold mb-2">Create Activities</h2>
                <p className="cosmic-page-sub text-[10px] text-[var(--ca-on-surface-variant)]">Create and assign new learning missions</p>
              </div>
              <MissionSetup sectors={sectors} />
            </motion.div>
          )}

          {activeView === 'squad' && student && (
            <motion.div 
              key="squad"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-12">
                <h2 className="cosmic-page-heading text-4xl font-bold mb-2">Cosmic Leaderboard</h2>
                <p className="cosmic-page-sub text-[10px] text-[var(--ca-on-surface-variant)]">The sector&apos;s top performing explorers and elite squads.</p>
              </div>
              <SquadLeaderboard student={student} />
            </motion.div>
          )}

          {activeView === 'awards' && student && (
            <motion.div 
              key="awards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-12">
                <h2 className="cosmic-page-heading text-4xl font-bold mb-2">Hall of Achievements</h2>
                <p className="cosmic-page-sub text-[10px] text-[var(--ca-on-surface-variant)]">
                  Badges, missions, and quiz attempts from your live account (updates every 30s while this tab is open).
                </p>
              </div>
              <AwardsView student={student} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {student?.role === 'student' && interestModalOpen && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-2xl rounded-3xl border border-amber-400/35 bg-[#0c1f3a] p-6 sm:p-8 shadow-[0_0_40px_rgba(255,178,4,0.2)]"
          >
            <h3 className="text-2xl font-black text-white">What do you want to explore first?</h3>
            <p className="text-slate-300 text-sm mt-2">Pick 2 to 6 sparks. We will tailor missions and recommendations to your interests.</p>
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {STUDENT_INTEREST_OPTIONS.map((option) => {
                const active = interestSelections.includes(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => toggleInterest(option.key)}
                    className={`rounded-2xl px-3 py-4 border text-left transition-all ${
                      active
                        ? 'bg-amber-400/20 border-amber-300 text-amber-100 shadow-[0_0_14px_rgba(255,178,4,0.35)]'
                        : 'bg-slate-900/50 border-slate-700 text-slate-200 hover:border-amber-300/60'
                    }`}
                  >
                    <p className="text-xl">{option.emoji}</p>
                    <p className="mt-2 text-xs font-black uppercase tracking-widest">{option.label}</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-300 uppercase font-black tracking-wider">{interestSelections.length}/6 selected</p>
              <button
                type="button"
                onClick={saveStudentInterests}
                disabled={savingInterests || interestSelections.length < 2}
                className="px-5 py-2.5 rounded-xl bg-[#ffb204] text-[#0A192F] font-black text-xs uppercase tracking-widest disabled:opacity-50"
              >
                {savingInterests ? 'Saving…' : 'Launch My Path'}
              </button>
            </div>
            {interestError && <p className="mt-3 text-rose-300 text-xs font-semibold">{interestError}</p>}
          </motion.div>
        </div>
      )}

      {activeMission && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="cosmic-modal-overlay absolute inset-0" onClick={() => setActiveMission(null)} />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="cosmic-modal relative w-full max-w-4xl rounded-[var(--ca-radius-xl)] p-1 overflow-hidden"
          >
            {activeMission.embed_code ? (
              <GamePlayer 
                mission={activeMission} 
                onComplete={() => handleMissionComplete(activeMission)} 
              />
            ) : (
              <MissionSimulation 
                mission={activeMission} 
                onComplete={handleMissionComplete} 
                onCancel={() => setActiveMission(null)} 
              />
            )}
          </motion.div>
        </div>
      )}

      {quizPromptMission && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <div className="cosmic-modal-overlay absolute inset-0" onClick={() => !generatingQuiz && setQuizPromptMission(null)} />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="cosmic-modal relative w-full max-w-xl p-8"
          >
            <h3 className="cosmic-page-heading text-2xl mb-2">Mission Complete</h3>
            <p className="text-[var(--ca-on-surface-variant)] mb-1">
              <span className="font-semibold text-[var(--ca-secondary)]">{quizPromptMission.title}</span> completed.
            </p>
            <p className="text-[var(--ca-on-surface-variant)] text-sm mb-6">
              Generate an AI-style quiz with 5 random questions based on this mission topic.
            </p>
            {quizGenerateError && <p className="text-[var(--ca-on-error-container)] text-sm mb-4">{quizGenerateError}</p>}
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => setQuizPromptMission(null)}
                disabled={generatingQuiz}
                className="cosmic-btn-secondary px-4 py-2 text-xs disabled:opacity-50"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={handleGenerateQuizFromMission}
                disabled={generatingQuiz}
                className="cosmic-btn-primary cosmic-btn-inline px-5 py-2 disabled:opacity-60"
              >
                {generatingQuiz ? 'Generating…' : 'Generate Quiz'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Bottom Navigation — frosted command bar */}
      {!isImmersivePlay && (
      <div className={`cosmic-inverse cosmic-bottom-nav fixed bottom-8 left-1/2 -translate-x-1/2 z-40 rounded-[var(--ca-radius-lg)] px-8 py-4 flex gap-10`}>
        <button 
          type="button"
          onClick={() => setActiveView('dashboard')}
          className={`flex flex-col items-center gap-1 group transition-all ${activeView === 'dashboard' ? 'cosmic-nav-active' : 'text-slate-400 opacity-80 hover:opacity-100'}`}
        >
          <LayoutDashboard className={`size-6 group-hover:scale-110 transition-transform ${activeView === 'dashboard' ? 'text-[var(--ca-secondary-container)]' : 'text-slate-400'}`} />
          <span className="text-[9px] font-black uppercase tracking-widest">
            {(student?.role === 'teacher' || student?.role === 'admin') ? 'Dashboard' : 'Command'}
          </span>
        </button>
        <button 
          type="button"
          onClick={() => setActiveView('galaxy')}
          className={`flex flex-col items-center gap-1 group transition-all ${activeView === 'galaxy' ? 'cosmic-nav-active' : 'text-slate-400 opacity-80 hover:opacity-100'}`}
        >
          <MapIcon className={`size-6 group-hover:scale-110 transition-transform ${activeView === 'galaxy' ? 'text-[var(--ca-secondary-container)]' : 'text-slate-400'}`} />
          <span className="text-[9px] font-black uppercase tracking-widest">Galaxy</span>
        </button>
        
        {student?.role === 'admin' && (
          <button 
            type="button"
            onClick={() => setActiveView('admin')}
            className={`flex flex-col items-center gap-1 group transition-all ${activeView === 'admin' ? 'cosmic-nav-active' : 'text-slate-400 opacity-80 hover:opacity-100'}`}
          >
            <Shield className={`size-6 group-hover:scale-110 transition-transform ${activeView === 'admin' ? 'text-[var(--ca-secondary-container)]' : 'text-slate-400'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest">Admin</span>
          </button>
        )}

        {(student?.role === 'teacher' || student?.role === 'admin') && (
            <button 
              type="button"
              onClick={() => setActiveView('challenges')}
              className={`flex flex-col items-center gap-1 group transition-all ${activeView === 'challenges' ? 'cosmic-nav-active' : 'text-slate-400 opacity-80 hover:opacity-100'}`}
            >
              <Layers className={`size-6 group-hover:scale-110 transition-transform ${activeView === 'challenges' ? 'text-[var(--ca-secondary-container)]' : 'text-slate-400'}`} />
              <span className="text-[9px] font-black uppercase tracking-widest">Challenges</span>
            </button>
        )}

        <button 
          type="button"
          onClick={() => setActiveView('squad')}
          className={`flex flex-col items-center gap-1 group transition-all ${activeView === 'squad' ? 'cosmic-nav-active' : 'text-slate-400 opacity-80 hover:opacity-100'}`}
        >
          <Users className={`size-6 group-hover:scale-110 transition-transform ${activeView === 'squad' ? 'text-[var(--ca-secondary-container)]' : 'text-slate-400'}`} />
          <span className="text-[9px] font-black uppercase tracking-widest">Squad</span>
        </button>
        {student?.role === 'student' && (
          <button 
            type="button"
            onClick={() => setActiveView('awards')}
            className={`flex flex-col items-center gap-1 group transition-all ${activeView === 'awards' ? 'cosmic-nav-active' : 'text-slate-400 opacity-80 hover:opacity-100'}`}
          >
            <Award className={`size-6 group-hover:scale-110 transition-transform ${activeView === 'awards' ? 'text-[var(--ca-secondary-container)]' : 'text-slate-400'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest">Awards</span>
          </button>
        )}
        
        <button 
          onClick={async () => { 
            await supabase.auth.signOut();
            await fetch('/api/logout', { method: 'POST' });
            localStorage.removeItem('stemverse_access_token');
            setIsLoggedIn(false); 
            setStudent(null); 
          }}
          className="flex flex-col items-center gap-1 group transition-all text-red-500/50 hover:text-red-500 hover:opacity-100"
        >
          <Lock className="size-6 group-hover:scale-110 transition-transform" />
          <span className="text-[9px] font-black uppercase tracking-widest">Logout</span>
        </button>
      </div>
      )}
    </div>
  );
}
