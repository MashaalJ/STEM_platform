/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users, Shield, ChevronRight, Copy, CheckCircle2,
} from 'lucide-react';
import { safeFetch, fetchWithAuth } from '../../app/api';
import HoverCard from '../motion/HoverCard';
import TeacherCurriculumEditor from './CurriculumEditor';
import ClassLearningPathGuide from './ClassLearningPathGuide';
import type { Class, Student } from '../../app/types';

export default function ClassroomManager({
  teacherId,
  students,
  onStudentsAdded,
  onNavigateToActivityBank,
  onNavigateToCurriculum,
}: {
  teacherId: string;
  students: Student[];
  onStudentsAdded?: () => void;
  onNavigateToActivityBank?: () => void;
  onNavigateToCurriculum?: () => void;
}) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ studentId: string; message: string } | null>(null);
  const [copyCodeFeedback, setCopyCodeFeedback] = useState(false);
  const [pasteNames, setPasteNames] = useState('');
  const [importingRoster, setImportingRoster] = useState(false);
  const [pasteResult, setPasteResult] = useState<{ added: number; created: string[]; error?: string } | null>(null);
  const [pasteLoading, setPasteLoading] = useState(false);
  const [generateCodeLoading, setGenerateCodeLoading] = useState(false);
  const [generateCodeError, setGenerateCodeError] = useState<string | null>(null);
  const [classesLoadError, setClassesLoadError] = useState<string | null>(null);
  const [curriculumDraft, setCurriculumDraft] = useState('');
  const [savingCurriculum, setSavingCurriculum] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [classViewTab, setClassViewTab] = useState<'overview' | 'curriculum'>('overview');

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
    setLoading(false);
    return list;
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
      const newId = String(data.id ?? '');
      const newClass = list.find((c) => String(c.id) === newId) || {
        id: newId,
        name,
        teacher_id: teacherId,
        description: '',
        join_code: data.join_code ?? undefined,
        student_count: 0,
      };
      setSelectedClass(newClass);
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
      const res = await fetchWithAuth(`/api/classes/${selectedClass.id}/add-students-by-names`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
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
      const res = await fetchWithAuth(`/api/classes/${selectedClass.id}/add-students-by-names`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: cleanNames }),
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

  const addStudentToClass = async (studentId: string) => {
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





  const saveCurriculumTrack = async () => {
    if (!selectedClass || !curriculumDraft.trim()) return;
    setSavingCurriculum(true);
    setAssignmentError(null);
    try {
      const res = await fetchWithAuth(`/api/classes/${selectedClass.id}/curriculum-track`, {
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

      <HoverCard className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm teacher-tactical">
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
      </HoverCard>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,340px)_1fr] gap-8 w-full">
        <HoverCard className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm h-fit lg:sticky lg:top-4">
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
              {classes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedClass(c)}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all relative overflow-hidden group ${
                    selectedClass?.id === c.id
                      ? 'bg-slate-900 text-amber-500 border-slate-900 shadow-md'
                      : 'bg-white border-slate-200 hover:border-amber-400'
                  }`}
                >
                  <div className="text-left relative z-10">
                    <p className={`font-bold text-sm ${selectedClass?.id === c.id ? 'text-amber-500' : 'text-slate-900'}`}>{c.name}</p>
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
        </HoverCard>

        <div className="min-w-0 space-y-8">
        {!selectedClass && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-slate-500 text-sm">
            Select a class from the list, or create one above.
          </div>
        )}

        {selectedClass && (() => {
          const currentClass = classes.find(c => c.id === selectedClass.id) || selectedClass;
          return (
          <HoverCard
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-8"
          >
            <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4">
              {(['overview', 'curriculum'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setClassViewTab(tab)}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest ${
                    classViewTab === tab
                      ? 'bg-indigo-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab === 'overview' ? 'Overview' : 'Curriculum'}
                </button>
              ))}
            </div>

            {classViewTab === 'curriculum' ? (
              <TeacherCurriculumEditor
                classId={String(currentClass.id)}
                className={currentClass.name}
              />
            ) : (
            <>
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

            <ClassLearningPathGuide
              className={currentClass.name}
              hasCurriculumTrack={Boolean(currentClass.curriculum_track)}
              onGoToActivityBank={onNavigateToActivityBank}
              onGoToCurriculum={onNavigateToCurriculum}
            />
            {assignmentError && <p className="text-rose-500 text-xs font-semibold">{assignmentError}</p>}
            </>
            )}
          </HoverCard>
          ); })()}
        </div>
      </div>

    </div>
  );
};