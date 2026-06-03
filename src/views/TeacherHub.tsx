/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users, BarChart3, ClipboardList, Layers, LayoutGrid,
} from 'lucide-react';
import { safeFetch, fetchWithAuth } from '../app/api';
import type { Sector, Class, Student } from '../app/types';
import ClassroomManager from '../components/teacher/ClassroomManager';
import TeacherCurriculumEditor from '../components/teacher/CurriculumEditor';
import ReportCards from '../components/teacher/ReportCards';
import JourneyBuilder from '../components/teacher/JourneyBuilder';
import ActivityBank from '../components/teacher/ActivityBank';

const TeacherHub = ({ sectors, students, student, refetchStudents, setStudent, initialClassId }: { sectors: Sector[], students: Student[], student: Student, refetchStudents?: () => void, setStudent?: (s: Student) => void, initialClassId?: string }) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'classroom' | 'activitybank' | 'reports' | 'curriculum'>('analytics');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [schoolOptions, setSchoolOptions] = useState<string[]>([]);
  const [profileSchool, setProfileSchool] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileDismissed, setProfileDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('stemverse_teacher_profile_prompt_dismissed') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    safeFetch('/api/schools').then((data) => {
      setSchoolOptions(Array.isArray(data) ? data.map((s) => String(s)).filter(Boolean) : []);
    });
  }, []);

  useEffect(() => {
    setProfileSchool(student.school || '');
  }, [student.school]);

  const showTeacherProfilePrompt =
    (student.role === 'teacher' || student.role === 'admin') && !student.school?.trim() && !profileDismissed;

  const saveTeacherProfile = async () => {
    const school = profileSchool.trim();
    if (!school) {
      setProfileError('Select or enter your school name.');
      return;
    }
    setSavingProfile(true);
    setProfileError(null);
    try {
      const res = await fetchWithAuth('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.user) {
        setProfileError(data?.message || 'Could not save profile.');
        return;
      }
      setStudent?.(data.user as Student);
      setProfileDismissed(true);
      try {
        sessionStorage.setItem('stemverse_teacher_profile_prompt_dismissed', '1');
      } catch {
        /* ignore */
      }
    } finally {
      setSavingProfile(false);
    }
  };

  useEffect(() => {
    safeFetch('/api/classes').then(data => {
      if (data) {
        const teacherClasses = data.filter((c: Class) => c.teacher_id === student.id);
        setClasses(teacherClasses);
        if (initialClassId) {
          const match = teacherClasses.find((c: Class) => String(c.id) === initialClassId);
          if (match) setSelectedClassId(match.id);
        } else if (teacherClasses.length > 0 && !selectedClassId) {
          setSelectedClassId(teacherClasses[0].id);
        }
      }
    });
  }, [student.id, initialClassId]);

  const selectedClass = classes.find(c => c.id === selectedClassId) || null;

  return (
    <div className="space-y-8">
      {showTeacherProfilePrompt && (
        <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-slate-900/80 p-6 shadow-lg teacher-tactical">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-400 mb-1">Complete your profile</p>
              <h3 className="text-xl font-black text-white">Add your school to get started</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-xl">
                Tell us where you teach, then head to the Classes tab to create your first classroom.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setProfileDismissed(true);
                try {
                  sessionStorage.setItem('stemverse_teacher_profile_prompt_dismissed', '1');
                } catch {
                  /* ignore */
                }
              }}
              className="text-slate-500 hover:text-slate-300 text-xs font-bold uppercase tracking-wider"
            >
              Set up later
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
            <input
              type="text"
              list="teacher-school-options"
              value={profileSchool}
              onChange={(e) => {
                setProfileSchool(e.target.value);
                setProfileError(null);
              }}
              placeholder="School name"
              className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-medium focus:ring-amber-500 focus:border-amber-500"
            />
            <datalist id="teacher-school-options">
              {schoolOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={saveTeacherProfile}
              disabled={savingProfile}
              className="bg-slate-900 text-amber-500 px-6 py-3 rounded-xl font-black uppercase tracking-wider hover:bg-slate-800 border border-amber-500/20 disabled:opacity-60"
            >
              {savingProfile ? 'Saving…' : 'Save school'}
            </button>
          </div>
          {profileError && <p className="text-rose-400 text-sm mt-2">{profileError}</p>}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-[var(--ca-outline-variant)] bg-[var(--ca-surface-container-low)] px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-black text-[var(--ca-on-surface-variant)] uppercase tracking-[0.14em]">Viewing class</span>
          <select
            value={selectedClassId ?? ''}
            onChange={e => setSelectedClassId(e.target.value ? e.target.value : null)}
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
          { id: 'curriculum', label: 'Curriculum', icon: Layers },
          { id: 'activitybank', label: 'Activity Bank', icon: LayoutGrid },
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
        <ClassroomManager
          teacherId={student.id}
          students={students}
          onStudentsAdded={refetchStudents}
          onNavigateToActivityBank={() => setActiveTab('activitybank')}
          onNavigateToCurriculum={() => setActiveTab('curriculum')}
        />
      )}

      {activeTab === 'curriculum' && (
        <div className="space-y-6">
          <TeacherCurriculumEditor
            classId={selectedClassId != null ? String(selectedClassId) : null}
            className={selectedClass?.name}
            wrapped
          />
          {!selectedClass && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Select a class in the picker above to edit class curriculum and curriculum maps.
            </div>
          )}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <div className="mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-600">Curriculum Maps</p>
              <h3 className="text-xl font-bold text-[#0A192F]">Curriculum Map Builder</h3>
              <p className="text-sm text-slate-500">Build curriculum maps with sectors and activities for the selected class.</p>
            </div>
            <JourneyBuilder
              selectedClassId={selectedClassId != null ? String(selectedClassId) : null}
              classes={classes}
              sectors={sectors.map((s) => ({ id: String(s.id), name: s.name }))}
            />
          </div>
        </div>
      )}

      {activeTab === 'activitybank' && (
        <ActivityBank sectors={sectors.map((s) => ({ id: String(s.id), name: s.name }))} />
      )}

      {activeTab === 'reports' && (
        <ReportCards selectedClassId={selectedClassId} variant="reports" />
      )}
    </div>
  );
};

export default TeacherHub;
