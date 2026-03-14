/**
 * H5P-style Quiz Builder: assemble quizzes from modular question types.
 * Teachers add questions, pick type, configure with visual editors, reorder, save.
 */

import React, { useState, useEffect } from 'react';
import type { ChallengeType, ChallengeContent } from './types';
import { getAllChallengeTypes, getChallengeType, getDefaultContent, evaluateResponse } from './registry';

export interface QuizQuestion {
  type: ChallengeType;
  content: ChallengeContent;
}

export interface QuizDraft {
  id?: number;
  title: string;
  questions: QuizQuestion[];
}

const safeFetch = async (url: string, options?: RequestInit) => {
  try {
    const res = await fetch(url, { ...options, credentials: options?.credentials ?? 'include' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

export function QuizBuilder() {
  const [quizzes, setQuizzes] = useState<{ id: number; title: string; questions: string }[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const types = getAllChallengeTypes();
  const plugin = editingIndex !== null ? getChallengeType(questions[editingIndex]?.type) : null;
  const Editor = plugin?.Editor;

  const loadQuizzes = () => {
    safeFetch('/api/quizzes').then((data) => setQuizzes(Array.isArray(data) ? data : []));
  };

  useEffect(() => {
    loadQuizzes();
  }, []);

  useEffect(() => {
    if (selectedId) {
      const q = quizzes.find((x) => x.id === selectedId);
      if (q) {
        setTitle(q.title);
        try {
          setQuestions(JSON.parse(q.questions || '[]'));
        } catch {
          setQuestions([]);
        }
      }
    } else {
      setTitle('');
      setQuestions([]);
    }
    setEditingIndex(null);
  }, [selectedId]);

  const addQuestion = (type: ChallengeType) => {
    const content = getDefaultContent(type) || {};
    setQuestions((prev) => [...prev, { type, content }]);
    setEditingIndex(questions.length);
  };

  const updateQuestionContent = (index: number, content: ChallengeContent) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], content };
      return next;
    });
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
    else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1);
  };

  const duplicateQuestion = (index: number) => {
    const q = questions[index];
    setQuestions((prev) => [...prev.slice(0, index + 1), { type: q.type, content: JSON.parse(JSON.stringify(q.content)) }, ...prev.slice(index + 1)]);
    setEditingIndex(index + 1);
  };

  const moveQuestion = (index: number, dir: number) => {
    const to = index + dir;
    if (to < 0 || to >= questions.length) return;
    setQuestions((prev) => {
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
    if (editingIndex === index) setEditingIndex(to);
    else if (editingIndex === to) setEditingIndex(index);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const body = { title: title.trim(), questions };
      const url = selectedId ? `/api/quizzes/${selectedId}` : '/api/quizzes';
      const method = selectedId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed to save');
        return;
      }
      loadQuizzes();
      if (data.id) setSelectedId(data.id);
    } finally {
      setSaving(false);
    }
  };

  const handleClone = (quiz: { id: number; title: string; questions: string }) => {
    setSelectedId(null);
    setTitle(`${quiz.title} (copy)`);
    try {
      setQuestions(JSON.parse(quiz.questions || '[]'));
    } catch {
      setQuestions([]);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this quiz?')) return;
    const res = await fetch(`/api/quizzes/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      loadQuizzes();
      if (selectedId === id) setSelectedId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-100 uppercase">Quizzes</h3>
          <button type="button" onClick={() => setSelectedId(null)} className="text-xs font-black text-cyan-400 uppercase">
            + New
          </button>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {quizzes.map((q) => (
            <div
              key={q.id}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedId === q.id ? 'border-cyan-500/60 bg-cyan-500/10' : 'border-slate-600/50 bg-slate-800/40 hover:border-slate-500'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div onClick={() => setSelectedId(q.id)} className="min-w-0 flex-1">
                  <p className="font-black text-slate-100 text-sm truncate">{q.title}</p>
                  <p className="text-[10px] text-slate-400">
                    {(() => {
                      try {
                        return JSON.parse(q.questions || '[]').length;
                      } catch {
                        return 0;
                      }
                    })()}{' '}
                    questions
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleClone(q); }} className="text-[10px] text-slate-400 hover:text-cyan-400 uppercase font-black">
                    Copy
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }} className="text-[10px] text-rose-400 hover:text-rose-300 uppercase font-black">
                    Del
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        <div className="bg-slate-800/60 border border-slate-600/40 rounded-2xl p-6 shadow-xl">
          <h3 className="text-xl font-black text-slate-100 uppercase tracking-tight mb-4">{selectedId ? 'Edit Quiz' : 'New Quiz'}</h3>
          <div className="mb-6">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Quiz title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Robotics Basics"
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 text-slate-100"
            />
          </div>

          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Questions</label>
          <div className="space-y-3 mb-6">
            {questions.map((q, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-4 rounded-xl border ${editingIndex === i ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-slate-600/50 bg-slate-800/40'}`}
              >
                <div className="flex flex-col gap-0.5">
                  <button type="button" onClick={() => moveQuestion(i, -1)} disabled={i === 0} className="text-slate-500 hover:text-cyan-400 disabled:opacity-30 p-0.5">
                    ↑
                  </button>
                  <button type="button" onClick={() => moveQuestion(i, 1)} disabled={i === questions.length - 1} className="text-slate-500 hover:text-cyan-400 disabled:opacity-30 p-0.5">
                    ↓
                  </button>
                </div>
                <span className="text-slate-500 font-mono w-6">{i + 1}</span>
                <span className="flex-1 text-slate-200 text-sm font-medium truncate">{q.type.replace(/_/g, ' ')}</span>
                <button type="button" onClick={() => setEditingIndex(i)} className="text-xs text-cyan-400 font-black uppercase">
                  Edit
                </button>
                <button type="button" onClick={() => duplicateQuestion(i)} className="text-xs text-slate-400 font-black uppercase">
                  Dup
                </button>
                <button type="button" onClick={() => removeQuestion(i)} className="text-xs text-rose-400 font-black uppercase">
                  Del
                </button>
              </div>
            ))}
          </div>

          <div className="mb-6">
            <p className="text-xs text-slate-500 mb-2">Add question</p>
            <div className="flex flex-wrap gap-2">
              {types.map((t) => (
                <button
                  key={t.meta.id}
                  type="button"
                  onClick={() => addQuestion(t.meta.id as ChallengeType)}
                  className="px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 text-xs font-black uppercase hover:border-cyan-500/40 hover:text-cyan-400"
                >
                  {t.meta.label}
                </button>
              ))}
            </div>
          </div>

          {editingIndex !== null && Editor && questions[editingIndex] && (
            <div className="pt-6 border-t border-slate-600/40">
              <h4 className="text-sm font-black text-slate-400 uppercase mb-3">Edit question {editingIndex + 1}</h4>
              <Editor
                content={questions[editingIndex].content}
                onChange={(c) => updateQuestionContent(editingIndex, c)}
              />
            </div>
          )}

          {error && <p className="text-rose-400 text-sm mb-4">{error}</p>}
          <button type="button" onClick={handleSave} disabled={saving} className="px-6 py-3 rounded-xl bg-cyan-500 text-white font-black text-sm uppercase disabled:opacity-50">
            {saving ? 'Saving…' : 'Save quiz'}
          </button>
        </div>
      </div>
    </div>
  );
}
