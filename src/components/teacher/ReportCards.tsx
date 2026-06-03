/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, ClipboardList, Download, CheckCircle2, Activity, Zap,
} from 'lucide-react';
import { safeFetch, fetchWithAuth } from '../../app/api';
import type { QuizReviewItem } from '../../app/types';

type ActivityFeedItem = {
  username: string;
  mission_title: string;
  sector_name: string | null;
  completed_at: string;
  xp_earned: number;
};

const formatTimeAgo = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
};

const ReportCard = ({ classId }: { classId: string }) => {
  const [report, setReport] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingStudentId, setExportingStudentId] = useState<string | null>(null);

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
    line('Total XP', String(studentData?.xp ?? 0), 14);
    line('Nodes Completed', String(studentData?.nodes_completed ?? 0), 14);
    line('Average Quiz Score', `${Math.round(Number(studentData?.avg_quiz_score || 0))}%`, 14);
    line('Quizzes Completed', String(studentData?.quizzes_completed ?? 0), 14);
    line('Status', String(studentData?.status || '—'), 14);
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
    const strengths = Array.isArray(studentData?.strengths) ? studentData.strengths.join('; ') : '';
    const gaps = Array.isArray(studentData?.gaps) ? studentData.gaps.join('; ') : '';
    if (strengths) line('Strengths', strengths, 14);
    if (gaps) line('Focus areas', gaps, 14);
    line('Summary', String(studentData?.ai_assessment || 'No summary yet.'), 0);

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
    setExportingStudentId(String(student?.id || ''));
    try {
      await exportStudentPdf(student);
    } finally {
      setExportingStudentId(null);
    }
  };

  const activeStudent = selectedStudent || report[0] || null;

  const statusClass = (status: string) => {
    if (status === 'Behind') return 'bg-rose-100 text-rose-800 border-rose-200';
    if (status === 'Needs Attention') return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-[#0D1C32]">Class reports</h3>
          <p className="text-sm text-slate-600">Overview and per-student report cards with PDF export.</p>
        </div>
        <button
          type="button"
          onClick={handleDownloadSquad}
          disabled={exportingAll || report.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          <Download className="size-4" />
          {exportingAll ? 'Exporting…' : 'Export all PDFs'}
        </button>
      </div>

      {report.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">XP</th>
                <th className="px-4 py-3">Nodes</th>
                <th className="px-4 py-3">Avg score</th>
                <th className="px-4 py-3">Last active</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${activeStudent?.id === r.id ? 'bg-amber-50' : ''}`}
                  onClick={() => setSelectedStudent(r)}
                >
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{r.name}</td>
                  <td className="px-4 py-2.5">{r.level}</td>
                  <td className="px-4 py-2.5">{r.xp ?? 0}</td>
                  <td className="px-4 py-2.5">{r.nodes_completed ?? 0}</td>
                  <td className="px-4 py-2.5">{Math.round(Number(r.avg_quiz_score || 0))}%</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">
                    {r.last_active_at ? formatTimeAgo(r.last_active_at) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(r.status || 'On Track')}`}>
                      {r.status || 'On Track'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
          <div className="bg-white rounded-xl p-6 border border-slate-200 min-h-[480px]">
            {activeStudent ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                  <div>
                    <h4 className="text-xl font-bold text-slate-900">{activeStudent.name}</h4>
                    <p className="text-sm text-slate-500">
                      Level {activeStudent.level} · {activeStudent.xp ?? 0} XP · {activeStudent.nodes_completed ?? 0} nodes
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadStudent(activeStudent)}
                    disabled={exportingStudentId === String(activeStudent.id)}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0A192F] px-4 py-2 text-xs font-bold text-teal-300 disabled:opacity-50"
                  >
                    <Download className="size-4" />
                    Export PDF
                  </button>
                </div>

                {(activeStudent.journey_progress || []).length > 0 && (
                  <section className="mb-5">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Journey progress by sector</p>
                    <div className="space-y-3">
                      {activeStudent.journey_progress.map((jp: { sector_name: string; completed: number; total: number; percent: number }) => (
                        <div key={jp.sector_name}>
                          <div className="flex justify-between text-xs text-slate-600 mb-1">
                            <span className="font-semibold text-slate-800">{jp.sector_name}</span>
                            <span>{jp.completed}/{jp.total} nodes · {jp.percent}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-teal-500 to-cyan-400"
                              style={{ width: `${Math.min(100, jp.percent)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] uppercase text-slate-500 font-bold">Avg quiz</p>
                    <p className="text-lg font-bold text-slate-900">{Math.round(activeStudent.avg_quiz_score || 0)}%</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] uppercase text-slate-500 font-bold">Quizzes</p>
                    <p className="text-lg font-bold text-slate-900">{activeStudent.quizzes_completed ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] uppercase text-slate-500 font-bold">Nodes done</p>
                    <p className="text-lg font-bold text-slate-900">{activeStudent.nodes_completed ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] uppercase text-slate-500 font-bold">Status</p>
                    <p className="text-sm font-bold text-slate-900">{activeStudent.status || 'On Track'}</p>
                  </div>
                </div>

                <section className="mb-5 grid md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800 mb-2">Strengths</p>
                    <ul className="text-sm text-emerald-900 space-y-1 list-disc list-inside">
                      {(activeStudent.strengths || []).map((s: string) => (
                        <li key={s}>{s}</li>
                      ))}
                      {!(activeStudent.strengths || []).length && <li className="list-none text-slate-500">—</li>}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 mb-2">Focus areas</p>
                    <ul className="text-sm text-amber-900 space-y-1 list-disc list-inside">
                      {(activeStudent.gaps || []).map((g: string) => (
                        <li key={g}>{g}</li>
                      ))}
                      {!(activeStudent.gaps || []).length && <li className="list-none text-slate-500">—</li>}
                    </ul>
                  </div>
                </section>

                {(activeStudent.challenge_performance || []).length > 0 && (
                  <section className="mb-5">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Challenge performance</p>
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] uppercase text-slate-500">
                            <th className="px-3 py-2 text-left">Challenge</th>
                            <th className="px-3 py-2 text-left">Score</th>
                            <th className="px-3 py-2 text-left">When</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeStudent.challenge_performance.map((c: { title: string; score: number; attempted_at: string }, i: number) => (
                            <tr key={`${c.title}-${i}`} className="border-t border-slate-100">
                              <td className="px-3 py-2 font-medium text-slate-800">{c.title}</td>
                              <td className="px-3 py-2">{c.score}%</td>
                              <td className="px-3 py-2 text-slate-500 text-xs">{formatTimeAgo(c.attempted_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {(activeStudent.recent_activity || []).length > 0 && (
                  <section className="mb-5">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Recent activity</p>
                    <ol className="space-y-2">
                      {activeStudent.recent_activity.map((a: { title: string; kind: string; at: string; xp?: number }, i: number) => (
                        <li key={`${a.title}-${i}`} className="flex justify-between gap-2 text-sm rounded-lg border border-slate-200 px-3 py-2">
                          <span className="text-slate-800">{a.title}</span>
                          <span className="text-slate-500 text-xs shrink-0">{formatTimeAgo(a.at)}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                <section>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Skills & domains</p>
                  <div className="flex flex-wrap gap-2">
                    {(activeStudent.mastery_domains || []).map((d: string) => (
                      <span key={d} className="rounded-full bg-teal-50 border border-teal-200 px-2.5 py-1 text-xs text-teal-800">{d}</span>
                    ))}
                    {(activeStudent.skills_learned || []).map((s: string) => (
                      <span key={s} className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs text-slate-700">{s}</span>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <p className="text-sm text-slate-500 py-16 text-center">Select a student from the list or table.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ReportCards({
  selectedClassId,
  variant = 'reports',
}: {
  selectedClassId: string | null;
  variant?: 'reviews' | 'reports' | 'activity';
}) {
  const [pendingReviews, setPendingReviews] = useState<QuizReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const refreshPendingReviews = useCallback(async () => {
    setReviewsLoading(true);
    const query = selectedClassId ? `?class_id=${selectedClassId}` : '';
    const data = await safeFetch(`/api/teacher/quiz-reviews/pending${query}`);
    setPendingReviews(Array.isArray(data) ? data : []);
    setReviewsLoading(false);
  }, [selectedClassId]);

  useEffect(() => {
    if (variant !== 'reviews') return;
    refreshPendingReviews();
  }, [variant, refreshPendingReviews]);

  const refreshActivityFeed = useCallback(async () => {
    if (!selectedClassId) {
      setActivityFeed([]);
      return;
    }
    setActivityLoading(true);
    const data = await safeFetch(`/api/classes/${selectedClassId}/activity-feed`);
    setActivityFeed(Array.isArray(data) ? data : []);
    setActivityLoading(false);
  }, [selectedClassId]);

  useEffect(() => {
    if (variant !== 'activity') return;
    void refreshActivityFeed();
    const interval = window.setInterval(() => {
      void refreshActivityFeed();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [variant, refreshActivityFeed]);

  const gradeReview = async (reviewId: string, awardedScore: number) => {
    await fetchWithAuth(`/api/teacher/quiz-reviews/${reviewId}/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ awarded_score: awardedScore }),
    });
    refreshPendingReviews();
  };

  return (
    <>
      {variant === 'reviews' && (
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

      {variant === 'activity' && (
      <div className="space-y-6">
        <div className="rounded-2xl border border-amber-500/30 bg-[#0A192F] p-6 text-slate-100">
          <h3 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <Activity className="size-6" />
            Mission Activity
          </h3>
          <p className="text-slate-300 text-sm mt-1">
            Live feed of mission completions across this class. Updates automatically every minute.
          </p>
        </div>
        {!selectedClassId ? (
          <div className="bg-slate-900/50 backdrop-blur-md p-20 rounded-3xl border border-slate-800 text-center">
            <Users className="size-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-mono text-sm italic">Select a class from the dropdown above to view activity.</p>
          </div>
        ) : activityLoading && activityFeed.length === 0 ? (
          <p className="text-slate-400 text-sm">Loading activity…</p>
        ) : activityFeed.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-slate-500">
            No mission completions yet for this class.
          </div>
        ) : (
          <ol className="relative border-l-2 border-amber-500/30 ml-3 space-y-6">
            {activityFeed.map((item, index) => (
              <li key={`${item.username}-${item.completed_at}-${index}`} className="ml-6">
                <span className="absolute -left-[9px] mt-1.5 size-4 rounded-full bg-amber-500 ring-4 ring-[var(--ca-surface-container)]" />
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-black text-[#0D1C32]">{item.username}</p>
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                      {formatTimeAgo(item.completed_at)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">
                    Completed: <span className="font-semibold">{item.mission_title}</span>
                    {item.sector_name ? (
                      <> in <span className="font-semibold">{item.sector_name}</span></>
                    ) : null}
                  </p>
                  <p className="text-xs font-black text-amber-600 mt-2 flex items-center gap-1">
                    <Zap className="size-3.5" />
                    {item.xp_earned} XP earned
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      )}

      {variant === 'reports' && (
      <div className="space-y-6">
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
    </>
  );
}
