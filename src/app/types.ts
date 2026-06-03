/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { isToolActivityEmbed, isScreensActivityEmbed } from '../lib/toolActivity';
interface Sector {
  id: string;
  name: string;
  description: string;
  xp_reward: number;
  required_level: number;
  mastery_percent: number;
  status: 'active' | 'locked' | 'maintenance' | 'archived' | 'coming_soon';
  image_url: string;
  sort_order?: number;
  is_starter?: number;
  /** True when a deployed class/default journey with nodes exists for this sector. */
  has_deployed_journey?: boolean;
}

interface Mission {
  id: string;
  sector_id: string;
  title: string;
  description: string;
  difficulty: string;
  xp_reward: number;
  status: string;
  image_url: string;
  embed_code?: string;
  grade_level?: string | null;
  prerequisite_mission_id?: string | null;
  learning_outcomes_json?: string | null;
  domains_json?: string | null;
  learning_outcomes?: string[];
  domains?: string[];
}

const ARDUINO_BLOCKLY_EMBED = 'stemverse://arduino-uno-blockly';
const ELECTRICITY_PRE_FLOW_EMBED = 'stemverse://electricity-pre-flow';

const isArduinoBlocklyEmbed = (value: string | null | undefined) => {
  const v = String(value || '').trim().toLowerCase();
  return (
    v === 'stemverse://arduino-uno-blockly' ||
    v === 'stemverse://arduino-blockly' ||
    v === 'stemverse://arduino-ide'
  );
};

const isElectricityPreFlowEmbed = (value: string | null | undefined) => {
  const v = String(value || '').trim().toLowerCase();
  return (
    v === ELECTRICITY_PRE_FLOW_EMBED ||
    v.includes('/electricity.html') ||
    v.includes('electricity-pre-flow') ||
    v.includes('stemverse://electricity')
  );
};

function electricityActivityUrl(): string {
  if (typeof window === 'undefined') return '/electricity.html';
  const u = new URL('/electricity.html', window.location.origin);
  u.searchParams.set('embed', '1');
  return u.href;
}

const isArduinoMissionByMetadata = (mission: Mission | null | undefined) => {
  if (!mission) return false;
  if (isArduinoBlocklyEmbed(mission.embed_code)) return true;
  const text = `${mission.title || ''} ${mission.description || ''}`.toLowerCase();
  return text.includes('blockly') || text.includes('arduino');
};

const isElectricityPreFlowMission = (mission: Mission | null | undefined, sectorName?: string | null) => {
  if (!mission) return false;
  if (isElectricityPreFlowEmbed(mission.embed_code)) return true;
  const sector = String(sectorName || '').toLowerCase();
  if (sector.includes('dark city')) return true;
  const text = `${mission.title || ''} ${mission.description || ''}`.toLowerCase();
  return (
    text.includes('dark city') ||
    text.includes('circuit rescue') ||
    text.includes('electricity') ||
    text.includes('power the grid')
  );
};

const isToolActivityMission = (mission: Mission | null | undefined) =>
  isToolActivityEmbed(mission?.embed_code);

const isScreensActivityMission = (mission: Mission | null | undefined) =>
  isScreensActivityEmbed(mission?.embed_code);

const isFullscreenMission = (mission: Mission | null | undefined, sectorName?: string | null) =>
  isArduinoMissionByMetadata(mission) ||
  isElectricityPreFlowMission(mission, sectorName) ||
  isToolActivityMission(mission) ||
  isScreensActivityMission(mission);

function sectorNameForMission(
  mission: Mission | null | undefined,
  sectors: Sector[],
  selectedSector: Sector | null,
): string | null {
  if (!mission) return selectedSector?.name ?? null;
  if (selectedSector && selectedSector.id === mission.sector_id) return selectedSector.name;
  return sectors.find((s) => s.id === mission.sector_id)?.name ?? null;
}

interface School {
  id: string;
  name: string;
  city?: string | null;
  country?: string;
  tier?: string;
  subscription_status?: string;
  subscription_expires_at?: string | null;
  max_teachers?: number;
  max_students?: number;
  activation_code?: string | null;
  teacher_count?: number;
  student_count?: number;
}

interface Class {
  id: string;
  name: string;
  teacher_id: string;
  teacher_name?: string;
  description: string;
  student_count?: number;
  join_code?: string;
  curriculum_track?: string | null;
  school_id?: string | null;
}

interface AdminQuizRow {
  id: string;
  title: string;
  created_at?: string;
}

interface AdminChallengeRow {
  id: string;
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
  id: string;
  title: string;
  created_at?: string;
  latest_score?: number | null;
  latest_total_questions?: number | null;
  latest_completed_at?: string | null;
}

interface AssignedMissionRow {
  id: string;
  sector_id: string;
  title: string;
  description?: string;
  difficulty?: string;
  xp_reward?: number;
  latest_completed_at?: string | null;
}

interface QuizReviewItem {
  id: string;
  student_quiz_id: string;
  student_id: string;
  student_name: string;
  quiz_id: string;
  quiz_title: string;
  question_index: number;
  prompt: string;
  response_text: string;
  max_score: number;
  created_at: string;
}

interface Student {
  id: string;
  name: string;
  level: number;
  xp: number;
  avatar_url: string;
  role: string;
  age?: number;
  grade?: string;
  school?: string;
  school_id?: string | null;
  school_record_name?: string | null;
  needs_school_activation?: boolean;
  needs_teacher_invite?: boolean;
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
  tutorial_completed?: boolean;
  onboarding_completed?: boolean;
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
  mission_id: string;
  title: string;
  difficulty?: string;
  sector?: string;
  reason: string;
}

interface SystemLog {
  id: string;
  timestamp: string;
  message: string;
  type: string;
  xp_change: number;
}

interface StudentBadgeRow {
  id: string;
  student_id: string;
  badge_name: string;
  badge_icon: string | null;
  earned_at: string;
}

interface StudentQuizAttemptRow {
  id?: string;
  quiz_id: string;
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
  { key: 'robotics', label: 'Robotics' },
  { key: 'ai_ml', label: 'AI & ML' },
  { key: 'space_tech', label: 'Space Tech' },
  { key: 'game_dev', label: 'Game Dev' },
  { key: 'web_dev', label: 'Web Dev' },
  { key: 'app_dev', label: 'App Dev' },
  { key: 'electronics', label: 'Electronics' },
  { key: '3d_printing', label: '3D Printing' },
  { key: 'biotech', label: 'Health Tech' },
  { key: 'fintech', label: 'FinTech' },
  { key: 'math_puzzles', label: 'Math Puzzles' },
  { key: 'science_experiments', label: 'Science Experiments' },
];
export type {
  Sector,
  Mission,
  School,
  Class,
  AdminQuizRow,
  AdminChallengeRow,
  StudentProgress,
  AssignedQuizRow,
  AssignedMissionRow,
  QuizReviewItem,
  Student,
  AdminMetricsPayload,
  MissionRecommendation,
  SystemLog,
  StudentBadgeRow,
  StudentQuizAttemptRow,
  StudentProgressPayload,
};
export {
  ARDUINO_BLOCKLY_EMBED,
  ELECTRICITY_PRE_FLOW_EMBED,
  isArduinoBlocklyEmbed,
  isElectricityPreFlowEmbed,
  electricityActivityUrl,
  isArduinoMissionByMetadata,
  isElectricityPreFlowMission,
  isToolActivityMission,
  isFullscreenMission,
  sectorNameForMission,
  STUDENT_INTEREST_OPTIONS,
};
