/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { safeFetch, fetchWithAuth, authFetch } from './api';
import type {
  Sector,
  Mission,
  Student,
  AssignedMissionRow,
  AssignedQuizRow,
  StudentQuizAttemptRow,
  MissionRecommendation,
} from './types';
import type { NotificationItem } from '../components/Navbar';
import {
  dismissStudentOnboardingStorage,
  isStudentOnboardingDismissed,
  mapOnboardingToApi,
  type OnboardingSubmitPayload,
} from '../components/StudentOnboardingModal';
import { TUTORIAL_COMPLETED_KEY } from '../components/StudentFirstLoginTutorial';
import { homePathForRole, isImmersivePath } from './routes';
import { completePendingJourneyNode } from '../lib/journeyProgress';

export function useAppState() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [assignedChallenges, setAssignedChallenges] = useState<{
    id: string;
    title: string;
    type: string;
    xp_reward: number;
    latest_score?: number | null;
    latest_correct?: number | null;
    latest_attempted_at?: string | null;
  }[]>([]);
  const [assignedMissions, setAssignedMissions] = useState<AssignedMissionRow[]>([]);
  const [recentlyCompletedChallengeIds, setRecentlyCompletedChallengeIds] = useState<string[]>([]);
  const [assignedQuizzes, setAssignedQuizzes] = useState<AssignedQuizRow[]>([]);
  const [studentQuizHistory, setStudentQuizHistory] = useState<StudentQuizAttemptRow[]>([]);
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [generatedQuizId, setGeneratedQuizId] = useState<string | null>(null);
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
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [missionCelebration, setMissionCelebration] = useState<{
    xp: number;
    leveledUp: boolean;
    newLevel?: number;
  } | null>(null);
  const isImmersivePlay =
    pathname.startsWith('/console/quiz/') ||
    pathname.startsWith('/console/challenge/') ||
    (pathname === '/console' && (generatedQuizId != null || activeChallengeId != null));
  const isImmersiveSection = isImmersivePath(pathname) || isImmersivePlay;

  const refreshAssignedContent = useCallback((studentId: string) => {
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
    const restoreSession = async () => {
      const token = localStorage.getItem('stemverse_access_token');
      if (!token) return;
      const res = await fetchWithAuth('/api/me');
      if (res.status === 401) {
        localStorage.removeItem('stemverse_access_token');
        return;
      }
      const data = await res.json().catch(() => null);
      if (data?.authenticated && data.user) {
        setStudent(data.user);
        setIsLoggedIn(true);
        if (data.user.role === 'teacher' || data.user.role === 'admin') {
          safeFetch('/api/students').then((s) => s && setStudents(s));
          safeFetch('/api/sectors').then((s) => s && setSectors(s));
        } else if (data.user.role === 'student') {
          safeFetch('/api/sectors').then((s) => s && setSectors(s));
        }
        if (data.user?.name) {
          try {
            localStorage.setItem('stemverse_player_name', String(data.user.name).split(' ')[0]);
          } catch {
            /* ignore */
          }
        }
        if (data.user.role === 'parent') {
          navigate('/parent', { replace: true });
        }
      } else if (!res.ok) {
        localStorage.removeItem('stemverse_access_token');
      }
    };
    restoreSession();
  }, [navigate]);

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
        safeFetch(`/api/students/${student.id}/onboarding`).then((onboarding) => {
          const dismissed = isStudentOnboardingDismissed();
          setInterestModalOpen(Boolean(onboarding?.should_show) && !dismissed);
        });
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
    if (!isLoggedIn || student?.role !== 'student') {
      setTutorialOpen(false);
      return;
    }
    if (interestModalOpen) return;
    let localDone = false;
    try {
      localDone = localStorage.getItem(TUTORIAL_COMPLETED_KEY) === '1';
    } catch {
      /* ignore */
    }
    if (!localDone && !student.tutorial_completed) {
      setTutorialOpen(true);
    }
  }, [isLoggedIn, student?.role, student?.tutorial_completed, interestModalOpen]);

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

  const markNotificationRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
    await authFetch(`/api/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {});
  };

  const markAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    await authFetch('/api/notifications/read-all', { method: 'PATCH' }).catch(() => {});
  };

  const openNotificationLink = (link: string | null | undefined) => {
    if (!link) return;
    // Current link format: "challenge:<id>"
    if (link.startsWith('challenge:')) {
      const id = link.split(':')[1];
      if (id) {
        navigate('/console');
        setActiveChallengeId(id);
      } else {
        navigate('/console');
      }
      return;
    }
    navigate('/console');
  };

  const toggleInterest = (key: string) => {
    setInterestError(null);
    setInterestSelections((prev) => {
      if (prev.includes(key)) return prev.filter((x) => x !== key);
      if (prev.length >= 6) return prev;
      return [...prev, key];
    });
  };

  const completeStudentOnboarding = async (payload: OnboardingSubmitPayload) => {
    if (!student?.id) return;
    setSavingInterests(true);
    setInterestError(null);
    try {
      const apiBody = mapOnboardingToApi(payload);
      if (apiBody.interests.length >= 2) {
        const res = await fetchWithAuth(`/api/students/${student.id}/interests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selected: apiBody.interests }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setInterestError(data.message || data.error || 'Could not save interests.');
          throw new Error('interests failed');
        }
        setInterestSelections(apiBody.interests);
        safeFetch(`/api/students/${student.id}/recommendations`).then((out) =>
          setMissionRecommendations(Array.isArray(out?.recommendations) ? out.recommendations : [])
        );
      }
      const onboardRes = await fetchWithAuth(`/api/students/${student.id}/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiBody),
      });
      const onboardData = await onboardRes.json().catch(() => ({}));
      if (!onboardRes.ok) {
        setInterestError(onboardData.message || onboardData.error || 'Could not save onboarding.');
        throw new Error('onboarding failed');
      }
      if (onboardData?.highlight_sector_id) {
        try {
          localStorage.setItem('stemverse_highlight_sector_id', String(onboardData.highlight_sector_id));
        } catch {
          /* ignore */
        }
      }
      safeFetch('/api/sectors').then((data) => data && setSectors(data));
      safeFetch('/api/me').then((data) => {
        if (data?.authenticated && data.user) setStudent(data.user);
      });
      dismissStudentOnboardingStorage();
      setInterestModalOpen(false);
      navigate('/galaxy');
    } finally {
      setSavingInterests(false);
    }
  };

  const markTutorialComplete = async () => {
    try {
      localStorage.setItem(TUTORIAL_COMPLETED_KEY, '1');
    } catch {
      /* ignore */
    }
    setTutorialOpen(false);
    if (student?.id) {
      await authFetch(`/api/students/${student.id}/tutorial-complete`, { method: 'POST' }).catch(() => undefined);
      safeFetch('/api/me').then((data) => {
        if (data?.authenticated && data.user) setStudent(data.user);
      });
    }
    navigate('/galaxy');
  };

  const dismissStudentOnboarding = () => {
    dismissStudentOnboardingStorage();
    setInterestModalOpen(false);
    setInterestError(null);
  };

  const handleLogin = (user: any) => {
    const token = localStorage.getItem('stemverse_access_token');
    if (!token) {
      setIsLoggedIn(false);
      setStudent(null);
      navigate('/login', { replace: true });
      return;
    }
    setStudent(user);
    setIsLoggedIn(true);
    if (user?.role === 'teacher' || user?.role === 'admin') {
      safeFetch('/api/students').then((s) => s && setStudents(s));
      safeFetch('/api/sectors').then((s) => s && setSectors(s));
    } else if (user?.role === 'student') {
      safeFetch('/api/sectors').then((s) => s && setSectors(s));
    }
    if (user?.name) {
      try {
        localStorage.setItem('stemverse_player_name', String(user.name).split(' ')[0]);
      } catch {
        /* ignore */
      }
    }
    navigate(homePathForRole(user.role), { replace: true });
  };

  const handleSelectSector = (sector: Sector) => {
    setSelectedSector(sector);
    navigate(`/galaxy/${sector.id}`);
  };

  const handlePlayMission = (mission: Mission) => {
    setActiveMission(mission);
    navigate(`/mission/${mission.id}`);
  };

  const handleCloseMission = () => {
    setActiveMission(null);
    if (selectedSector) {
      navigate(`/galaxy/${selectedSector.id}`);
    } else {
      navigate('/galaxy');
    }
  };

  const handleMissionComplete = async (mission: Mission) => {
    if (!student) return;
    console.log('[handleMissionComplete] starting', { missionId: mission.id, title: mission.title });
    setActiveMission(null);

    const prevLevel = student.level ?? 1;
    let leveledUp = false;
    let newLevel = prevLevel;

    try {
      if (student.role === "student") {
        const completeRes = await authFetch(
          `/api/students/${student.id}/missions/${mission.id}/complete`,
          { method: "POST" },
        );
        const completeData = await completeRes.json().catch(() => ({}));
        if (!completeRes.ok) {
          console.error("Mission complete API failed:", completeRes.status, completeData);
        } else if (completeData?.student) {
          newLevel = completeData.student.level ?? prevLevel;
          leveledUp = newLevel > prevLevel;
          setStudent(completeData.student);
        } else {
          try {
            const meRes = await authFetch("/api/me");
            const meData = await meRes.json().catch(() => ({}));
            if (meData?.user) {
              newLevel = meData.user.level ?? prevLevel;
              leveledUp = newLevel > prevLevel;
              setStudent(meData.user);
            }
          } catch (e) {
            console.error("Mission complete: refresh /api/me failed:", e);
          }
        }
        safeFetch('/api/sectors').then((data) => data && setSectors(data));
        await completePendingJourneyNode();
      }
      const xp = mission.xp_reward ?? 0;
      const logRes = await authFetch('/api/activity-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'mission_complete',
          metadata: {
            mission_id: mission.id,
            mission_title: mission.title,
            xp_reward: xp,
            student_name: student.name,
          },
        }),
      });
      if (!logRes.ok) {
        console.error("Mission complete: activity-log failed:", logRes.status);
      }

      setMissionCelebration({ xp, leveledUp, newLevel: leveledUp ? newLevel : undefined });
      const celebrationMs = leveledUp ? 2800 : 2000;
      if (student.role === 'student') {
        window.setTimeout(() => {
          setMissionCelebration(null);
          setQuizPromptMission(mission);
          setQuizGenerateError(null);
        }, celebrationMs);
      } else {
        window.setTimeout(() => setMissionCelebration(null), 1200);
      }
    } catch (e) {
      console.error("Mission complete failed:", e);
    }
  };

  const handleGenerateQuizFromMission = async () => {
    if (!quizPromptMission) return;
    setGeneratingQuiz(true);
    setQuizGenerateError(null);
    try {
      const res = await authFetch(`/api/missions/${quizPromptMission.id}/generate-quiz`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) {
        setQuizGenerateError(data.message || data.error || 'Could not generate quiz.');
        return;
      }
      setGeneratedQuizId(String(data.id));
      setGeneratedQuizTitle(String(data.title || `${quizPromptMission.title} Quiz`));
      setQuizPromptMission(null);
      navigate('/console');
      setActiveChallengeId(null);
    } catch {
      setQuizGenerateError('Network error while generating quiz.');
    } finally {
      setGeneratingQuiz(false);
    }
  };

  return {
    navigate,
    pathname,
    location,
    sectors, setSectors,
    students, setStudents,
    selectedSector, setSelectedSector,
    student, setStudent,
    activeMission, setActiveMission,
    isLoggedIn, setIsLoggedIn,
    settingsOpen, setSettingsOpen,
    assignedChallenges, setAssignedChallenges,
    assignedMissions,
    recentlyCompletedChallengeIds, setRecentlyCompletedChallengeIds,
    assignedQuizzes,
    studentQuizHistory,
    activeChallengeId, setActiveChallengeId,
    generatedQuizId, setGeneratedQuizId,
    generatedQuizTitle, setGeneratedQuizTitle,
    quizPromptMission, setQuizPromptMission,
    generatingQuiz,
    quizGenerateError,
    notifications,
    missionRecommendations,
    interestModalOpen,
    interestSelections,
    savingInterests,
    interestError,
    tutorialOpen,
    missionCelebration, setMissionCelebration,
    isImmersivePlay,
    isImmersiveSection,
    refreshAssignedContent,
    challengeAccent,
    markNotificationRead,
    markAllNotificationsRead,
    openNotificationLink,
    toggleInterest,
    completeStudentOnboarding,
    dismissStudentOnboarding,
    markTutorialComplete,
    handleLogin,
    handleSelectSector,
    handlePlayMission,
    handleCloseMission,
    handleMissionComplete,
    handleGenerateQuizFromMission,
  };
}

export type AppState = ReturnType<typeof useAppState>;
