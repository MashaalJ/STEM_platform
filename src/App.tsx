/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  ChevronDown
} from 'lucide-react';

// --- Types ---

const safeFetch = async (url: string, options?: RequestInit) => {
  try {
    const res = await fetch(url, options);
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
}

interface Class {
  id: number;
  name: string;
  teacher_id: number;
  teacher_name?: string;
  description: string;
  student_count?: number;
}

interface StudentProgress {
  badges: any[];
  quizzes: any[];
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
}

interface SystemLog {
  id: number;
  timestamp: string;
  message: string;
  type: string;
  xp_change: number;
}

interface Achievement {
  id: number;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  date?: string;
}

const Login = ({ onLogin }: { onLogin: (user: any) => void }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
   const [isSignup, setIsSignup] = useState(false);
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
   });

  const handleQuickAccess = (acc: typeof quickAccess[0]) => {
    setName(acc.name);
    setPassword(acc.pass);
    performLogin(acc.name, acc.pass);
  };

  const performLogin = async (n: string, p: string) => {
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n, password: p })
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data.user);
      } else {
        setError(data.message);
      }
    } catch (err) {
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
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...signupData,
          age: signupData.age ? parseInt(signupData.age) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data.user);
      } else {
        setError(data.message || 'Signup failed');
      }
    } catch (err) {
      setError('Connection failed');
    }
  };

  const quickAccess = [
    { name: 'Alex Rivera', pass: 'student123', role: 'Student' },
    { name: 'Professor Nova', pass: 'teacher123', role: 'Teacher' },
    { name: 'Admin Core', pass: 'admin123', role: 'Admin' }
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950 overflow-y-auto">
      <FuturisticBackground withParticles={true} />
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md p-10 glass-panel border-glow rounded-2xl box-glow-cyan scanlines"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="size-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-4 border border-cyan-500/30 box-glow-cyan">
            <Rocket className="text-cyan-400 size-8" />
          </div>
          <h1 className="font-display text-3xl font-black text-slate-100 uppercase tracking-tight text-glow-cyan">STEM<span className="text-cyan-400">VERSE</span></h1>
          <p className="text-cyan-400/80 text-[10px] uppercase font-bold tracking-[0.3em] mt-2 text-center">
            {isSignup ? 'Create Access Profile' : 'Neural Link Authorization'}
          </p>
        </div>
        <div className="flex mb-6 bg-slate-800/50 rounded-xl p-1 text-[10px] font-black uppercase tracking-widest border border-cyan-500/20">
          <button
            type="button"
            onClick={() => setIsSignup(false)}
            className={`flex-1 py-2 rounded-lg transition-all ${!isSignup ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400'}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsSignup(true)}
            className={`flex-1 py-2 rounded-lg transition-all ${isSignup ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400'}`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isSignup ? (
            <>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest">Operator Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all font-mono text-sm"
                  placeholder="e.g. Alex Rivera"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest">Access Key</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all font-mono text-sm"
                  placeholder="••••••••"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest">Full Name</label>
                <input
                  type="text"
                  required
                  value={signupData.name}
                  onChange={e => setSignupData({ ...signupData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-brand-blue transition-all text-sm"
                  placeholder="e.g. Sara Khan"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest">Role</label>
                  <select
                    value={signupData.role}
                    onChange={e => setSignupData({ ...signupData, role: e.target.value })}
                    className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-3 py-3 text-[11px] text-slate-100 focus:outline-none focus:border-cyan-400 transition-all"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest">Age</label>
                  <input
                    type="number"
                    value={signupData.age}
                    onChange={e => setSignupData({ ...signupData, age: e.target.value })}
                    className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-3 py-3 text-[11px] text-slate-100 focus:outline-none focus:border-cyan-400 transition-all"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest">Grade</label>
                  <input
                    value={signupData.grade}
                    onChange={e => setSignupData({ ...signupData, grade: e.target.value })}
                    className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-3 py-3 text-[11px] text-slate-100 focus:outline-none focus:border-cyan-400 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest">School</label>
                  <input
                    value={signupData.school}
                    onChange={e => setSignupData({ ...signupData, school: e.target.value })}
                    className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-3 py-3 text-[11px] text-slate-100 focus:outline-none focus:border-cyan-400 transition-all"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest">City</label>
                  <input
                    value={signupData.city}
                    onChange={e => setSignupData({ ...signupData, city: e.target.value })}
                    className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-3 py-3 text-[11px] text-slate-100 focus:outline-none focus:border-cyan-400 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest">Contact Number</label>
                  <input
                    value={signupData.contact_number}
                    onChange={e => setSignupData({ ...signupData, contact_number: e.target.value })}
                    className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-3 py-3 text-[11px] text-slate-100 focus:outline-none focus:border-cyan-400 transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest">Student / Teacher Email</label>
                <input
                  type="email"
                  required
                  value={signupData.email}
                  onChange={e => setSignupData({ ...signupData, email: e.target.value })}
                  className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-3 py-3 text-[11px] text-slate-100 focus:outline-none focus:border-cyan-400 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest">Parent / Guardian Email</label>
                <input
                  type="email"
                  value={signupData.parent_email}
                  onChange={e => setSignupData({ ...signupData, parent_email: e.target.value })}
                  className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-3 py-3 text-[11px] text-slate-100 focus:outline-none focus:border-cyan-400 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest">Create Access Key</label>
                <input
                  type="password"
                  required
                  value={signupData.password}
                  onChange={e => setSignupData({ ...signupData, password: e.target.value })}
                  className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-3 py-3 text-[11px] text-slate-100 focus:outline-none focus:border-cyan-400 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </>
          )}
          {error && <p className="text-red-400 text-[10px] font-bold uppercase text-center tracking-wider">{error}</p>}
          <button 
            type="submit" 
            className="w-full bg-cyan-500/20 border border-cyan-400 text-cyan-400 font-black py-4 rounded-xl uppercase tracking-tighter hover:bg-cyan-500/30 hover:box-glow-cyan transition-all active:scale-[0.98]"
          >
            {isSignup ? 'Create Account' : 'Establish Link'}
          </button>
        </form>

        {import.meta.env.MODE !== 'production' && (
          <div className="mt-8 pt-8 border-t border-cyan-500/20">
            <p className="text-[9px] uppercase font-black text-cyan-400/80 tracking-widest mb-4 text-center">Quick Access Terminals</p>
            <div className="grid grid-cols-1 gap-2">
              {quickAccess.map(acc => (
                <button 
                  key={acc.name}
                  onClick={() => handleQuickAccess(acc)}
                  className="flex items-center justify-between p-3 bg-slate-800/50 border border-cyan-500/20 rounded-xl hover:border-cyan-400/50 transition-all group"
                >
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-200 group-hover:text-cyan-400 transition-colors italic uppercase tracking-tight">{acc.name}</p>
                    <p className="text-[8px] uppercase font-black text-slate-400 tracking-widest">{acc.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-mono text-cyan-400/70">KEY: {acc.pass}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const QuizTool = ({ student, completedQuizIds = [] }: { student?: Student, completedQuizIds?: number[] }) => {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [newQuiz, setNewQuiz] = useState({
    title: '',
    questions: [{ type: 'mcq', q: '', a: '', options: ['', '', '', ''] }],
  });

  useEffect(() => {
    if (student?.role === 'student') {
      safeFetch(`/api/students/${student.id}/assigned-quizzes`).then(data => data && setQuizzes(data));
    } else {
      safeFetch('/api/quizzes').then(data => data && setQuizzes(data));
    }
  }, [student?.id, student?.role]);

  const handleAddQuestion = () => {
    setNewQuiz({
      ...newQuiz,
      questions: [...newQuiz.questions, { type: 'mcq', q: '', a: '', options: ['', '', '', ''] }],
    });
  };

  const handleSave = async () => {
    await fetch('/api/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newQuiz)
    });
    setShowCreate(false);
    fetch('/api/quizzes').then(res => res.json()).then(setQuizzes);
  };

  const submitQuiz = async () => {
    if (!activeQuiz || !student) return;
    const questions = JSON.parse(activeQuiz.questions);
    let score = 0;
    questions.forEach((q: any, i: number) => {
      const userAns = answers[i];
      if (q.type === 'dnd') {
        // Simple array equality for dnd
        if (JSON.stringify(userAns) === JSON.stringify(q.a.split(','))) score++;
      } else if (q.type === 'numeric') {
        const correct = parseFloat(q.a);
        const given = parseFloat(userAns);
        if (!Number.isNaN(correct) && !Number.isNaN(given) && Math.abs(correct - given) < 1e-6) {
          score++;
        }
      } else {
        if (userAns?.toString().toLowerCase() === q.a.toLowerCase()) score++;
      }
    });

    await fetch('/api/student-quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: student.id,
        quiz_id: activeQuiz.id,
        score,
        total_questions: questions.length
      })
    });

    setActiveQuiz(null);
    setAnswers([]);
    alert(`Assessment Complete! Neural Sync Score: ${score}/${questions.length}`);
  };

  return (
    <div className="glass-panel p-8 rounded-2xl border-glow card-hover-glow">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter flex items-center gap-2">
          <ClipboardList className="text-cyan-400" />
          Neural Assessment Interface
        </h3>
        {student?.role !== 'student' && (
          <button 
            onClick={() => setShowCreate(true)}
            className="bg-brand-blue text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-brand-blue/90 transition-all tracking-widest shadow-lg shadow-brand-blue/20"
          >
            Architect New Quiz
          </button>
        )}
      </div>

      {showCreate ? (
        <div className="space-y-6">
          <input 
            type="text" 
            placeholder="Quiz Designation" 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold outline-none focus:border-brand-blue/50"
            value={newQuiz.title}
            onChange={e => setNewQuiz({...newQuiz, title: e.target.value})}
          />
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {newQuiz.questions.map((q, i) => (
              <div key={i} className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-200 relative">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Question {i+1}</span>
                  <select
                    value={q.type}
                    onChange={e => {
                      const qs = [...newQuiz.questions];
                      const newType = e.target.value;
                      qs[i].type = newType;
                      if (newType === 'mcq' && !qs[i].options) {
                        qs[i].options = ['', '', '', ''];
                      }
                      if (newType === 'truefalse') {
                        qs[i].options = ['True', 'False'];
                      }
                      setNewQuiz({...newQuiz, questions: qs});
                    }}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-black uppercase outline-none"
                  >
                    <option value="mcq">Multiple Choice</option>
                    <option value="short">Short Answer</option>
                    <option value="dnd">Drag & Drop (Sequence)</option>
                    <option value="truefalse">True / False</option>
                    <option value="numeric">Numeric</option>
                  </select>
                </div>
                
                <input 
                  placeholder="The query..." 
                  className="w-full bg-transparent border-b border-slate-200 py-2 text-sm font-bold text-slate-900 outline-none"
                  value={q.q}
                  onChange={e => {
                    const qs = [...newQuiz.questions];
                    qs[i].q = e.target.value;
                    setNewQuiz({...newQuiz, questions: qs});
                  }}
                />

                {q.type === 'mcq' && (
                  <div className="grid grid-cols-2 gap-2">
                    {q.options?.map((opt, optIdx) => (
                      <input 
                        key={optIdx}
                        placeholder={`Option ${optIdx + 1}`}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium"
                        value={opt}
                        onChange={e => {
                          const qs = [...newQuiz.questions];
                          if (qs[i].options) qs[i].options![optIdx] = e.target.value;
                          setNewQuiz({...newQuiz, questions: qs});
                        }}
                      />
                    ))}
                  </div>
                )}

                {q.type === 'dnd' && (
                  <p className="text-[10px] text-slate-400 italic">Enter correct sequence in "Answer" separated by commas.</p>
                )}

                <input 
                  placeholder="Correct Answer" 
                  className="w-full bg-transparent py-2 text-sm text-brand-blue font-black outline-none border-t border-slate-100 mt-2"
                  value={q.a}
                  onChange={e => {
                    const qs = [...newQuiz.questions];
                    qs[i].a = e.target.value;
                    setNewQuiz({...newQuiz, questions: qs});
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-4 pt-4">
            <button onClick={() => setShowCreate(false)} className="flex-1 bg-slate-100 py-3 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-200">Abort</button>
            <button onClick={handleAddQuestion} className="flex-1 bg-slate-100 py-3 rounded-xl text-[10px] font-black text-slate-900 uppercase tracking-widest hover:bg-slate-200">Add Module</button>
            <button onClick={handleSave} className="flex-1 bg-brand-blue text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-blue/90 shadow-lg shadow-brand-blue/20">Deploy Quiz</button>
          </div>
        </div>
      ) : activeQuiz ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{activeQuiz.title}</h4>
            <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest">Neural Link Active</span>
          </div>
          
          <div className="space-y-6">
            {JSON.parse(activeQuiz.questions).map((q: any, i: number) => (
              <div key={i} className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-sm font-black text-slate-700 uppercase tracking-tight">{q.q}</p>
                
                {q.type === 'mcq' || q.type === 'truefalse' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {q.options?.map((opt: string) => (
                      <button
                        key={opt}
                        onClick={() => {
                          const ans = [...answers];
                          ans[i] = opt;
                          setAnswers(ans);
                        }}
                        className={`p-4 rounded-xl border text-xs font-bold text-left transition-all ${
                          answers[i] === opt ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white border-slate-200 hover:border-brand-blue/30'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : q.type === 'dnd' ? (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-400 uppercase font-black">Arrange in correct sequence:</p>
                    <div className="flex flex-wrap gap-2">
                      {(answers[i] || q.a.split(',').sort(() => Math.random() - 0.5)).map((item: string, idx: number) => (
                        <div 
                          key={idx}
                          className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold cursor-move"
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/plain', idx.toString())}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                            const toIdx = idx;
                            const newSequence = [...(answers[i] || q.a.split(',').sort(() => Math.random() - 0.5))];
                            const [movedItem] = newSequence.splice(fromIdx, 1);
                            newSequence.splice(toIdx, 0, movedItem);
                            const ans = [...answers];
                            ans[i] = newSequence;
                            setAnswers(ans);
                          }}
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <input 
                    placeholder="Input neural response..." 
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm outline-none focus:border-brand-blue/50 font-bold"
                    value={answers[i] || ''}
                    onChange={e => {
                      const ans = [...answers];
                      ans[i] = e.target.value;
                      setAnswers(ans);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          
          <div className="flex gap-4 pt-4">
            <button onClick={() => setActiveQuiz(null)} className="flex-1 bg-slate-100 py-3 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-200">Disconnect</button>
            <button onClick={submitQuiz} className="flex-1 bg-brand-blue text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-blue/90 shadow-lg shadow-brand-blue/20">Finalize Assessment</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {quizzes
            .filter(q => !completedQuizIds.includes(q.id))
            .map(q => (
            <div key={q.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center group hover:border-brand-blue/30 transition-all shadow-sm">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                  <Zap className="size-5" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">{q.title}</h4>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{JSON.parse(q.questions).length} Assessment Modules</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveQuiz(q)}
                className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-brand-blue group-hover:border-brand-blue/30 transition-all"
              >
                {student?.role === 'student' ? 'Initiate Link' : 'Review Data'}
              </button>
            </div>
          ))}
          {quizzes.length === 0 && <p className="text-slate-400 text-center py-10 italic text-sm">No neural assessments detected.</p>}
        </div>
      )}
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
    <div className="bg-white/70 backdrop-blur-md p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
      <div className="flex items-center gap-3 mb-8">
        <div className="size-10 rounded-xl bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center">
          <Plus className="text-brand-blue size-5" />
        </div>
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Register New Operator</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
          <input 
            placeholder="e.g. Commander Shepard" 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-300 focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/50 outline-none transition-all font-bold"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Level</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-brand-blue/50 outline-none appearance-none font-bold"
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-mono focus:border-brand-blue/50 outline-none font-bold"
              value={formData.level}
              onChange={e => setFormData({...formData, level: parseInt(e.target.value)})}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Avatar Seed</label>
          <input 
            placeholder="e.g. neuro-link-01" 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-xs focus:border-brand-blue/50 outline-none font-bold"
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

const Navbar = ({ activeView, setActiveView, student, onOpenSettings }: { activeView: string, setActiveView: (v: string) => void, student: Student | null; onOpenSettings?: () => void }) => (
  <header className="fixed top-0 left-0 right-0 z-50">
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl border-b border-cyan-500/20 shadow-[0_4px_30px_rgba(0,0,0,0.3)]" />
    <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-8 relative">
      <div className="absolute left-0 top-0 h-full w-1 bg-cyan-500/50" />
      
      <div className="flex items-center gap-6">
        <div className="relative group cursor-pointer" onClick={() => setActiveView('profile')}>
          <div className={`absolute -inset-2 rounded-full blur-md opacity-20 group-hover:opacity-40 transition duration-300 ${activeView === 'profile' ? 'bg-cyan-500' : 'bg-slate-400'}`}></div>
          <div className="relative size-14 p-1 rounded-full border-2 border-cyan-500/40 bg-slate-800/40 backdrop-blur-md overflow-hidden">
            <img 
              className="size-full rounded-full object-cover" 
              src={student?.avatar_url || "https://picsum.photos/seed/avatar/100/100"} 
              alt="Avatar"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
        <div className="hidden sm:block cursor-pointer" onClick={() => setActiveView('galaxy')}>
          <h1 className="font-display text-2xl font-black tracking-tighter text-slate-100 flex items-center gap-2 uppercase text-glow-cyan">
            <Rocket className="size-7 text-cyan-400" />
            STEM<span className="text-cyan-400">VERSE</span>
          </h1>
          <p className="text-[8px] font-black text-cyan-400/70 uppercase tracking-[0.4em] -mt-1 ml-9">Neural Link Protocol v2.5</p>
        </div>
      </div>

      <div className="flex-1 max-w-xl hidden md:flex flex-col gap-1.5">
        <div className="flex justify-between items-end text-[9px] uppercase tracking-widest font-black text-slate-400">
          <span className="flex items-center gap-1"><Activity className="size-3 text-cyan-400/80" /> Sync Progress</span>
          <span className="text-cyan-400 font-mono">{student?.xp || 0} / 1000 XP</span>
        </div>
        <div className="h-2 w-full bg-slate-700/50 rounded-full overflow-hidden border border-cyan-500/30 p-0.5">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${((student?.xp || 0) % 1000) / 10}%` }}
            className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full shadow-[0_0_15px_rgba(0,245,255,0.4)]"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 lg:gap-6">
        <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-2 rounded-xl border border-cyan-500/20 backdrop-blur-md">
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter leading-none">Operator Rank</span>
            <span className="text-cyan-400 font-black text-base leading-none italic">LVL {student?.level || 1}</span>
          </div>
          <div className="size-10 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center">
            <Award className="size-5" />
          </div>
        </div>
        <button
          onClick={() => onOpenSettings?.()}
          className="p-3 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 border border-cyan-500/20 transition-all text-slate-400 hover:text-cyan-400"
          title="Settings"
        >
          <Settings className="size-5" />
        </button>
      </div>

      <div className="absolute right-0 top-0 h-full w-1 bg-cyan-500/50" />
    </div>
  </header>
);

const GalaxyMap = ({ sectors, onSelectSector }: { sectors: Sector[], onSelectSector: (s: Sector) => void }) => {
  const SECTOR_POSITIONS = [
    { x: '15%', y: '25%' },
    { x: '45%', y: '15%' },
    { x: '75%', y: '20%' },
    { x: '25%', y: '65%' },
    { x: '55%', y: '75%' },
    { x: '85%', y: '60%' },
  ];

  return (
    <div className="relative w-full aspect-[16/9] bg-slate-900/50 rounded-2xl border border-cyan-500/20 overflow-hidden shadow-inner p-10 glass-panel">
      {/* Tactical Grid Background */}
      <div className="absolute inset-0 opacity-30 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(rgba(0,245,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,0.04) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      {/* Connection Lines (SVG) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#003c71" stopOpacity="0" />
            <stop offset="50%" stopColor="#003c71" stopOpacity="1" />
            <stop offset="100%" stopColor="#003c71" stopOpacity="0" />
          </linearGradient>
        </defs>
        {sectors.length > 1 && sectors.map((s, i) => {
          if (i === sectors.length - 1) return null;
          const start = SECTOR_POSITIONS[i % SECTOR_POSITIONS.length];
          const end = SECTOR_POSITIONS[(i + 1) % SECTOR_POSITIONS.length];
          return (
            <line 
              key={`line-${i}`}
              x1={start.x} y1={start.y} 
              x2={end.x} y2={end.y} 
              stroke="url(#lineGrad)" 
              strokeWidth="2" 
              strokeDasharray="8 4"
            />
          );
        })}
      </svg>

      {sectors.map((sector, i) => {
        const pos = SECTOR_POSITIONS[i % SECTOR_POSITIONS.length];
        const isLocked = sector.status === 'locked';
        
        return (
          <motion.div
            key={sector.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            style={{ left: pos.x, top: pos.y }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
          >
            <div className="relative group">
              {/* Pulse Effect for Active Sectors */}
              {!isLocked && (
                <div className="absolute -inset-4 bg-brand-blue/10 rounded-full animate-ping opacity-20" />
              )}
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => !isLocked && onSelectSector(sector)}
                className={`relative size-24 rounded-full border-4 flex flex-col items-center justify-center transition-all shadow-2xl ${
                  isLocked 
                    ? 'bg-slate-100 border-slate-200 grayscale' 
                    : 'bg-white border-brand-blue shadow-brand-blue/20 hover:shadow-brand-blue/40'
                }`}
              >
                {isLocked ? (
                  <Lock className="size-8 text-slate-300" />
                ) : (
                  <div className="size-full rounded-full overflow-hidden relative">
                    <img src={sector.image_url} className="size-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                    <div className="absolute inset-0 bg-brand-blue/10 group-hover:bg-transparent transition-colors" />
                  </div>
                )}
              </motion.button>

              {/* Label */}
              <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-0.5 ${isLocked ? 'text-slate-400' : 'text-brand-blue'}`}>
                  {isLocked ? `Lvl ${sector.required_level} Required` : `${sector.mastery_percent}% Sync`}
                </p>
                <h4 className={`text-sm font-black uppercase tracking-tighter ${isLocked ? 'text-slate-300' : 'text-slate-900'}`}>
                  {sector.name}
                </h4>
              </div>
            </div>
          </motion.div>
        );
      })}

      {/* HUD Overlays */}
      <div className="absolute top-8 left-8 flex flex-col gap-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tactical Overlay</span>
        <span className="text-xs font-mono text-brand-blue">SCANNING SECTORS... OK</span>
      </div>
      <div className="absolute bottom-8 right-8 text-right">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sector Coordinates</p>
        <p className="text-xs font-mono text-slate-900">LAT: 42.091 / LON: -71.012</p>
      </div>
    </div>
  );
};

const SectorView = ({ sector, onBack, onPlayMission }: { sector: Sector, onBack: () => void, onPlayMission: (m: Mission) => void, key?: string }) => {
  const [missions, setMissions] = useState<Mission[]>([]);

  useEffect(() => {
    fetch(`/api/sectors/${sector.id}`)
      .then(res => res.json())
      .then(data => setMissions(data.missions));
  }, [sector.id]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-10"
    >
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="group flex items-center gap-3 text-slate-400 hover:text-brand-blue transition-all"
        >
          <div className="size-10 rounded-full border border-slate-200 flex items-center justify-center group-hover:border-brand-blue/50 group-hover:bg-brand-blue/5">
            <ArrowLeft className="size-5" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Exit Sector</span>
        </button>

        <div className="flex items-center gap-4 bg-white/40 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/50 shadow-sm">
          <div className="text-right">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sector Status</p>
            <p className="text-xs font-black text-brand-blue uppercase">Operational</p>
          </div>
          <div className="size-2 bg-brand-blue rounded-full animate-pulse shadow-[0_0_8px_rgba(0,60,113,0.5)]" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          <section className="relative aspect-[21/9] rounded-[40px] overflow-hidden border border-white/50 shadow-2xl group">
            <div 
              className="absolute inset-0 bg-cover bg-center transition-transform duration-[2000ms] group-hover:scale-110"
              style={{ backgroundImage: `url(${sector.image_url})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
            
            <div className="absolute bottom-0 left-0 p-12 w-full">
              <div className="flex items-center gap-4 mb-4">
                <span className="px-3 py-1 bg-brand-blue text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-blue/20">Active Objective</span>
                <span className="text-white/60 font-mono text-xs">ID: {sector.id.toString().padStart(4, '0')}</span>
              </div>
              <h1 className="text-6xl font-black text-white mb-4 tracking-tighter uppercase italic">{sector.name}</h1>
              <p className="text-white/80 text-lg leading-relaxed max-w-3xl font-medium line-clamp-2">
                {sector.description}
              </p>
            </div>

            {/* Scanning HUD Effect */}
            <div className="absolute inset-0 pointer-events-none border-[20px] border-white/5 opacity-20" />
            <div className="absolute top-10 right-10 flex flex-col items-end gap-2">
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                <p className="text-[9px] text-white/60 uppercase font-black tracking-widest mb-1">Sync Rate</p>
                <p className="text-3xl font-black text-white font-mono">{sector.mastery_percent}%</p>
              </div>
            </div>
          </section>

            <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 uppercase tracking-tighter italic">
                <Activity className="text-brand-blue size-6" />
                Mission Parameters
              </h2>
              <div className="h-px flex-1 bg-slate-200 mx-6 hidden md:block" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {missions.map(mission => (
                <motion.div 
                  key={mission.id} 
                  whileHover={{ y: -8 }}
                  className="bg-white/40 backdrop-blur-xl rounded-[40px] overflow-hidden border border-white/50 group hover:border-brand-blue/30 transition-all flex flex-col shadow-xl"
                >
                  <div className="h-48 overflow-hidden relative">
                    <img src={mission.image_url} alt={mission.title} className="w-full h-full object-cover opacity-40 transition-transform duration-1000 group-hover:scale-110" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent" />
                    <div className={`absolute top-6 right-6 px-3 py-1 bg-white rounded-xl border text-[9px] font-black uppercase tracking-widest shadow-sm ${
                      mission.difficulty === 'Hard' ? 'border-red-500/50 text-red-600' : 'border-brand-blue/50 text-brand-blue'
                    }`}>
                      {mission.difficulty}
                    </div>
                  </div>
                  <div className="p-8 flex flex-col flex-1 relative -mt-12 bg-white/40 backdrop-blur-md rounded-t-[40px]">
                    <h3 className="text-xl font-black mb-3 text-slate-900 group-hover:text-brand-blue transition-colors uppercase tracking-tight italic">{mission.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed mb-8 font-medium">{mission.description}</p>
                    <div className="mt-auto flex items-center justify-between pt-6 border-t border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Neural Reward</span>
                        <span className="text-brand-blue font-black font-mono text-lg">+{mission.xp_reward} XP</span>
                      </div>
                      <button 
                        onClick={() => onPlayMission(mission)}
                        className="bg-brand-blue text-white font-black px-8 py-3 rounded-2xl text-xs uppercase tracking-widest hover:bg-brand-blue/90 transition-all shadow-xl shadow-brand-blue/20 active:scale-95"
                      >
                        Initiate
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <aside className="lg:col-span-4 space-y-8">
          <div className="bg-white/40 backdrop-blur-xl rounded-[40px] p-10 border border-white/50 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <School className="size-32" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-8 uppercase tracking-tighter flex items-center gap-3 italic">
              <School className="text-brand-blue size-6" />
              Intel Database
            </h3>
            <div className="space-y-4">
              {['Genetic Sequencing', 'CRISPR Proficiency', 'Cellular Biology', 'Neural Mapping'].map(tag => (
                <div key={tag} className="flex items-center gap-3 p-4 bg-white/60 rounded-2xl border border-white/50 shadow-sm group hover:border-brand-blue/30 transition-all">
                  <div className="size-2 bg-brand-blue rounded-full" />
                  <span className="text-xs font-black text-slate-600 uppercase tracking-widest">
                    {tag}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/40 backdrop-blur-xl rounded-[40px] p-10 border border-white/50 shadow-xl">
            <h3 className="text-xl font-black text-slate-900 mb-8 uppercase tracking-tighter flex items-center gap-3 italic">
              <TrendingUp className="text-brand-blue size-6" />
              Sector Leaderboard
            </h3>
            <div className="space-y-6">
              {[
                { name: 'Commander Shepard', score: '12,402', rank: 1 },
                { name: 'Dr. Liara T\'Soni', score: '11,890', rank: 2 },
                { name: 'Garrus Vakarian', score: '10,200', rank: 3 },
              ].map((entry, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={`size-10 rounded-xl flex items-center justify-center font-black text-sm ${
                    i === 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {entry.rank}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{entry.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{entry.score} PTS</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </motion.div>
  );
};

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);

  const refreshData = () => {
    safeFetch('/api/logs').then(data => data && setLogs(data));
    safeFetch('/api/students').then(data => data && setStudents(data));
    safeFetch('/api/sectors').then(data => data && setSectors(data));
    safeFetch('/api/missions').then(data => data && setMissions(data));
  };

  useEffect(() => {
    refreshData();
  }, []);

  const tabs = [
    { id: 'overview', label: 'Command Center', icon: LayoutDashboard },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'sectors', label: 'Sector Engine', icon: MapIcon },
    { id: 'games', label: 'Game Forge', icon: Play },
    { id: 'outcomes', label: 'Learning Outcomes', icon: Award },
    { id: 'economy', label: 'XP & Economy', icon: Database },
    { id: 'institutions', label: 'Institutions', icon: School },
    { id: 'moderation', label: 'Moderation', icon: Shield },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <div className="space-y-8 pb-32">
      {/* Admin Navigation */}
      <div className="flex flex-wrap gap-3 mb-10">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
              activeTab === tab.id 
                ? 'bg-brand-blue text-white border-brand-blue shadow-xl shadow-brand-blue/20' 
                : 'bg-white/40 backdrop-blur-xl text-slate-400 border-white/50 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && (
            <div className="space-y-10">
              {/* Real-Time Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Total Students', value: students.filter(s => s.role === 'student').length, icon: Users, trend: '+12.5%', color: 'text-brand-blue' },
                  { label: 'Total Teachers', value: students.filter(s => s.role === 'teacher').length, icon: School, trend: '+5.2%', color: 'text-brand-yellow' },
                  { label: 'Active Users (7d)', value: '1,284', icon: Activity, trend: '+8.1%', color: 'text-brand-blue' },
                  { label: 'Total XP Generated', value: '4.2M', icon: Zap, trend: '+15.4%', color: 'text-brand-yellow' },
                  { label: 'Total Sectors', value: sectors.length, icon: MapIcon, trend: '0.0%', color: 'text-brand-blue' },
                  { label: 'Total Games', value: missions.length, icon: Play, trend: '+4.2%', color: 'text-rose-500' },
                  { label: 'Avg Session Time', value: '24m', icon: Terminal, trend: '+2.1%', color: 'text-slate-500' },
                  { label: 'Retention Rate', value: '78%', icon: TrendingUp, trend: '+3.2%', color: 'text-cyan-500' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white/70 backdrop-blur-md p-8 rounded-[32px] border border-white/50 relative overflow-hidden group shadow-xl">
                    <stat.icon className={`absolute -right-4 -bottom-4 size-24 ${stat.color} opacity-5 group-hover:opacity-10 transition-opacity`} />
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                    <h3 className="text-4xl font-black text-slate-900 tracking-tighter italic">{stat.value}</h3>
                    <div className="flex items-center gap-1 mt-3 text-brand-blue text-[10px] font-bold uppercase tracking-widest">
                      <TrendingUp className="size-3" />
                      <span>{stat.trend}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Engagement Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 bg-white/40 backdrop-blur-xl p-10 rounded-[40px] border border-white/50 shadow-xl">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic mb-10 flex items-center gap-3">
                    <Activity className="text-brand-blue" />
                    Engagement Heatmap
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top Performing Sectors</p>
                      {sectors.slice(0, 4).map((s, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between text-xs font-bold">
                            <span>{s.name}</span>
                            <span>{95 - i * 10}% Completion</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-blue" style={{ width: `${95 - i * 10}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Critical Drop-off Points</p>
                      {[
                        { label: 'Neural Sync Tutorial', rate: '12%' },
                        { label: 'Quantum Gate Quiz', rate: '8%' },
                        { label: 'Sector 3 Transition', rate: '15%' },
                      ].map((d, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
                          <span className="text-xs font-bold text-slate-700">{d.label}</span>
                          <span className="text-xs font-black text-red-500">{d.rate} Exit</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white/40 backdrop-blur-xl p-10 rounded-[40px] border border-white/50 shadow-xl">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic mb-10 flex items-center gap-3">
                    <Zap className="text-brand-yellow" />
                    Live Activity
                  </h3>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                    {logs.slice(0, 10).map(log => (
                      <div key={log.id} className="p-4 bg-white/60 rounded-2xl border border-white/50 text-[10px] font-medium">
                        <span className="text-slate-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        <p className="mt-1 text-slate-700">{log.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-10">
              <div className="bg-white/40 backdrop-blur-xl p-10 rounded-[40px] border border-white/50 shadow-xl">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">User Management</h3>
                  <div className="flex gap-4">
                    <button className="bg-brand-blue text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-blue/90 transition-all shadow-lg shadow-brand-blue/20">
                      Single Create
                    </button>
                    <button className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 flex items-center gap-2">
                      <Database className="size-3" />
                      Bulk Upload (CSV)
                    </button>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em]">
                        <th className="pb-6">Operator</th>
                        <th className="pb-6">Role</th>
                        <th className="pb-6">Status</th>
                        <th className="pb-6">Neural XP</th>
                        <th className="pb-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {students.map(s => (
                        <tr key={s.id} className="border-b border-slate-50 last:border-0 group hover:bg-slate-50/50 transition-colors">
                          <td className="py-6">
                            <div className="flex items-center gap-4">
                              <img src={s.avatar_url} className="size-10 rounded-xl object-cover border border-white/50" alt="" referrerPolicy="no-referrer" />
                              <div>
                                <p className="font-black text-slate-900 uppercase tracking-tight italic">{s.name}</p>
                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">ID: {s.id.toString().padStart(4, '0')}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-6">
                            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                              s.role === 'admin' ? 'bg-brand-yellow/10 text-brand-yellow border-brand-yellow/20' :
                              s.role === 'teacher' ? 'bg-brand-blue/10 text-brand-blue border-brand-blue/20' :
                              'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              {s.role}
                            </span>
                          </td>
                          <td className="py-6">
                            <div className="flex items-center gap-2">
                              <div className="size-2 bg-brand-blue rounded-full animate-pulse" />
                              <span className="text-[10px] font-black uppercase text-slate-500">Active</span>
                            </div>
                          </td>
                          <td className="py-6 font-mono font-black text-brand-blue">{s.xp.toLocaleString()} XP</td>
                          <td className="py-6 text-right">
                            <div className="flex justify-end gap-2">
                              <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-brand-blue"><Settings className="size-4" /></button>
                              <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-brand-yellow"><Zap className="size-4" /></button>
                              <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-red-500"><Lock className="size-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sectors' && (
            <div className="space-y-10">
              <div className="bg-white/40 backdrop-blur-xl p-10 rounded-[40px] border border-white/50 shadow-xl">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Sector Engine</h3>
                  <button className="bg-brand-blue text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-blue/90 transition-all shadow-xl shadow-brand-blue/20 flex items-center gap-3">
                    <Plus className="size-4" />
                    Initialize New Sector
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {sectors.map(s => (
                    <div key={s.id} className="bg-white/60 border border-white/50 rounded-[32px] p-8 group hover:border-brand-blue/30 transition-all relative overflow-hidden">
                      <div className="flex items-start justify-between mb-6">
                        <div className="size-16 rounded-[24px] bg-slate-100 flex items-center justify-center border border-slate-200 group-hover:bg-brand-blue/10 group-hover:border-brand-blue/20 transition-all">
                          <MapIcon className="size-8 text-slate-400 group-hover:text-brand-blue transition-colors" />
                        </div>
                        <div className="flex gap-2">
                          <button className="p-2 bg-white rounded-xl border border-white/50 shadow-sm hover:text-brand-blue transition-colors"><Settings className="size-4" /></button>
                          <button className="p-2 bg-white rounded-xl border border-white/50 shadow-sm hover:text-brand-yellow transition-colors"><Lock className="size-4" /></button>
                        </div>
                      </div>
                      <h4 className="text-2xl font-black uppercase tracking-tight italic mb-2">{s.name}</h4>
                      <p className="text-slate-500 text-xs font-medium mb-6 line-clamp-2">{s.description}</p>
                      <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-100">
                        <div>
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Required Level</p>
                          <p className="text-sm font-black text-slate-900">LVL {s.required_level}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">XP Reward Range</p>
                          <p className="text-sm font-black text-brand-blue">{s.xp_reward} - {s.xp_reward + 500} XP</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'games' && (
            <div className="space-y-10">
              <div className="bg-white/40 backdrop-blur-xl p-10 rounded-[40px] border border-white/50 shadow-xl">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Game Forge</h3>
                  <button className="bg-brand-blue text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-blue/90 transition-all shadow-xl shadow-brand-blue/20 flex items-center gap-3">
                    <Plus className="size-4" />
                    Upload Game Module
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {missions.map(m => (
                    <div key={m.id} className="bg-white/60 border border-white/50 rounded-[32px] overflow-hidden group hover:border-brand-blue/30 transition-all shadow-sm">
                      <div className="h-32 bg-slate-100 relative">
                        <img src={m.image_url} className="w-full h-full object-cover opacity-50" alt="" referrerPolicy="no-referrer" />
                        <div className="absolute top-4 right-4 px-3 py-1 bg-white/80 backdrop-blur-md rounded-lg border border-white/50 text-[9px] font-black uppercase tracking-widest">
                          {m.difficulty}
                        </div>
                      </div>
                      <div className="p-6">
                        <h4 className="text-lg font-black uppercase tracking-tight italic mb-4">{m.title}</h4>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="p-3 bg-slate-50 rounded-2xl">
                            <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">Plays</p>
                            <p className="text-sm font-black text-slate-900">1.2k</p>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-2xl">
                            <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">Completion</p>
                            <p className="text-sm font-black text-brand-blue">84%</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button className="flex-1 bg-brand-blue/10 text-brand-blue py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-brand-blue hover:text-white transition-all">Edit Module</button>
                          <button className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Lock className="size-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <MissionSetup sectors={sectors} canEmbed />
            </div>
          )}

          {activeTab === 'outcomes' && (
            <div className="bg-white/40 backdrop-blur-xl p-10 rounded-[40px] border border-white/50 shadow-xl">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Learning Outcome Engine</h3>
                <button className="bg-brand-blue text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-blue/90 transition-all shadow-xl shadow-brand-blue/20">
                  Define Outcome
                </button>
              </div>
              <div className="space-y-4">
                {[
                  { title: 'Quantum Mechanics Mastery', subject: 'Physics', grade: '12', bloom: 'Analyze', frequency: '85%' },
                  { title: 'Orbital Trajectory Calculation', subject: 'Mathematics', grade: '11', bloom: 'Apply', frequency: '62%' },
                  { title: 'Neural Network Architecture', subject: 'Computer Science', grade: '12', bloom: 'Create', frequency: '45%' },
                ].map((o, i) => (
                  <div key={i} className="p-6 bg-white/60 border border-white/50 rounded-3xl flex items-center justify-between group hover:border-brand-blue/30 transition-all">
                    <div className="flex items-center gap-6">
                      <div className="size-12 rounded-2xl bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                        <Award className="size-6" />
                      </div>
                      <div>
                        <h4 className="font-black uppercase tracking-tight italic text-slate-900">{o.title}</h4>
                        <div className="flex gap-3 mt-1">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{o.subject}</span>
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">•</span>
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Grade {o.grade}</span>
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">•</span>
                          <span className="text-[9px] font-black uppercase text-brand-blue tracking-widest">{o.bloom}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Achievement Freq</p>
                      <p className="text-lg font-black text-slate-900 italic">{o.frequency}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'economy' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="bg-white/40 backdrop-blur-xl p-10 rounded-[40px] border border-white/50 shadow-xl">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic mb-10">XP Scaling & Progression</h3>
                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Global XP Multiplier</label>
                    <div className="flex items-center gap-6">
                      <input type="range" className="flex-1 accent-brand-blue" min="0.5" max="5.0" step="0.1" defaultValue="1.0" />
                      <span className="text-xl font-black text-brand-blue italic">1.0x</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Level Threshold Scaling</label>
                    <select className="w-full bg-white/60 border border-white/50 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-brand-blue/50">
                      <option>Linear (1000 XP / Level)</option>
                      <option>Exponential (1.2x per Level)</option>
                      <option>Logarithmic</option>
                    </select>
                  </div>
                  <button className="w-full bg-brand-blue text-white py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-blue/90 transition-all">Apply Economy Sync</button>
                </div>
              </div>
              <div className="bg-white/40 backdrop-blur-xl p-10 rounded-[40px] border border-white/50 shadow-xl">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic mb-10">Neural Override</h3>
                <p className="text-slate-500 text-xs mb-8">Manually adjust operator XP or reset progression streaks for specific users.</p>
                <div className="space-y-6">
                  <input placeholder="Search Operator Name or ID..." className="w-full bg-white/60 border border-white/50 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-brand-blue/50" />
                  <div className="flex gap-4">
                    <button className="flex-1 bg-slate-100 text-slate-400 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-not-allowed">Adjust XP</button>
                    <button className="flex-1 bg-slate-100 text-slate-400 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-not-allowed">Reset Streak</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'institutions' && (
            <div className="bg-white/40 backdrop-blur-xl p-10 rounded-[40px] border border-white/50 shadow-xl">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Institution Management</h3>
                <button className="bg-brand-blue text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-blue/90 transition-all shadow-xl shadow-brand-blue/20">
                  Register New Institution
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[
                  { name: 'Nova Academy', teachers: 12, students: 450, status: 'Active' },
                  { name: 'Stellar High', teachers: 8, students: 320, status: 'Active' },
                  { name: 'Cyber Institute', teachers: 15, students: 600, status: 'Trial' },
                ].map((inst, i) => (
                  <div key={i} className="p-8 bg-white/60 border border-white/50 rounded-[32px] group hover:border-brand-blue/30 transition-all">
                    <div className="size-12 rounded-2xl bg-brand-blue/10 flex items-center justify-center text-brand-blue mb-6">
                      <School className="size-6" />
                    </div>
                    <h4 className="text-xl font-black uppercase tracking-tight italic mb-4">{inst.name}</h4>
                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <span>Teachers</span>
                        <span className="text-slate-900">{inst.teachers}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <span>Students</span>
                        <span className="text-slate-900">{inst.students}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                      <span className={`text-[9px] font-black uppercase tracking-widest ${inst.status === 'Active' ? 'text-brand-blue' : 'text-brand-yellow'}`}>{inst.status}</span>
                      <button className="text-brand-blue text-[9px] font-black uppercase tracking-widest hover:underline">View Analytics</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'moderation' && (
            <div className="bg-white/40 backdrop-blur-xl p-10 rounded-[40px] border border-white/50 shadow-xl">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic mb-10">Content Moderation</h3>
              <div className="space-y-6">
                {[
                  { type: 'Game Module', title: 'Quantum Chaos', author: 'User_42', reason: 'Pending Approval' },
                  { type: 'Comment', title: 'Great mission!', author: 'Alex_R', reason: 'Flagged: Spam' },
                ].map((m, i) => (
                  <div key={i} className="p-6 bg-white/60 border border-white/50 rounded-3xl flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className={`size-12 rounded-2xl flex items-center justify-center ${m.reason.includes('Flagged') ? 'bg-red-500/10 text-red-500' : 'bg-brand-yellow/10 text-brand-yellow'}`}>
                        <Shield className="size-6" />
                      </div>
                      <div>
                        <h4 className="font-black uppercase tracking-tight italic text-slate-900">{m.title}</h4>
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{m.type} • By {m.author}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button className="px-6 py-2 bg-brand-blue text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-brand-blue/90 transition-all">Approve</button>
                      <button className="px-6 py-2 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-600 transition-all">Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white/40 backdrop-blur-xl p-10 rounded-[40px] border border-white/50 shadow-xl">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic mb-10">System Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Platform Theme Preset</label>
                    <div className="flex gap-3">
                      <div className="size-10 rounded-xl bg-brand-blue border-2 border-brand-blue ring-2 ring-brand-blue/20 cursor-pointer" />
                      <div className="size-10 rounded-xl bg-slate-900 border border-slate-200 cursor-pointer" />
                      <div className="size-10 rounded-xl bg-brand-yellow border border-slate-200 cursor-pointer" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Global Announcements</label>
                    <textarea rows={3} className="w-full bg-white/60 border border-white/50 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-brand-blue/50" placeholder="Broadcast message to all users..." />
                    <button className="w-full bg-brand-blue text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-blue/90 transition-all">Publish Broadcast</button>
                  </div>
                </div>
                <div className="space-y-8">
                  <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-3xl">
                    <h4 className="text-xs font-black text-red-500 uppercase tracking-widest mb-4">Danger Zone</h4>
                    <div className="space-y-4">
                      <button className="w-full py-4 border border-red-500/20 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Maintenance Mode</button>
                      <button className="w-full py-4 border border-red-500/20 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Clear System Logs</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const TeacherHub = ({ sectors, students, student }: { sectors: Sector[], students: Student[], student: Student }) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'classroom' | 'missions' | 'reports'>('analytics');
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [assignedMissions, setAssignedMissions] = useState<Mission[]>([]);
  const [assignedQuizzes, setAssignedQuizzes] = useState<any[]>([]);

  useEffect(() => {
    safeFetch('/api/classes').then(data => {
      if (data) {
        const teacherClasses = data.filter((c: Class) => c.teacher_id === student.id);
        setClasses(teacherClasses);
        if (teacherClasses.length > 0) setSelectedClassId(teacherClasses[0].id);
      }
    });
  }, [student.id]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-4 mb-10">
        {[
          { id: 'analytics', label: 'Neural Analytics', icon: BarChart3 },
          { id: 'classroom', label: 'Classroom Manager', icon: Users },
          { id: 'missions', label: 'Mission Architect', icon: Rocket },
          { id: 'reports', label: 'Report Cards', icon: ClipboardList },
        ].map(tab => (
            <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
              activeTab === tab.id 
                ? 'bg-brand-blue text-white border-brand-blue shadow-xl shadow-brand-blue/20' 
                : 'bg-white/40 backdrop-blur-xl text-slate-400 border-white/50 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <div className="bg-white/40 backdrop-blur-xl p-10 rounded-[40px] border border-white/50 shadow-xl">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-xl font-black flex items-center gap-3 text-slate-900 uppercase tracking-tighter italic">
                  <BarChart3 className="text-brand-blue size-6" />
                  Class Mastery Matrix
                </h3>
              </div>
              <div className="space-y-8">
                {[
                  { label: 'Quantum Entanglement', value: 88, color: 'bg-brand-blue' },
                  { label: 'Orbital Mechanics', value: 64, color: 'bg-brand-yellow' },
                  { label: 'Neural Networks', value: 42, color: 'bg-brand-blue' },
                  { label: 'Thermodynamics', value: 92, color: 'bg-brand-blue/80' },
                ].map((skill, i) => (
                  <div key={i} className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em]">
                      <span className="text-slate-400">{skill.label}</span>
                      <span className="text-slate-900">{skill.value}% Mastery</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${skill.value}%` }}
                        className={`h-full ${skill.color} shadow-[0_0_10px_rgba(0,0,0,0.1)]`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <QuizTool student={student} />
          </div>

          <div className="space-y-10">
            <div className="bg-white/40 backdrop-blur-xl p-8 rounded-[40px] border border-white/50 shadow-xl">
              <h3 className="text-xl font-black mb-6 text-slate-900 uppercase tracking-tighter italic flex items-center gap-3">
                <Award className="text-amber-500" />
                Grant Rewards
              </h3>
              <p className="text-[11px] text-slate-500 mb-4">
                Select a student and grant a custom badge. It will appear in their Achievement Hall.
              </p>
              <GrantRewardForm students={students.filter(s => s.role === 'student')} />
            </div>
            <div className="bg-white/40 backdrop-blur-xl p-10 rounded-[40px] border border-white/50 shadow-xl">
              <h3 className="text-xl font-black mb-10 text-slate-900 uppercase tracking-tighter italic">Neural Sync Rate</h3>
              <div className="flex flex-col items-center justify-center py-8">
                <div className="relative size-48">
                  <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-100" strokeWidth="3" />
                    <motion.circle 
                      cx="18" cy="18" r="16" fill="none" 
                      className="stroke-brand-blue" 
                      strokeWidth="3" 
                      strokeDasharray="100"
                      initial={{ strokeDashoffset: 100 }}
                      animate={{ strokeDashoffset: 15 }}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-black text-slate-900 italic">85%</span>
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">Active Sync</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'classroom' && (
        <ClassroomManager teacherId={student.id} students={students} />
      )}

      {activeTab === 'missions' && (
        <MissionSetup sectors={sectors} canEmbed={false} />
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
            <h3 className="text-lg font-black text-white uppercase tracking-tighter">Select Classroom</h3>
            <select 
              value={selectedClassId || ''}
              onChange={e => setSelectedClassId(parseInt(e.target.value))}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-brand-blue font-black uppercase tracking-widest text-[10px] outline-none focus:border-brand-blue/50"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              {classes.length === 0 && <option disabled>No Classrooms Initialized</option>}
            </select>
          </div>
          {selectedClassId ? (
            <ReportCard classId={selectedClassId} />
          ) : (
            <div className="bg-slate-900/50 backdrop-blur-md p-20 rounded-3xl border border-slate-800 text-center">
              <Users className="size-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500 font-mono text-sm italic">Initialize a classroom to generate performance reports.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ClassroomManager = ({ teacherId, students }: { teacherId: number, students: Student[] }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);

  const fetchClasses = async () => {
    const data = await safeFetch('/api/classes');
    if (data) {
      setClasses(data as Class[]);
    }
    const missionsData = await safeFetch('/api/missions');
    if (missionsData) setMissions(missionsData);
    const quizzesData = await safeFetch('/api/quizzes');
    if (quizzesData) setQuizzes(quizzesData);
    setLoading(false);
  };

  const fetchClassContent = async (classId: number) => {
    const data = await safeFetch(`/api/classes/${classId}/content`);
    if (data) {
      setAssignedMissions(data.missions || []);
      setAssignedQuizzes(data.quizzes || []);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const createClass = async () => {
    if (!newClassName) return;
    await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newClassName, teacher_id: teacherId, description: '' })
    });
    setNewClassName('');
    fetchClasses();
    if (selectedClass) {
      fetchClassContent(selectedClass.id);
    }
  };

  const addStudentToClass = async (studentId: number) => {
    if (!selectedClass) return;
    await fetch(`/api/classes/${selectedClass.id}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId })
    });
    fetchClasses();
  };

  const assignMissionToClass = async (missionId: number) => {
    if (!selectedClass) return;
    await fetch(`/api/classes/${selectedClass.id}/missions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mission_id: missionId })
    });
    fetchClassContent(selectedClass.id);
  };

  const assignQuizToClass = async (quizId: number) => {
    if (!selectedClass) return;
    await fetch(`/api/classes/${selectedClass.id}/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz_id: quizId })
    });
    fetchClassContent(selectedClass.id);
  };

  const unassignMissionFromClass = async (missionId: number) => {
    if (!selectedClass) return;
    await fetch(`/api/classes/${selectedClass.id}/missions/${missionId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    fetchClassContent(selectedClass.id);
  };

  const unassignQuizFromClass = async (quizId: number) => {
    if (!selectedClass) return;
    await fetch(`/api/classes/${selectedClass.id}/quizzes/${quizId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    fetchClassContent(selectedClass.id);
  };

  return (
    <div className="space-y-10">
      <div className="bg-white/40 backdrop-blur-xl p-10 rounded-[40px] border border-white/50 shadow-xl">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-8 italic">Squad Initialization</h3>
        <div className="flex gap-4">
          <input 
            type="text" 
            value={newClassName}
            onChange={e => setNewClassName(e.target.value)}
            placeholder="Squad Designation (e.g. Physics Alpha)"
            className="flex-1 bg-white/60 border border-white/50 rounded-2xl px-8 py-4 text-slate-900 font-black uppercase tracking-tight italic outline-none focus:border-brand-blue/50 transition-all placeholder:text-slate-300"
          />
          <button 
            onClick={createClass}
            className="bg-brand-blue text-white font-black px-10 py-4 rounded-2xl uppercase tracking-[0.2em] text-[10px] hover:bg-brand-blue/90 transition-all shadow-xl shadow-brand-blue/20 active:scale-95"
          >
            Initialize
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white/40 backdrop-blur-xl p-10 rounded-[40px] border border-white/50 shadow-xl">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-8 italic">Active Squads</h3>
          <div className="space-y-4">
            {classes.map(c => (
              <button 
                key={c.id}
                onClick={() => { 
                  setSelectedClass(c);
                  fetchClassContent(c.id);
                }}
                className={`w-full flex items-center justify-between p-6 rounded-[24px] border transition-all relative overflow-hidden group ${
                  selectedClass?.id === c.id 
                    ? 'bg-brand-blue text-white border-brand-blue shadow-xl shadow-brand-blue/20' 
                    : 'bg-white/60 border-white/50 hover:border-brand-blue/30'
                }`}
              >
                <div className="text-left relative z-10">
                  <p className="font-black uppercase tracking-tight text-lg italic">{c.name}</p>
                  <p className={`text-[9px] uppercase font-black tracking-widest mt-1 ${
                    selectedClass?.id === c.id ? 'text-white/60' : 'text-brand-blue'
                  }`}>
                    {c.student_count} Operators Active
                  </p>
                </div>
                <ChevronRight className={`size-6 relative z-10 transition-transform group-hover:translate-x-1 ${
                  selectedClass?.id === c.id ? 'text-white' : 'text-slate-300'
                }`} />
                {selectedClass?.id === c.id && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/10 pointer-events-none" />
                )}
              </button>
            ))}
          </div>
        </div>

        {selectedClass && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/40 backdrop-blur-xl p-10 rounded-[40px] border border-white/50 shadow-xl space-y-10"
          >
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-4 italic">
              Sync Operators: {selectedClass.name}
            </h3>
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-4 custom-scrollbar">
              {students.filter(s => s.role === 'student').map(s => (
                <div key={s.id} className="flex items-center justify-between p-4 bg-white/60 border border-white/50 rounded-2xl group hover:border-brand-blue/30 transition-all">
                  <div className="flex items-center gap-4">
                    <img src={s.avatar_url} className="size-12 rounded-xl object-cover border border-white/50" alt="" referrerPolicy="no-referrer" />
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight italic">{s.name}</p>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Lvl {s.level} Operator</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => addStudentToClass(s.id)}
                    className="px-4 py-2 bg-brand-blue/10 text-brand-blue rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-brand-blue hover:text-white transition-all border border-brand-blue/20"
                  >
                    Sync
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Rocket className="size-4 text-brand-blue" />
                  Assign Missions
                </h4>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {missions.map(m => (
                    <button
                      key={m.id}
                      onClick={() => assignMissionToClass(m.id)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-200 bg-white/60 hover:border-brand-blue/40 hover:bg-brand-blue/5 text-left text-xs font-bold transition-all"
                    >
                      <span className="text-slate-700 line-clamp-1">{m.title}</span>
                      <span className="text-[9px] uppercase tracking-widest text-brand-blue">Assign</span>
                    </button>
                  ))}
                  {missions.length === 0 && (
                    <p className="text-slate-400 text-xs italic">No missions created yet.</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <ClipboardList className="size-4 text-brand-blue" />
                  Assign Quizzes
                </h4>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {quizzes.map(q => (
                    <button
                      key={q.id}
                      onClick={() => assignQuizToClass(q.id)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-200 bg-white/60 hover:border-brand-blue/40 hover:bg-brand-blue/5 text-left text-xs font-bold transition-all"
                    >
                      <span className="text-slate-700 line-clamp-1">{q.title}</span>
                      <span className="text-[9px] uppercase tracking-widest text-brand-blue">Assign</span>
                    </button>
                  ))}
                  {quizzes.length === 0 && (
                    <p className="text-slate-400 text-xs italic">No quizzes created yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                <Rocket className="size-4 text-brand-blue" />
                Assigned Missions
              </h4>
              <div className="flex flex-wrap gap-2 mb-6">
                {assignedMissions.length === 0 && (
                  <p className="text-[11px] text-slate-400 italic">No missions assigned to this squad yet.</p>
                )}
                {assignedMissions.map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-1 rounded-full bg-brand-blue/5 border border-brand-blue/20 text-[10px] font-black text-brand-blue">
                    <span className="truncate max-w-[140px]">{m.title}</span>
                    <button
                      onClick={() => unassignMissionFromClass(m.id)}
                      className="text-[10px] text-slate-400 hover:text-red-500 ml-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <h4 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                <ClipboardList className="size-4 text-brand-blue" />
                Assigned Quizzes
              </h4>
              <div className="flex flex-wrap gap-2">
                {assignedQuizzes.length === 0 && (
                  <p className="text-[11px] text-slate-400 italic">No quizzes assigned to this squad yet.</p>
                )}
                {assignedQuizzes.map(q => (
                  <div key={q.id} className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-black text-slate-700">
                    <span className="truncate max-w-[140px]">{q.title}</span>
                    <button
                      onClick={() => unassignQuizFromClass(q.id)}
                      className="text-[10px] text-slate-400 hover:text-red-500 ml-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
const StudentDashboard = ({ student, onOpenSettings }: { student: Student; onOpenSettings?: () => void }) => {
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);

  useEffect(() => {
    safeFetch(`/api/students/${student.id}/progress`).then(data => {
      if (data) setProgress(data);
    });
    safeFetch(`/api/students/${student.id}/classes`).then(data => {
      if (data) setClasses(data);
    });
  }, [student.id]);

  const detailItems = [
    { label: 'Email', value: student.email || '—' },
    { label: 'Age', value: student.age != null ? String(student.age) : '—' },
    { label: 'Grade', value: student.grade || '—' },
    { label: 'School', value: student.school || '—' },
    { label: 'City', value: student.city || '—' },
    { label: 'Parent / Guardian email', value: student.parent_email || '—' },
    { label: 'Contact number', value: student.contact_number || '—' },
  ];

  const masteryData = [
    { subject: 'Quantum Physics', mastery: 85, color: 'bg-brand-blue' },
    { subject: 'Orbital Mechanics', mastery: 62, color: 'bg-brand-yellow' },
    { subject: 'Neural Biology', mastery: 45, color: 'bg-brand-blue/60' },
    { subject: 'Cyber Security', mastery: 92, color: 'bg-rose-500' },
  ];

  return (
    <div className="space-y-12">
      {/* Hero Profile Section */}
      <div className="relative bg-white/40 backdrop-blur-2xl rounded-[40px] border border-white/50 p-10 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
          <Rocket className="size-64 -rotate-12" />
        </div>
        
        <div className="flex flex-col lg:flex-row gap-12 items-center relative z-10">
          <div className="relative">
            <div className="absolute -inset-4 bg-brand-blue/20 rounded-full blur-2xl animate-pulse" />
            <div className="relative size-48 rounded-[40px] border-4 border-white overflow-hidden shadow-2xl">
              <img src={student.avatar_url} className="size-full object-cover" alt="" referrerPolicy="no-referrer" />
            </div>
            <div className="absolute -bottom-4 -right-4 bg-brand-blue text-white px-4 py-2 rounded-xl font-black text-sm shadow-xl border-2 border-white">
              LVL {student.level}
            </div>
          </div>

          <div className="flex-1 text-center lg:text-left">
            <p className="text-[10px] font-black text-brand-blue uppercase tracking-[0.4em] mb-2">Operator Identity Confirmed</p>
            <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter mb-4 italic">{student.name}</h2>
            <div className="flex flex-wrap justify-center lg:justify-start gap-4">
              <div className="bg-white/60 px-6 py-3 rounded-2xl border border-white/50 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total XP</p>
                <p className="text-xl font-black text-slate-900 font-mono">{student.xp}</p>
              </div>
              <div className="bg-white/60 px-6 py-3 rounded-2xl border border-white/50 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Neural Sync</p>
                <p className="text-xl font-black text-brand-blue font-mono">85.4%</p>
              </div>
              <div className="bg-white/60 px-6 py-3 rounded-2xl border border-white/50 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Missions</p>
                <p className="text-xl font-black text-slate-900 font-mono">{progress?.quizzes.length || 0}</p>
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
          <div className="bg-white/40 backdrop-blur-xl p-8 rounded-[40px] border border-white/50 shadow-xl">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-8 flex items-center gap-3">
              <Activity className="text-brand-blue" />
              Neural Skill Matrix
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {masteryData.map((m, i) => (
                <div key={i} className="relative group">
                  <div className="flex justify-between items-end mb-3">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{m.subject}</span>
                    <span className="text-xs font-mono font-black text-brand-blue">{m.mastery}%</span>
                  </div>
                  <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden border border-white/50 p-0.5">
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

          <div className="bg-white/40 backdrop-blur-xl p-8 rounded-[40px] border border-white/50 shadow-xl">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-8 flex items-center gap-3">
              <ClipboardList className="text-brand-blue" />
              Mission Log Archive
            </h3>
            <div className="space-y-4">
              {progress?.quizzes.map((q, i) => (
                <div key={i} className="flex items-center justify-between p-5 bg-white/40 border border-white/50 rounded-3xl hover:bg-white/60 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                      <Zap className="size-5" />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 uppercase tracking-tight text-sm">{q.title}</p>
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
          <div className="bg-white/40 backdrop-blur-xl p-8 rounded-[40px] border border-white/50 shadow-xl">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-6 flex items-center gap-3">
              <Users className="text-brand-blue" />
              My Classes
            </h3>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar text-sm">
              {classes.length === 0 && (
                <p className="text-slate-400 italic">
                  You are not enrolled in any classrooms yet. Your teacher can add you from the Classroom Manager.
                </p>
              )}
              {classes.map(c => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-white/60 border border-white/50"
                >
                  <div>
                    <p className="font-black text-slate-900 uppercase tracking-tight text-xs">{c.name}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">
                      {c.teacher_name} • {c.student_count} students
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/40 backdrop-blur-xl p-8 rounded-[40px] border border-white/50 shadow-xl">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-8 flex items-center gap-3">
              <Trophy className="text-amber-500" />
              Neural Achievements
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {progress?.badges.map((b, i) => (
                <motion.div 
                  key={i} 
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  className="aspect-square bg-white/60 rounded-3xl border border-white/50 flex items-center justify-center group relative shadow-sm"
                >
                  <span className="text-3xl">{b.badge_icon || '🚀'}</span>
                  <div className="absolute -bottom-2 bg-brand-blue text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    Unlocked
                  </div>
                </motion.div>
              ))}
              {Array.from({ length: 6 - (progress?.badges.length || 0) }).map((_, i) => (
                <div key={i} className="aspect-square bg-white/20 rounded-3xl border border-white/30 border-dashed flex items-center justify-center">
                  <Lock className="size-6 text-slate-300" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-brand-blue to-brand-blue/80 p-1 rounded-[40px] shadow-2xl shadow-brand-blue/20">
            <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[38px] h-full">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-6 flex items-center gap-3">
                <Zap className="text-white" />
                Active Assessment
              </h3>
              <QuizTool 
                student={student} 
                completedQuizIds={progress?.quizzes.map((q: any) => q.quiz_id) || []} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
const ReportCard = ({ classId }: { classId: number }) => {
  const [report, setReport] = useState<any[]>([]);

  useEffect(() => {
    safeFetch(`/api/report-card/${classId}`).then(data => {
      if (data) setReport(data);
    });
  }, [classId]);

  return (
    <div className="bg-white/40 backdrop-blur-xl p-10 rounded-[40px] border border-white/50 shadow-xl">
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue border border-brand-blue/20">
            <ClipboardList className="size-5" />
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">
            Squad Performance Log
          </h3>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-brand-blue hover:border-brand-blue/40 bg-white/70 shadow-sm"
        >
          Download PDF
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em]">
              <th className="pb-6">Operator</th>
              <th className="pb-6">Neural Level</th>
              <th className="pb-6">Simulations</th>
              <th className="pb-6">Sync Rate</th>
              <th className="pb-6">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm font-mono">
            {report.map(r => (
              <tr key={r.id} className="border-b border-slate-50 last:border-0 group hover:bg-brand-blue/5 transition-colors">
                <td className="py-6 font-black text-slate-900 uppercase tracking-tight italic">{r.name}</td>
                <td className="py-6 text-brand-blue font-black">LVL {r.level}</td>
                <td className="py-6 text-slate-500">{r.quizzes_completed}</td>
                <td className="py-6 text-slate-900 font-black">{Math.round(r.avg_quiz_score || 0)}%</td>
                <td className="py-6">
                  <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                    (r.avg_quiz_score || 0) >= 70 
                      ? 'bg-brand-blue/10 text-brand-blue border-brand-blue/20' 
                      : 'bg-brand-yellow/10 text-brand-yellow border-brand-yellow/20'
                  }`}>
                    {(r.avg_quiz_score || 0) >= 70 ? 'OPTIMAL' : 'SYNC REQUIRED'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
const GamePlayer = ({ mission, onComplete }: { mission: Mission, onComplete: () => void }) => {
  return (
    <div className="space-y-8">
      <div className="bg-black rounded-[40px] border border-brand-blue/30 overflow-hidden aspect-video relative shadow-2xl shadow-brand-blue/10">
        {mission.embed_code ? (
          <div 
            className="size-full"
            dangerouslySetInnerHTML={{ __html: mission.embed_code }}
          />
        ) : (
          <div className="size-full flex flex-col items-center justify-center p-12 text-center relative">
            <div className="absolute inset-0 opacity-10 pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #003c71 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            
            <div className="size-24 bg-brand-blue/10 rounded-[32px] flex items-center justify-center mb-8 border border-brand-blue/20 shadow-[0_0_30px_rgba(0,60,113,0.1)]">
              <Terminal className="text-brand-blue size-12" />
            </div>
            <h3 className="text-4xl font-black text-white uppercase italic mb-4 tracking-tighter">{mission.title}</h3>
            <p className="text-brand-blue/60 max-w-md font-mono text-xs mb-10 uppercase tracking-widest">{mission.description}</p>
            
            <div className="p-10 bg-slate-900/50 backdrop-blur-xl rounded-[32px] border border-white/10 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="text-left">
                  <p className="text-[9px] uppercase font-black text-brand-blue/50 tracking-[0.2em] mb-1">Neural Training</p>
                  <p className="text-xs font-black text-white uppercase">Simulation Ready</p>
                </div>
                <div className="size-2 bg-brand-blue rounded-full animate-pulse shadow-[0_0_8px_rgba(0,60,113,0.5)]" />
              </div>
              <button 
                onClick={onComplete}
                className="w-full bg-brand-blue text-white font-black py-5 rounded-2xl uppercase tracking-[0.2em] text-xs hover:bg-brand-blue/90 transition-all shadow-xl shadow-brand-blue/20 active:scale-95"
              >
                Execute Protocol
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
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Neural Reward</span>
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
const MissionSetup = ({ sectors, canEmbed = false }: { sectors: Sector[], canEmbed?: boolean }) => {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [formData, setFormData] = useState({
    title: '',
    sector_id: sectors[0]?.id || 1,
    description: '',
    difficulty: 'Medium',
    xp_reward: 500,
    embed_code: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    
    try {
      const response = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        setStatus('success');
        setFormData({
          title: '',
          sector_id: sectors[0]?.id || 1,
          description: '',
          difficulty: 'Medium',
          xp_reward: 500,
          embed_code: ''
        });
        setTimeout(() => setStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('Failed to deploy mission:', error);
      setStatus('idle');
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white/40 backdrop-blur-xl p-12 rounded-[40px] border border-white/50 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
        <Rocket className="size-48" />
      </div>

      <div className="flex items-center gap-6 mb-12">
        <div className="size-16 rounded-[24px] bg-brand-blue text-white flex items-center justify-center shadow-xl shadow-brand-blue/20">
          <Rocket className="size-8" />
        </div>
        <div>
          <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Mission Architect</h3>
          <p className="text-slate-500 font-medium uppercase text-[10px] tracking-widest">Design and deploy new tactical objectives</p>
        </div>
      </div>

      <form className="space-y-10" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-3">
            <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-2">Mission Designation</label>
            <input 
              type="text" 
              required 
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="e.g. Quantum Gate Mastery" 
              className="w-full bg-white/60 border border-white/50 rounded-2xl px-8 py-5 text-slate-900 placeholder:text-slate-300 focus:border-brand-blue/50 focus:ring-4 focus:ring-brand-blue/5 outline-none transition-all text-lg font-black italic uppercase tracking-tight" 
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-2">Sector Assignment</label>
            <div className="relative">
              <select 
                value={formData.sector_id}
                onChange={e => setFormData({...formData, sector_id: parseInt(e.target.value)})}
                className="w-full bg-white/60 border border-white/50 rounded-2xl px-8 py-5 text-slate-900 focus:border-brand-blue/50 outline-none appearance-none font-black uppercase tracking-tight text-lg italic cursor-pointer"
              >
                {sectors.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 size-5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-2">Embedded Game (Optional)</label>
          <p className="text-[10px] text-slate-400 mb-1">
            Paste an embed snippet (iframe or script) from your game platform. It will render for students inside the mission player.
          </p>
          <textarea
            rows={4}
            value={formData.embed_code}
            onChange={e => setFormData({ ...formData, embed_code: e.target.value })}
            placeholder={`e.g. <iframe src="https://my-game.com/embed/123" class="w-full h-full" />`}
            className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-3xl px-6 py-4 font-mono text-xs placeholder:text-slate-500 focus:outline-none focus:border-brand-blue/60 focus:ring-2 focus:ring-brand-blue/20"
          />
        </div>

        <div className="space-y-3">
          <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-2">Objective Briefing</label>
          <textarea 
            rows={4} 
            required 
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
            placeholder="Describe the mission parameters and learning outcomes..."
            className="w-full bg-white/60 border border-white/50 rounded-3xl px-8 py-6 text-slate-900 placeholder:text-slate-300 focus:border-brand-blue/50 focus:ring-4 focus:ring-brand-blue/5 outline-none transition-all font-medium text-lg"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-3">
            <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-2">Difficulty Level</label>
            <div className="flex gap-4">
              {['Easy', 'Medium', 'Hard'].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setFormData({...formData, difficulty: d})}
                  className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    formData.difficulty === d 
                      ? 'bg-brand-blue text-white border-brand-blue shadow-lg shadow-brand-blue/20' 
                      : 'bg-white/60 text-slate-400 border-white/50 hover:bg-white'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-2">Neural Reward (XP)</label>
            <input 
              type="number" 
              required 
              value={formData.xp_reward}
              onChange={e => setFormData({...formData, xp_reward: parseInt(e.target.value)})}
              className="w-full bg-white/60 border border-white/50 rounded-2xl px-8 py-4 text-brand-blue font-mono text-xl font-black outline-none focus:border-brand-blue/50 transition-all" 
            />
          </div>
        </div>

        {canEmbed && (
          <div className="space-y-3">
            <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-2">Embedded Game (Admin Only)</label>
            <p className="text-[10px] text-slate-400 mb-1">
              Paste an embed snippet (iframe or script) from your game platform. It will render for students inside the mission player.
            </p>
            <textarea
              rows={4}
              value={formData.embed_code}
              onChange={e => setFormData({ ...formData, embed_code: e.target.value })}
              placeholder={`e.g. <iframe src="https://my-game.com/embed/123" class="w-full h-full" />`}
              className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-3xl px-6 py-4 font-mono text-xs placeholder:text-slate-500 focus:outline-none focus:border-brand-blue/60 focus:ring-2 focus:ring-brand-blue/20"
            />
          </div>
        )}

        <div className="pt-6">
          <button 
            type="submit" 
            disabled={status !== 'idle'}
            className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white font-black py-6 rounded-3xl uppercase tracking-[0.2em] text-sm transition-all shadow-2xl shadow-brand-blue/20 disabled:opacity-50 flex items-center justify-center gap-4 group active:scale-[0.98]"
          >
            {status === 'idle' ? (
              <>
                <Plus className="group-hover:rotate-90 transition-transform size-6" />
                Deploy Mission Protocol
              </>
            ) : status === 'submitting' ? (
              <Activity className="animate-spin size-6" />
            ) : (
              <>
                <CheckCircle2 className="size-6" />
                Protocol Deployed
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

const SquadLeaderboard = ({ student }: { student: Student }) => {
  const [classmates, setClassmates] = useState<Student[]>([]);
  const [levelPeers, setLevelPeers] = useState<Student[]>([]);

  useEffect(() => {
    safeFetch(`/api/students/${student.id}/classmates`).then(data => {
      if (data) setClassmates(data);
    });
    safeFetch('/api/students').then(data => {
      if (data) {
        const peers = (data as Student[])
          .filter(s => s.role === 'student' && s.level === student.level)
          .sort((a, b) => b.xp - a.xp);
        setLevelPeers(peers);
      }
    });
  }, [student.id, student.level]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Class Squad */}
      <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200 overflow-hidden shadow-2xl shadow-slate-200/50">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
            <Users className="text-brand-blue" />
            Class Squad
          </h3>
          <span className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
            Peers Near Your Level
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          {classmates.length === 0 && (
            <div className="p-6 text-center text-slate-400 text-sm italic">
              No squadmates detected yet. Ask your teacher to add more operators to your class.
            </div>
          )}
          {classmates.map((s, i) => (
            <div key={s.id} className="p-6 flex items-center gap-6 hover:bg-slate-50 transition-all group">
              <div className="w-8 text-center">
                <span className={`text-xl font-black font-mono ${i < 3 ? 'text-amber-500' : 'text-slate-300'}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <div className="relative">
                <img src={s.avatar_url} className="size-14 rounded-xl border border-slate-200 group-hover:border-brand-blue/50 transition-all object-cover" alt={s.name} referrerPolicy="no-referrer" />
                {i === 0 && <div className="absolute -top-2 -right-2 bg-brand-yellow text-white p-1 rounded-full shadow-lg"><Trophy className="size-3" /></div>}
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-black text-slate-900 group-hover:text-brand-blue transition-colors uppercase tracking-tight">{s.name}</h4>
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{s.role}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-slate-900 font-mono">{s.xp.toLocaleString()}</p>
                <p className="text-[9px] text-brand-blue font-black uppercase tracking-widest">Squad XP</p>
              </div>
              <div className="hidden sm:block pl-8">
                <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-brand-blue font-black font-mono">Lvl {s.level}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Global Level Leaderboard */}
      <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200 overflow-hidden shadow-2xl shadow-slate-200/50">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
            <Trophy className="text-amber-500" />
            Global Level {student.level} Rankings
          </h3>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
              Your Tier
            </span>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {levelPeers.length === 0 && (
            <div className="p-6 text-center text-slate-400 text-sm italic">
              No operators at your exact level yet. Push your XP to climb into the next tier.
            </div>
          )}
          {levelPeers.map((s, i) => (
            <div key={s.id} className="p-6 flex items-center gap-6 hover:bg-slate-50 transition-all group">
              <div className="w-8 text-center">
                <span className={`text-xl font-black font-mono ${s.id === student.id ? 'text-brand-blue' : i < 3 ? 'text-amber-500' : 'text-slate-300'}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <div className="relative">
                <img
                  src={s.avatar_url}
                  className="size-14 rounded-xl border border-slate-200 group-hover:border-brand-blue/50 transition-all object-cover"
                  alt={s.name}
                  referrerPolicy="no-referrer"
                />
                {s.id === student.id && (
                  <div className="absolute -top-2 -right-2 bg-brand-blue text-white px-2 py-0.5 rounded-full shadow-lg text-[9px] font-black uppercase tracking-widest">
                    You
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-black text-slate-900 group-hover:text-brand-blue transition-colors uppercase tracking-tight">
                  {s.name}
                </h4>
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Lvl {s.level}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-slate-900 font-mono">{s.xp.toLocaleString()}</p>
                <p className="text-[9px] text-brand-blue font-black uppercase tracking-widest">Global XP</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const GrantRewardForm = ({ students }: { students: Student[] }) => {
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [badgeName, setBadgeName] = useState('');
  const [badgeIcon, setBadgeIcon] = useState('🏅');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !badgeName) return;
    setSubmitting(true);
    try {
      await fetch('/api/student-badges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudentId,
          badge_name: badgeName,
          badge_icon: badgeIcon,
        }),
      });
      setBadgeName('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
          Select Operator
        </label>
        <select
          value={selectedStudentId}
          onChange={e => setSelectedStudentId(e.target.value ? parseInt(e.target.value) : '')}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-blue/50"
        >
          <option value="">Choose student…</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} (Lvl {s.level})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
          Reward Title
        </label>
        <input
          value={badgeName}
          onChange={e => setBadgeName(e.target.value)}
          placeholder="e.g. Lab Legend"
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-blue/50"
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
          Icon (emoji)
        </label>
        <input
          value={badgeIcon}
          onChange={e => setBadgeIcon(e.target.value)}
          maxLength={4}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-blue/50"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-brand-blue/20 disabled:opacity-50"
      >
        {submitting ? 'Granting…' : 'Grant Reward'}
      </button>
    </form>
  );
};

const AwardsView = () => {
  const achievements: Achievement[] = [
    { id: 1, title: "Quantum Pioneer", description: "Complete your first mission in the Quantum Sector", icon: "Rocket", unlocked: true, date: "2024-03-15" },
    { id: 2, title: "Master Architect", description: "Reach Level 20 in Robotics", icon: "Shield", unlocked: true, date: "2024-04-02" },
    { id: 3, title: "Bio-Hacker", description: "Successfully fold 100 proteins", icon: "Activity", unlocked: false },
    { id: 4, title: "Star Gazer", description: "Unlock the Astrophysics Sector", icon: "MapIcon", unlocked: false },
    { id: 5, title: "Logic Lord", description: "Complete all logic puzzles with 100% accuracy", icon: "Terminal", unlocked: true, date: "2024-05-10" },
    { id: 6, title: "Team Player", description: "Join a squad and complete a group mission", icon: "Users", unlocked: false },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {achievements.map(ach => (
          <div key={ach.id} className={`p-8 rounded-2xl border transition-all relative overflow-hidden group shadow-xl ${
            ach.unlocked 
              ? 'bg-white/70 backdrop-blur-md border-slate-200 hover:border-brand-blue/30 shadow-slate-200/50' 
              : 'bg-slate-50 border-slate-200 opacity-60 grayscale'
          }`}>
            <div className={`size-16 rounded-2xl flex items-center justify-center mb-6 border ${
              ach.unlocked ? 'bg-brand-blue/10 border-brand-blue/20 text-brand-blue' : 'bg-slate-100 border-slate-200 text-slate-400'
            }`}>
              <Award className="size-8" />
            </div>
            <h3 className={`text-xl font-black mb-2 uppercase tracking-tight ${ach.unlocked ? 'text-slate-900' : 'text-slate-400'}`}>{ach.title}</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed font-medium">{ach.description}</p>
            {ach.unlocked ? (
              <div className="flex items-center justify-between mt-auto">
                <span className="text-[9px] font-black text-brand-blue uppercase tracking-widest bg-brand-blue/5 px-2 py-0.5 rounded border border-brand-blue/10">Unlocked</span>
                <span className="text-[10px] font-black text-slate-400 uppercase font-mono">{ach.date}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-auto">
                <Lock className="size-3 text-slate-400" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Encrypted</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const MissionSimulation = ({ mission, onComplete, onCancel }: { mission: Mission, onComplete: (xp: number) => void, onCancel: () => void }) => {
  const [step, setStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const steps = [
    { title: "Neural Link Initialized", log: "> SYNCING WITH SECTOR MAINFRAME... OK" },
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
        onComplete(mission.xp_reward);
      }, 1000);
    }
  }, [step]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-2xl" />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-2xl bg-black rounded-[40px] border border-brand-blue/30 overflow-hidden shadow-[0_0_50px_rgba(0,60,113,0.2)]"
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

// --- Settings Modal (Profile + Password) ---

const SettingsModal = ({
  student,
  setStudent,
  onClose,
}: {
  student: Student;
  setStudent: (s: Student | null) => void;
  onClose: () => void;
}) => {
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
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
      const res = await fetch('/api/me/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
    } catch {
      setPasswordMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg glass-panel border-glow rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-cyan-500/20">
          <h2 className="font-display text-xl font-black text-slate-100 uppercase text-glow-cyan">Settings</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-700/50 transition-colors">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex border-b border-cyan-500/20">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'profile' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'password' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Password
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {profileMessage && (
                <p className={`text-sm font-bold ${profileMessage.type === 'success' ? 'text-cyan-400' : 'text-red-400'}`}>
                  {profileMessage.text}
                </p>
              )}
              <div>
                <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest block mb-1">Display name</label>
                <input
                  value={profileForm.name}
                  onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-slate-100 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest block mb-1">Avatar URL</label>
                <input
                  value={profileForm.avatar_url}
                  onChange={e => setProfileForm({ ...profileForm, avatar_url: e.target.value })}
                  className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-slate-100 text-sm"
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest block mb-1">Age</label>
                  <input
                    type="number"
                    value={profileForm.age}
                    onChange={e => setProfileForm({ ...profileForm, age: e.target.value })}
                    className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-slate-100 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest block mb-1">Grade</label>
                  <input
                    value={profileForm.grade}
                    onChange={e => setProfileForm({ ...profileForm, grade: e.target.value })}
                    className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-slate-100 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest block mb-1">School</label>
                <input
                  value={profileForm.school}
                  onChange={e => setProfileForm({ ...profileForm, school: e.target.value })}
                  className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest block mb-1">City</label>
                <input
                  value={profileForm.city}
                  onChange={e => setProfileForm({ ...profileForm, city: e.target.value })}
                  className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest block mb-1">Email</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest block mb-1">Parent / Guardian email</label>
                <input
                  type="email"
                  value={profileForm.parent_email}
                  onChange={e => setProfileForm({ ...profileForm, parent_email: e.target.value })}
                  className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest block mb-1">Contact number</label>
                <input
                  value={profileForm.contact_number}
                  onChange={e => setProfileForm({ ...profileForm, contact_number: e.target.value })}
                  className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-slate-100 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={savingProfile}
                className="w-full py-3 rounded-xl bg-cyan-500/20 border border-cyan-400 text-cyan-400 font-black uppercase tracking-wider hover:bg-cyan-500/30 disabled:opacity-50 transition-all"
              >
                {savingProfile ? 'Saving…' : 'Save profile'}
              </button>
            </form>
          )}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordMessage && (
                <p className={`text-sm font-bold ${passwordMessage.type === 'success' ? 'text-cyan-400' : 'text-red-400'}`}>
                  {passwordMessage.text}
                </p>
              )}
              <div>
                <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest block mb-1">Current password</label>
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-slate-100 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest block mb-1">New password</label>
                <input
                  type="password"
                  value={passwordForm.new}
                  onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })}
                  className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-slate-100 text-sm"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-cyan-400 tracking-widest block mb-1">Confirm new password</label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-slate-100 text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={savingPassword}
                className="w-full py-3 rounded-xl bg-cyan-500/20 border border-cyan-400 text-cyan-400 font-black uppercase tracking-wider hover:bg-cyan-500/30 disabled:opacity-50 transition-all"
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

  const handleLogin = (user: any) => {
    setStudent(user);
    setIsLoggedIn(true);
    // Set initial view based on role
    if (user.role === 'teacher') setActiveView('teacher');
    else if (user.role === 'admin') setActiveView('admin');
    else setActiveView('galaxy');
  };

  const handleSelectSector = (sector: Sector) => {
    setSelectedSector(sector);
    setActiveView('sector-detail');
  };

  const handleMissionComplete = async (xp: number) => {
    if (!student) return;
    
    const newXp = student.xp + xp;
    const newLevel = Math.floor(newXp / 1000) + 1;
    
    setStudent({ ...student, xp: newXp, level: newLevel });
    setActiveMission(null);
    
    // Log completion
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Game "${activeMission?.title}" completed successfully by ${student.name}.`,
        type: 'mission',
        xp_change: xp
      })
    });
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30 relative overflow-x-hidden">
      <FuturisticBackground withParticles={true} />

      {/* Global HUD Borders */}
      <div className="fixed top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-cyan-500/40 pointer-events-none m-8 z-50" />
      <div className="fixed top-0 right-0 w-32 h-32 border-t-2 border-r-2 border-cyan-500/40 pointer-events-none m-8 z-50" />
      <div className="fixed bottom-0 left-0 w-32 h-32 border-b-2 border-l-2 border-cyan-500/40 pointer-events-none m-8 z-50" />
      <div className="fixed bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-cyan-500/40 pointer-events-none m-8 z-50" />

      <Navbar activeView={activeView} setActiveView={setActiveView} student={student} onOpenSettings={() => setSettingsOpen(true)} />

      {settingsOpen && student && (
        <SettingsModal
          student={student}
          setStudent={setStudent}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <main className="relative z-10 pt-32 pb-32 px-6 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {activeView === 'dashboard' && student && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-10"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-4xl font-black tracking-tighter text-slate-100 mb-2 uppercase text-glow-cyan">
                    Command Console
                  </h2>
                  <p className="text-cyan-400/80 tracking-[0.2em] uppercase text-[10px] font-black">
                    Your assigned missions and assessments
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Assigned missions/quizzes */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="glass-panel p-8 rounded-2xl card-hover-glow border-glow">
                    <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter mb-6 flex items-center gap-3">
                      <ClipboardList className="text-cyan-400" />
                      Pending Neural Assignments
                    </h3>
                    <QuizTool
                      student={student}
                      completedQuizIds={[]}
                    />
                  </div>
                </div>

                {/* Right: Status summary */}
                <div className="space-y-6">
                  <div className="glass-panel p-6 rounded-2xl card-hover-glow border-glow">
                    <h4 className="text-sm font-black text-slate-100 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <Activity className="size-4 text-cyan-400" />
                      Mission Status
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Level</span>
                        <span className="font-mono font-black text-cyan-400">LVL {student.level}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Total XP</span>
                        <span className="font-mono font-black text-slate-100">{student.xp.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Next Rank Threshold</span>
                        <span className="font-mono font-black text-slate-100">
                          {((Math.floor(student.xp / 1000) + 1) * 1000).toLocaleString()} XP
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          {activeView === 'galaxy' && (
            <motion.div 
              key="galaxy"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-12 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-4xl font-black tracking-tighter text-slate-100 mb-2 uppercase text-glow-cyan">Galaxy Map</h2>
                  <p className="text-cyan-400/80 tracking-[0.2em] uppercase text-[10px] font-black">Select a sector to continue your mission</p>
                </div>
                <div className="flex gap-2">
                  <div className="h-1 w-12 bg-cyan-500 rounded-full"></div>
                  <div className="h-1 w-3 bg-slate-600 rounded-full"></div>
                  <div className="h-1 w-3 bg-slate-600 rounded-full"></div>
                </div>
              </div>
              <GalaxyMap sectors={sectors} onSelectSector={handleSelectSector} />
            </motion.div>
          )}

          {activeView === 'sector-detail' && selectedSector && (
            <SectorView 
              key="sector-detail"
              sector={selectedSector} 
              onBack={() => setActiveView('galaxy')} 
              onPlayMission={(m) => setActiveMission(m)}
            />
          )}

          {activeView === 'admin' && student?.role === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-12">
                <h2 className="text-4xl font-black tracking-tighter text-slate-900 mb-2 uppercase italic">Admin Command Center</h2>
                <p className="text-slate-400 tracking-[0.2em] uppercase text-[10px] font-black">System-wide performance and telemetry</p>
              </div>
              <AdminDashboard />
            </motion.div>
          )}

          {activeView === 'teacher' && (student?.role === 'teacher' || student?.role === 'admin') && (
            <motion.div 
              key="teacher"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-12">
                <h2 className="text-4xl font-black tracking-tighter text-slate-900 mb-2 uppercase italic">Teacher Analytics Hub</h2>
                <p className="text-slate-400 tracking-[0.2em] uppercase text-[10px] font-black">Class progress and student mastery insights</p>
              </div>
              <TeacherHub sectors={sectors} students={students} student={student!} />
            </motion.div>
          )}

          {activeView === 'profile' && student && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-12">
                <h2 className="font-display text-4xl font-black tracking-tighter text-slate-100 mb-2 uppercase text-glow-cyan">Operator Profile</h2>
                <p className="text-cyan-400/80 tracking-[0.2em] uppercase text-[10px] font-black">Your details, progress, and achievement logs</p>
              </div>
              <StudentDashboard student={student} onOpenSettings={() => setSettingsOpen(true)} />
            </motion.div>
          )}

          {activeView === 'create-mission' && (student?.role === 'teacher' || student?.role === 'admin') && (
            <motion.div 
              key="create-mission"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-12">
                <h2 className="text-4xl font-black tracking-tighter text-slate-900 mb-2 uppercase italic">Game Deployment</h2>
                <p className="text-slate-400 tracking-[0.2em] uppercase text-[10px] font-black">Deploy new learning objectives to the galaxy</p>
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
                <h2 className="text-4xl font-black tracking-tighter text-slate-900 mb-2 uppercase italic">Squad Leaderboard</h2>
                <p className="text-slate-400 tracking-[0.2em] uppercase text-[10px] font-black">See how you rank against the global STEM elite</p>
              </div>
              <SquadLeaderboard student={student} />
            </motion.div>
          )}

          {activeView === 'awards' && (
            <motion.div 
              key="awards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-12">
                <h2 className="text-4xl font-black tracking-tighter text-slate-900 mb-2 uppercase italic">Achievement Hall</h2>
                <p className="text-slate-400 tracking-[0.2em] uppercase text-[10px] font-black">Your journey of scientific discovery and mastery</p>
              </div>
              <AwardsView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {activeMission && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => setActiveMission(null)} />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-1 shadow-2xl overflow-hidden"
          >
            {activeMission.embed_code ? (
              <GamePlayer 
                mission={activeMission} 
                onComplete={() => handleMissionComplete(activeMission.xp_reward)} 
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

      {/* Bottom Navigation */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 glass-panel border-glow rounded-2xl px-8 py-4 flex gap-10 box-glow-cyan">
        <button 
          onClick={() => setActiveView('dashboard')}
          className={`flex flex-col items-center gap-1 group transition-all ${activeView === 'dashboard' ? 'text-cyan-400' : 'text-slate-400 opacity-70 hover:opacity-100 hover:text-cyan-400/80'}`}
        >
          <LayoutDashboard className={`size-6 group-hover:scale-110 transition-transform ${activeView === 'dashboard' ? 'text-cyan-400' : 'text-slate-400'}`} />
          <span className="text-[9px] font-black uppercase tracking-widest">Command</span>
        </button>
        <button 
          onClick={() => setActiveView('galaxy')}
          className={`flex flex-col items-center gap-1 group transition-all ${activeView === 'galaxy' ? 'text-cyan-400' : 'text-slate-400 opacity-70 hover:opacity-100 hover:text-cyan-400/80'}`}
        >
          <MapIcon className={`size-6 group-hover:scale-110 transition-transform ${activeView === 'galaxy' ? 'text-cyan-400' : 'text-slate-400'}`} />
          <span className="text-[9px] font-black uppercase tracking-widest">Galaxy</span>
        </button>
        
        {student?.role === 'admin' && (
          <button 
            onClick={() => setActiveView('admin')}
            className={`flex flex-col items-center gap-1 group transition-all ${activeView === 'admin' ? 'text-amber-400' : 'text-slate-400 opacity-70 hover:opacity-100 hover:text-amber-400/80'}`}
          >
            <Shield className={`size-6 group-hover:scale-110 transition-transform ${activeView === 'admin' ? 'text-amber-400' : 'text-slate-400'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest">Admin</span>
          </button>
        )}

        {(student?.role === 'teacher' || student?.role === 'admin') && (
          <>
            <button 
              onClick={() => setActiveView('teacher')}
              className={`flex flex-col items-center gap-1 group transition-all ${activeView === 'teacher' ? 'text-cyan-400' : 'text-slate-400 opacity-70 hover:opacity-100 hover:text-cyan-400/80'}`}
            >
              <School className={`size-6 group-hover:scale-110 transition-transform ${activeView === 'teacher' ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span className="text-[9px] font-black uppercase tracking-widest">Teacher</span>
            </button>
          </>
        )}

        <button 
          onClick={() => setActiveView('squad')}
          className={`flex flex-col items-center gap-1 group transition-all ${activeView === 'squad' ? 'text-cyan-400' : 'text-slate-400 opacity-70 hover:opacity-100 hover:text-cyan-400/80'}`}
        >
          <Users className={`size-6 group-hover:scale-110 transition-transform ${activeView === 'squad' ? 'text-cyan-400' : 'text-slate-400'}`} />
          <span className="text-[9px] font-black uppercase tracking-widest">Squad</span>
        </button>
        {student?.role === 'student' && (
          <button 
            onClick={() => setActiveView('awards')}
            className={`flex flex-col items-center gap-1 group transition-all ${activeView === 'awards' ? 'text-cyan-400' : 'text-slate-400 opacity-70 hover:opacity-100 hover:text-cyan-400/80'}`}
          >
            <Award className={`size-6 group-hover:scale-110 transition-transform ${activeView === 'awards' ? 'text-cyan-400' : 'text-slate-400'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest">Awards</span>
          </button>
        )}
        
        <button 
          onClick={async () => { 
            await fetch('/api/logout', { method: 'POST' });
            setIsLoggedIn(false); 
            setStudent(null); 
          }}
          className="flex flex-col items-center gap-1 group transition-all text-red-500/50 hover:text-red-500 hover:opacity-100"
        >
          <Lock className="size-6 group-hover:scale-110 transition-transform" />
          <span className="text-[9px] font-black uppercase tracking-widest">Logout</span>
        </button>
      </div>
    </div>
  );
}
