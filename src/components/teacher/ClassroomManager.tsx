/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users, Shield, ChevronRight, Copy, CheckCircle2, Download,
} from 'lucide-react';
import { safeFetch, fetchWithAuth } from '../../app/api';
import {
  normalizeCurriculumTrack,
  CURRICULUM_TRACK_LABELS,
  type RosterCredentialRow,
} from '../../../lib/rosterCredentials';
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
  syncClassId,
  onClassSelectionChange,
  onClassesUpdated,
}: {
  teacherId: string;
  students: Student[];
  onStudentsAdded?: () => void;
  onNavigateToActivityBank?: () => void;
  onNavigateToCurriculum?: () => void;
  /** Keeps sidebar selection in sync with TeacherHub “Viewing class” picker */
  syncClassId?: string | null;
  onClassSelectionChange?: (classId: string | null) => void;
  onClassesUpdated?: (classId?: string) => void;
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
  const [pasteResult, setPasteResult] = useState<{
    added: number;
    created: string[];
    error?: string;
    credentials?: RosterCredentialRow[];
  } | null>(null);
  const [rosterCredentials, setRosterCredentials] = useState<RosterCredentialRow[]>([]);
  const [pasteLoading, setPasteLoading] = useState(false);
  const [generateCodeLoading, setGenerateCodeLoading] = useState(false);
  const [generateCodeError, setGenerateCodeError] = useState<string | null>(null);
  const [classesLoadError, setClassesLoadError] = useState<string | null>(null);
  const [classViewTab, setClassViewTab] = useState<'overview' | 'curriculum'>('overview');
  const [classMemberIds, setClassMemberIds] = useState<Set<string>>(new Set());
  const [classMembers, setClassMembers] = useState<Student[]>([]);
  const [availableToAdd, setAvailableToAdd] = useState<Student[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const exportRosterCsv = (rows: RosterCredentialRow[], className: string) => {
    const header = 'display_name,username,password,new_account,login_note\n';
    const body = rows
      .map((r) => {
        const loginNote = r.is_new
          ? 'Sign in with username + password below'
          : 'Existing account — student keeps their password';
        const pw = r.password ? r.password : '';
        return `"${String(r.name).replace(/"/g, '""')}","${r.username}","${pw}",${r.is_new ? 'yes' : 'no'},"${loginNote}"`;
      })
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${className.replace(/[^a-z0-9]+/gi, '_') || 'class'}_student_logins.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const mergeCredentials = (incoming: RosterCredentialRow[] | undefined) => {
    if (!incoming?.length) return;
    setRosterCredentials((prev) => {
      const byId = new Map(prev.map((r) => [r.student_id, r]));
      for (const row of incoming) byId.set(row.student_id, row);
      return [...byId.values()];
    });
  };

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

  const refreshClassMembers = async (classId: string) => {
    setLoadingMembers(true);
    try {
      const [membersRes, availableRes] = await Promise.all([
        fetchWithAuth(`/api/classes/${classId}/students`),
        fetchWithAuth(`/api/classes/${classId}/available-students`),
      ]);
      if (!membersRes.ok) {
        setClassMembers([]);
        setClassMemberIds(new Set());
      } else {
        const data = await membersRes.json().catch(() => []);
        const list = Array.isArray(data) ? (data as Student[]) : [];
        setClassMembers(list);
        setClassMemberIds(new Set(list.map((s) => String(s.id))));
      }
      if (availableRes.ok) {
        const avail = await availableRes.json().catch(() => []);
        setAvailableToAdd(Array.isArray(avail) ? (avail as Student[]) : []);
      } else {
        setAvailableToAdd([]);
      }
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (!selectedClass?.id) {
      setClassMembers([]);
      setClassMemberIds(new Set());
      return;
    }
    void refreshClassMembers(String(selectedClass.id));
  }, [selectedClass?.id]);

  useEffect(() => {
    if (!syncClassId || !classes.length) return;
    const match = classes.find((c) => String(c.id) === String(syncClassId));
    if (match && String(selectedClass?.id) !== String(match.id)) {
      setSelectedClass(match);
    }
  }, [syncClassId, classes, selectedClass?.id]);

  const selectClass = (c: Class) => {
    setSelectedClass(c);
    onClassSelectionChange?.(String(c.id));
  };

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
    setRosterCredentials([]);
    setPasteResult(null);
  }, [selectedClass?.id]);

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
      onClassSelectionChange?.(String(newClass.id));
      onClassesUpdated?.(String(newClass.id));
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
        setPasteResult({
          added: data.added ?? 0,
          created: data.created ?? [],
          credentials: data.credentials ?? [],
        });
        mergeCredentials(data.credentials);
        setPasteNames('');
        await fetchClasses();
        if (selectedClass?.id) await refreshClassMembers(String(selectedClass.id));
        onStudentsAdded?.();
        onClassesUpdated?.(selectedClass ? String(selectedClass.id) : undefined);
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
      setPasteResult({
        added: data.added ?? 0,
        created: data.created ?? [],
        credentials: data.credentials ?? [],
      });
      mergeCredentials(data.credentials);
      await fetchClasses();
      if (selectedClass?.id) await refreshClassMembers(String(selectedClass.id));
      onStudentsAdded?.();
      onClassesUpdated?.(selectedClass ? String(selectedClass.id) : undefined);
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
      if (selectedClass?.id) await refreshClassMembers(String(selectedClass.id));
      onClassesUpdated?.(String(selectedClass.id));
    } catch {
      setSyncFeedback({ studentId, message: 'Network error' });
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
                  onClick={() => selectClass(c)}
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
                onTrackSaved={(track) => {
                  setClasses((prev) =>
                    prev.map((c) => (c.id === currentClass.id ? { ...c, curriculum_track: track } : c)),
                  );
                  setSelectedClass((prev) =>
                    prev && prev.id === currentClass.id ? { ...prev, curriculum_track: track } : prev,
                  );
                  onClassesUpdated?.(String(currentClass.id));
                }}
              />
            ) : (
            <>
            {(() => {
              const trackKey = normalizeCurriculumTrack(currentClass.curriculum_track);
              const trackLabel = CURRICULUM_TRACK_LABELS[trackKey];
              return (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
              <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-2">Curriculum track</p>
              <p className="text-sm text-indigo-950 mb-3">
                Use the <strong>Curriculum</strong> tab to choose <strong>Core STEM</strong>, <strong>Advanced</strong>, or{' '}
                <strong>Custom</strong> and edit missions. That is separate from subject labels like Robotics.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-indigo-800 bg-white border border-indigo-200 rounded-lg px-3 py-1.5">
                  Active: {currentClass.curriculum_track ? trackLabel : 'Not set — open Curriculum tab'}
                </span>
                <button
                  type="button"
                  onClick={() => setClassViewTab('curriculum')}
                  className="px-4 py-2 rounded-xl bg-indigo-700 text-white font-black text-xs uppercase tracking-widest"
                >
                  Open Curriculum tab
                </button>
              </div>
            </div>
              );
            })()}

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
              <p className="text-slate-500 text-xs mb-3">
                Paste one name per line. New accounts get a generated username and password—shown in the login table below (download CSV to share).
              </p>
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
                          <span className="text-slate-600 ml-2"> · Created {pasteResult.created.length} new account(s) — see login table below</span>
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

            {rosterCredentials.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest">
                    Student login credentials
                  </p>
                  <button
                    type="button"
                    onClick={() => exportRosterCsv(rosterCredentials, currentClass.name)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-amber-400 text-[10px] font-black uppercase tracking-widest"
                  >
                    <Download className="size-3.5" />
                    Download CSV
                  </button>
                </div>
                <p className="text-xs text-amber-950 mb-3">
                  Students sign in at the login page with <strong>username</strong> and <strong>password</strong> (not email).
                  Save this file now—passwords cannot be retrieved later.
                </p>
                <div className="overflow-x-auto rounded-lg border border-amber-200 bg-white">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest text-slate-500 border-b">
                        <th className="p-2">Name</th>
                        <th className="p-2">Username</th>
                        <th className="p-2">Password</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rosterCredentials.map((r) => (
                        <tr key={r.student_id} className="border-b border-slate-100 last:border-0">
                          <td className="p-2 font-semibold text-slate-900">{r.name}</td>
                          <td className="p-2 font-mono text-xs">{r.username}</td>
                          <td className="p-2 font-mono text-xs">{r.password || '—'}</td>
                          <td className="p-2 text-xs">{r.is_new ? 'New account' : 'Existing'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-5">
              <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-2">
                In this class ({classMembers.length})
              </p>
              {loadingMembers ? (
                <p className="text-sm text-slate-600">Loading roster…</p>
              ) : classMembers.length === 0 ? (
                <p className="text-sm text-slate-600">No students yet — paste names above or add from your school list below.</p>
              ) : (
                <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {classMembers.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 text-sm text-slate-800">
                      <img src={s.avatar_url} alt="" className="size-8 rounded-lg object-cover border border-slate-200" referrerPolicy="no-referrer" />
                      <span className="font-semibold">{s.name}</span>
                      {s.username && (
                        <span className="text-[10px] font-mono text-slate-500">@{s.username}</span>
                      )}
                      <span className="text-[10px] uppercase text-slate-500 font-bold">Lvl {s.level}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

                <h3 className="text-xl font-semibold text-slate-900 mb-1">
              Move students from your other classes
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Only students already in another class you teach are listed here—not every student in the school.
              To add someone new, use the name list above.
            </p>
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-4 custom-scrollbar">
              {availableToAdd.map((s) => {
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
              {!loadingMembers && availableToAdd.length === 0 && (
                  <p className="text-sm text-slate-500 py-4 text-center">
                    No students from your other classes to add. Paste names above to create new accounts for this class.
                  </p>
                )}
            </div>

            <ClassLearningPathGuide
              className={currentClass.name}
              hasCurriculumTrack={Boolean(String(currentClass.curriculum_track || '').trim())}
              onGoToActivityBank={onNavigateToActivityBank}
              onGoToCurriculum={() => {
                setClassViewTab('curriculum');
                onNavigateToCurriculum?.();
              }}
            />
            </>
            )}
          </HoverCard>
          ); })()}
        </div>
      </div>

    </div>
  );
};