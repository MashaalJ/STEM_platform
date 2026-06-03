/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Settings } from 'lucide-react';
import PrivateRoute from './PrivateRoute';
import Auth from '../views/Auth';
import AdminDashboard from '../views/AdminDashboard';
import ParentDashboard from '../views/ParentDashboard';
import TeacherHub from '../views/TeacherHub';
import ActivityBank from '../components/teacher/ActivityBank';
import { ChallengeBuilder, ChallengeRenderer } from '../challenges';
import { QuizPlayer } from '../challenges/QuizPlayer';
import {
  GalaxyMap,
  RocketChatPanel,
  SectorView,
  StudentSectorContent,
} from '../views/GalaxyMap';
import {
  StudentDashboard,
  SquadLeaderboard,
  AwardsView,
  StudentCommandConsole,
} from '../views/StudentConsole';
import PrincipalDashboard from '../views/PrincipalDashboard';
import JourneyView from '../views/JourneyView';
import { completePendingJourneyNode } from '../lib/journeyProgress';
import { GamePlayer, MissionSimulation } from '../views/MissionPlayer';
import {
  isFullscreenMission,
  isElectricityPreFlowMission,
  sectorNameForMission,
} from '../app/types';
import { safeFetch } from '../app/api';
import { useApp } from '../context/AppContext';
import { homePathForRole } from '../app/routes';
import type { Mission } from '../app/types';

const viewMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

function RootRedirect() {
  const { isLoggedIn, student } = useApp();
  const token = localStorage.getItem('stemverse_access_token');
  if (!token || !isLoggedIn) return <Navigate to="/login" replace />;
  return <Navigate to={homePathForRole(student?.role)} replace />;
}

function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { isLoggedIn, student, handleLogin } = useApp();
  if (isLoggedIn) return <Navigate to={homePathForRole(student?.role)} replace />;
  return <Auth mode={mode} onLogin={handleLogin} />;
}

function GalaxyPage() {
  const { sectorId } = useParams();
  const navigate = useNavigate();
  const app = useApp();
  const {
    sectors,
    student,
    selectedSector,
    setSelectedSector,
    handlePlayMission,
    activeMission,
  } = app;

  useEffect(() => {
    if (!sectorId) {
      setSelectedSector(null);
      return;
    }
    const sector = sectors.find((s) => String(s.id) === sectorId);
    if (sector) setSelectedSector(sector);
  }, [sectorId, sectors, setSelectedSector]);

  if (sectorId === 'chat') {
    return <RocketChatPanel onBack={() => navigate('/galaxy')} />;
  }

  if (sectorId && selectedSector && String(selectedSector.id) === sectorId) {
    if (student?.role === 'student') {
      return (
        <div className="px-2 sm:px-4 pb-8">
          <button
            type="button"
            onClick={() => navigate('/galaxy')}
            className="mb-4 text-sm font-bold text-teal-300 hover:text-teal-200"
          >
            ← Back to Galaxy
          </button>
          <StudentSectorContent
            student={student}
            sector={selectedSector}
            onBack={() => navigate('/galaxy')}
            onPlayMission={(m) => handlePlayMission(m)}
            onOpenMissionById={(missionId) => navigate(`/mission/${missionId}`)}
            onOpenChallenge={(id) => {
              app.setActiveChallengeId(id);
              navigate('/console');
            }}
            onOpenQuiz={(quizId) => {
              app.setGeneratedQuizId(quizId);
              app.setGeneratedQuizTitle('Journey Quiz');
              navigate('/console');
            }}
          />
        </div>
      );
    }
    return (
      <SectorView
        sector={selectedSector}
        onBack={() => navigate('/galaxy')}
        onPlayMission={(m) => handlePlayMission(m)}
        allUnlocked={student?.role === 'teacher' || student?.role === 'admin'}
      />
    );
  }

  return (
    <div className="ca-galaxy-view px-0 py-0">
      <div className="text-center mb-6 sm:mb-8 max-w-2xl mx-auto px-4 pt-4 sm:pt-6">
        <h2 className="cosmic-page-heading text-3xl sm:text-4xl font-bold mb-2 sm:mb-3 text-white">Galaxy Sector Hub</h2>
        <p className="cosmic-page-sub text-sm sm:text-base text-slate-300">
          Navigate the star systems of knowledge and enter a sector to begin.
        </p>
      </div>
      <GalaxyMap
        sectors={sectors}
        onSelectSector={(s) => navigate(`/galaxy/${s.id}`)}
        onOpenCurriculum={() => navigate('/console/journeys')}
        onOpenRocketChat={() => navigate('/galaxy/chat')}
        student={student}
        activeMission={activeMission}
      />
    </div>
  );
}

function MissionPage() {
  const { missionId } = useParams();
  const navigate = useNavigate();
  const app = useApp();
  const {
    sectors,
    selectedSector,
    handleMissionComplete,
    handleCloseMission,
    setActiveMission,
  } = app;
  const [mission, setMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!missionId) {
      setMission(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const all = await safeFetch('/api/missions');
      const found = Array.isArray(all)
        ? (all as Mission[]).find((m) => String(m.id) === missionId)
        : null;
      if (!cancelled) {
        setMission(found ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missionId]);

  useEffect(() => {
    if (mission) setActiveMission(mission);
  }, [mission, setActiveMission]);

  if (loading) {
    return (
      <div className="cosmic-page-shell py-20 text-center">
        <p className="text-slate-400">Loading mission…</p>
      </div>
    );
  }

  if (!missionId || !mission) {
    return (
      <div className="cosmic-page-shell py-20 text-center">
        <p className="text-slate-400 mb-4">Mission not found.</p>
        <button type="button" className="cosmic-btn-secondary" onClick={() => navigate('/galaxy')}>
          Back to Galaxy
        </button>
      </div>
    );
  }

  const sectorName = sectorNameForMission(mission, sectors, selectedSector);
  const fullscreen = isFullscreenMission(mission, sectorName);

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[120] bg-[#050810]">
        <button
          type="button"
          onClick={handleCloseMission}
          className="fixed top-4 left-4 z-[130] w-12 h-12 flex items-center justify-center rounded-full bg-[#0d1c32]/80 backdrop-blur-xl border border-amber-400/25 text-amber-400 hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(245,158,11,0.35)]"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <GamePlayer mission={mission} sectorName={sectorName} onComplete={() => handleMissionComplete(mission)} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div className="cosmic-modal-overlay absolute inset-0" onClick={handleCloseMission} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="cosmic-modal relative w-full max-w-4xl rounded-[var(--ca-radius-xl)] p-1 overflow-hidden"
      >
        {mission.embed_code || isElectricityPreFlowMission(mission, sectorName) ? (
          <GamePlayer mission={mission} sectorName={sectorName} onComplete={() => handleMissionComplete(mission)} />
        ) : (
          <MissionSimulation mission={mission} onComplete={handleMissionComplete} onCancel={handleCloseMission} />
        )}
      </motion.div>
    </div>
  );
}

function ConsolePage() {
  const navigate = useNavigate();
  const app = useApp();
  const {
    student,
    missionRecommendations,
    assignedMissions,
    assignedChallenges,
    assignedQuizzes,
    studentQuizHistory,
    recentlyCompletedChallengeIds,
    sectors,
    setSelectedSector,
    setGeneratedQuizId,
    setGeneratedQuizTitle,
    setActiveChallengeId,
    generatedQuizId,
    activeChallengeId,
    refreshAssignedContent,
    challengeAccent,
    setSettingsOpen,
  } = app;

  if (!student) return null;

  if (generatedQuizId) {
    return (
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
              if (student?.id) setTimeout(() => refreshAssignedContent(student.id), 1200);
            }}
          />
        </div>
      </div>
    );
  }

  if (activeChallengeId) {
    return (
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
                app.setStudent((s) => (s ? { ...s, xp: result.total_xp! } : null));
              }
              if (student?.id) {
                const now = new Date().toISOString();
                app.setAssignedChallenges((prev) =>
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
                app.setRecentlyCompletedChallengeIds((prev) =>
                  activeChallengeId != null && !prev.includes(activeChallengeId)
                    ? [...prev, activeChallengeId]
                    : prev
                );
                setTimeout(() => refreshAssignedContent(student.id), 1200);
                void completePendingJourneyNode();
              }
              setActiveChallengeId(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <StudentCommandConsole
      student={student}
      missionRecommendations={missionRecommendations}
      assignedMissions={assignedMissions}
      assignedChallenges={assignedChallenges}
      assignedQuizzes={assignedQuizzes}
      studentQuizHistory={studentQuizHistory}
      recentlyCompletedChallengeIds={recentlyCompletedChallengeIds}
      sectors={sectors}
      setSelectedSector={setSelectedSector}
      navigate={navigate}
      setGeneratedQuizId={setGeneratedQuizId}
      setGeneratedQuizTitle={setGeneratedQuizTitle}
      setActiveChallengeId={setActiveChallengeId}
      challengeAccent={challengeAccent}
    />
  );
}

function ConsoleProfilePage() {
  const { student, setSettingsOpen } = useApp();
  const navigate = useNavigate();
  if (!student) return null;
  return (
    <>
      <div className="mb-12">
        <h2 className="cosmic-page-heading text-4xl font-bold mb-2">Operator Profile</h2>
        <p className="cosmic-page-sub text-[10px] text-[var(--ca-on-surface-variant)]">Your details, progress, and achievement logs</p>
      </div>
      <StudentDashboard
        student={student}
        onOpenSettings={() => setSettingsOpen(true)}
        navigate={navigate}
      />
    </>
  );
}

function SchoolPage() {
  const app = useApp();
  const { student } = app;
  if (!student) return null;
  return (
    <>
      <div className="mb-6">
        <h2 className="cosmic-page-heading text-4xl font-bold mb-2">Principal Dashboard</h2>
        <p className="cosmic-page-sub text-[10px] text-[var(--ca-on-surface-variant)]">
          {student.school_record_name || 'School overview'}
        </p>
      </div>
      <PrincipalDashboard student={student} />
    </>
  );
}

function TeacherPage({ initialClassId }: { initialClassId?: string }) {
  const app = useApp();
  const { sectors, students, student, setStudent, setStudents } = app;
  if (!student) return null;
  return (
    <>
      <div className="mb-6">
        <h2 className="cosmic-page-heading text-4xl font-bold mb-2">Dashboard</h2>
        <p className="cosmic-page-sub text-[10px] text-[var(--ca-on-surface-variant)]">
          Classes, analytics &amp; assignments
        </p>
      </div>
      <TeacherHub
        sectors={sectors}
        students={students}
        student={student}
        setStudent={setStudent}
        initialClassId={initialClassId}
        refetchStudents={() => safeFetch('/api/students').then((data) => data && setStudents(data))}
      />
    </>
  );
}

function TeacherClassPage() {
  const { classId } = useParams();
  return <TeacherPage initialClassId={classId} />;
}

function TeacherChallengesPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-0">
      <ChallengeBuilder />
    </div>
  );
}

function TeacherCreateMissionPage() {
  const { sectors } = useApp();
  return (
    <>
      <div className="mb-8">
        <h2 className="cosmic-page-heading text-4xl font-bold mb-2">Activity Bank</h2>
        <p className="cosmic-page-sub text-[10px] text-[var(--ca-on-surface-variant)]">Create learning activities for your journeys</p>
      </div>
      <ActivityBank sectors={sectors.map((s) => ({ id: String(s.id), name: s.name }))} />
    </>
  );
}

function TeacherProfilePage() {
  const { student, setSettingsOpen } = useApp();
  if (!student) return null;
  return (
    <>
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
    </>
  );
}

function SquadPage() {
  const { student } = useApp();
  if (!student) return null;
  return (
    <>
      <div className="mb-12">
        <h2 className="cosmic-page-heading text-4xl font-bold mb-2">Cosmic Leaderboard</h2>
        <p className="cosmic-page-sub text-[10px] text-[var(--ca-on-surface-variant)]">The sector&apos;s top performing explorers and elite squads.</p>
      </div>
      <SquadLeaderboard student={student} />
    </>
  );
}

function AwardsPage() {
  const { student } = useApp();
  if (!student) return null;
  return (
    <>
      <div className="mb-12">
        <h2 className="cosmic-page-heading text-4xl font-bold mb-2">Hall of Achievements</h2>
        <p className="cosmic-page-sub text-[10px] text-[var(--ca-on-surface-variant)]">
          Badges, missions, and quiz attempts from your live account.
        </p>
      </div>
      <AwardsView student={student} />
    </>
  );
}

function JourneysPage() {
  const { student, setActiveChallengeId, setGeneratedQuizId, setGeneratedQuizTitle } = useApp();
  const navigate = useNavigate();
  if (!student) return null;
  return (
    <>
      <div className="mb-12">
        <h2 className="cosmic-page-heading text-4xl font-bold mb-2">Journeys</h2>
        <p className="cosmic-page-sub text-[10px] text-[var(--ca-on-surface-variant)]">
          Follow your class learning paths node by node.
        </p>
      </div>
      <JourneyView
        student={student}
        onOpenMission={(missionId) => navigate(`/mission/${missionId}`)}
        onOpenChallenge={(challengeId) => setActiveChallengeId(challengeId)}
        onOpenQuiz={(quizId) => {
          setGeneratedQuizId(quizId);
          setGeneratedQuizTitle('Journey Quiz');
          navigate('/console');
        }}
      />
    </>
  );
}

function RoutedMain({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isImmersiveSection, pathname } = useApp();
  const viewClassName =
    pathname.startsWith('/galaxy') && !pathname.includes('/galaxy/')
      ? ''
      : pathname === '/console'
        ? 'space-y-10'
        : '';

  return (
    <main className={`relative z-10 ${isImmersiveSection ? 'px-0 py-0' : 'cosmic-page-shell'}`}>
      <AnimatePresence mode="wait">
        <motion.div key={location.key} className={viewClassName} {...viewMotion}>
          {children}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />

      <Route
        path="/galaxy"
        element={
          <PrivateRoute roles={['student', 'teacher', 'admin']}>
            <RoutedMain><GalaxyPage /></RoutedMain>
          </PrivateRoute>
        }
      />
      <Route
        path="/galaxy/:sectorId"
        element={
          <PrivateRoute roles={['student', 'teacher', 'admin']}>
            <RoutedMain><GalaxyPage /></RoutedMain>
          </PrivateRoute>
        }
      />
      <Route
        path="/mission/:missionId"
        element={
          <PrivateRoute roles={['student', 'teacher', 'admin']}>
            <MissionPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/console"
        element={
          <PrivateRoute roles={['student']}>
            <RoutedMain><ConsolePage /></RoutedMain>
          </PrivateRoute>
        }
      />
      <Route
        path="/console/profile"
        element={
          <PrivateRoute roles={['student']}>
            <RoutedMain><ConsoleProfilePage /></RoutedMain>
          </PrivateRoute>
        }
      />
      <Route
        path="/console/squad"
        element={
          <PrivateRoute roles={['student', 'teacher', 'admin']}>
            <RoutedMain><SquadPage /></RoutedMain>
          </PrivateRoute>
        }
      />
      <Route
        path="/console/journeys"
        element={
          <PrivateRoute roles={['student']}>
            <RoutedMain><JourneysPage /></RoutedMain>
          </PrivateRoute>
        }
      />
      <Route
        path="/console/awards"
        element={
          <PrivateRoute roles={['student']}>
            <RoutedMain><AwardsPage /></RoutedMain>
          </PrivateRoute>
        }
      />
      <Route
        path="/teacher"
        element={
          <PrivateRoute roles={['teacher', 'admin']}>
            <RoutedMain><TeacherPage /></RoutedMain>
          </PrivateRoute>
        }
      />
      <Route
        path="/teacher/classes/:classId"
        element={
          <PrivateRoute roles={['teacher', 'admin']}>
            <RoutedMain><TeacherClassPage /></RoutedMain>
          </PrivateRoute>
        }
      />
      <Route
        path="/teacher/challenges"
        element={
          <PrivateRoute roles={['teacher', 'admin']}>
            <RoutedMain><TeacherChallengesPage /></RoutedMain>
          </PrivateRoute>
        }
      />
      <Route
        path="/teacher/create-mission" // legacy URL — not linked in teacher UI
        element={
          <PrivateRoute roles={['teacher', 'admin']}>
            <RoutedMain><TeacherCreateMissionPage /></RoutedMain>
          </PrivateRoute>
        }
      />
      <Route
        path="/teacher/profile"
        element={
          <PrivateRoute roles={['teacher', 'admin']}>
            <RoutedMain><TeacherProfilePage /></RoutedMain>
          </PrivateRoute>
        }
      />
      <Route
        path="/school"
        element={
          <PrivateRoute roles={['school_admin']}>
            <RoutedMain>
              <SchoolPage />
            </RoutedMain>
          </PrivateRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <PrivateRoute roles={['admin']}>
            <RoutedMain><AdminDashboard /></RoutedMain>
          </PrivateRoute>
        }
      />
      <Route
        path="/parent"
        element={
          <PrivateRoute roles={['parent']}>
            <ParentDashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/parent/*"
        element={
          <PrivateRoute roles={['parent']}>
            <Navigate to="/parent" replace />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
