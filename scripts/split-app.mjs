import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const appPath = path.join(root, 'src/App.tsx');
const lines = fs.readFileSync(appPath, 'utf8').split('\n');

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

function writeFile(rel, header, body, footer = '') {
  const full = `${header}\n${body}\n${footer}`.trimEnd() + '\n';
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, full);
}

const license = `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */`;

// --- Shared ---
writeFile(
  'src/app/api.ts',
  `${license}

import { supabase } from '../../lib/supabaseClient';`,
  slice(79, 118),
  `export { fetchWithOptionalBearerRetry, safeFetch, fetchWithAuth, authFetch };`
);

writeFile(
  'src/app/types.ts',
  `${license}

import { isToolActivityEmbed } from '../lib/toolActivity';`,
  slice(120, 400),
  `export type {
  Sector,
  Mission,
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
};`
);

// Fix types.ts - interfaces can't be exported with export type { } if they're interface - need export on each or export { type X }
// Actually the slice already has `interface X` - we need to add export keyword or use export { type ... }
// TypeScript allows `export type { Sector }` for interfaces in same file if they're exported. Let me add export to interfaces in the written file instead.
// Simpler: append exports at end without re-exporting types - the slice has non-exported interfaces. Add export prefix via regex in script... 
// Actually user wants exact copy - interfaces without export. So export them at bottom:
// `export type { Sector, Mission, ... }` works in TS for interfaces declared in same module.

writeFile(
  'src/components/Navbar.tsx',
  `${license}

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Rocket, Activity, Award, Settings, Bell } from 'lucide-react';
import type { Student } from '../app/types';`,
  slice(1003, 1170),
  `export default Navbar;
export type { NotificationItem };`
);

writeFile(
  'src/components/SettingsModal.tsx',
  `${license}

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, User, KeyRound } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { authFetch } from '../app/api';
import type { Student } from '../app/types';`,
  slice(6539, 6844),
  `export default SettingsModal;`
);

// Auth
const authBody = `${slice(402, 999)}

export function StudentInterestModal({
  student,
  interestModalOpen,
  interestSelections,
  interestError,
  savingInterests,
  toggleInterest,
  saveStudentInterests,
}: {
  student: Student | null;
  interestModalOpen: boolean;
  interestSelections: string[];
  interestError: string | null;
  savingInterests: boolean;
  toggleInterest: (key: string) => void;
  saveStudentInterests: () => void;
}) {
  if (student?.role !== 'student' || !interestModalOpen) return null;
  return (
${slice(7709, 7751)}
  );
}

export default function Auth({ onLogin }: { onLogin: (user: any) => void }) {
  return (
    <>
      <Login onLogin={onLogin} />
      <AddToHomeScreenPrompt />
    </>
  );
}

export { STUDENT_INTEREST_OPTIONS } from '../app/types';`;

writeFile(
  'src/views/Auth.tsx',
  `${license}

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Rocket } from 'lucide-react';
import FuturisticBackground from '../components/FuturisticBackground';
import AddToHomeScreenPrompt from '../components/AddToHomeScreenPrompt';
import { supabase } from '../../lib/supabaseClient';
import { authFetch, safeFetch } from '../app/api';
import { STORY, STORY_LOGIN } from '../lib/story';
import { STUDENT_INTEREST_OPTIONS } from '../app/types';
import type { Student } from '../app/types';`,
  authBody
);

writeFile(
  'src/views/ParentDashboard.tsx',
  `${license}

export default function ParentDashboard() { return <div>Parent Dashboard — Coming Soon</div>; }`,
  ''
);

writeFile(
  'src/views/TeacherHub.tsx',
  `${license}

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Rocket, Users, School, Activity, Award, Plus, BarChart3, PieChart, ClipboardList, Zap, X, ChevronDown, Copy, Sparkles, Download, LogIn, Layers, LayoutGrid, AlertTriangle, KeyRound, ShieldCheck, Share2, Printer, CheckCircle2, TrendingUp, ChevronRight, Terminal, LayoutDashboard, Database, Shield, ArrowLeft, Play, Search, Bell, Flame, Lock, User, Settings, Map as MapIcon, Trophy, ChevronLeft,
} from 'lucide-react';
import MissionScreenBuilder from '../components/tool-activity/MissionScreenBuilder';
import {
  buildMissionFromScreens,
  defaultBuilderState,
  hasValidationErrors,
  isToolActivityEmbed,
  parseToolActivityEmbed,
  validateToolActivityConfig,
  type ToolActivityConfig,
  type ToolBuilderValidation,
} from '../lib/toolActivity';
import { safeFetch, fetchWithAuth } from '../app/api';
import type { Sector, Mission, Class, Student, QuizReviewItem } from '../app/types';`,
  `${slice(3213, 3723)}

${slice(3724, 4500)}

${slice(4826, 5119)}

${slice(5358, 5850)}

export default TeacherHub;
export { MissionSetup };`
);

writeFile(
  'src/views/AdminDashboard.tsx',
  `${license}

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Rocket, Users, School, Activity, Award, Plus, BarChart3, PieChart, ClipboardList, Zap, X, ChevronDown, Copy, Sparkles, Download, LogIn, Layers, LayoutGrid, AlertTriangle, KeyRound, ShieldCheck, Share2, Printer, CheckCircle2, TrendingUp, ChevronRight, Terminal, LayoutDashboard, Database, Shield, ArrowLeft, Play, Search, Bell, Flame, Lock, User, Settings, Map as MapIcon, Trophy, ChevronLeft,
} from 'lucide-react';
import { safeFetch, fetchWithAuth } from '../app/api';
import type { Student, AdminMetricsPayload, AdminQuizRow, AdminChallengeRow, SystemLog } from '../app/types';`,
  `${slice(2077, 2262)}

${slice(2263, 3212)}

export default AdminDashboard;`
);

writeFile(
  'src/views/MissionPlayer.tsx',
  `${license}

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Terminal, X } from 'lucide-react';
import ArduinoCodingMission from '../components/arduino-ide/ArduinoCodingMission';
import {
  isToolActivityEmbed,
  parseToolActivityEmbed,
  toolActivityPlayerUrl,
} from '../lib/toolActivity';
import {
  isArduinoMissionByMetadata,
  isElectricityPreFlowMission,
  isElectricityPreFlowEmbed,
  electricityActivityUrl,
} from '../app/types';
import type { Mission } from '../app/types';`,
  `${slice(5120, 5357)}

${slice(6435, 6535)}

export {
  toEmbeddableUrl,
  extractEmbedSrc,
  isBrokenHomepageEmbed,
  ToolActivityPlayer,
  ElectricityPreFlowPlayer,
  GamePlayer,
  MissionSimulation,
};`
);

writeFile(
  'src/views/GalaxyMap.tsx',
  `${license}

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Rocket, Map as MapIcon, Lock, CheckCircle2, TrendingUp, ChevronRight, ArrowLeft, Play, Sparkles, AlertTriangle, Activity,
} from 'lucide-react';
import { safeFetch } from '../app/api';
import { STORY_GALAXY, galaxySystemAlert, lockedSectorTitle } from '../lib/story';
import type { Sector, Mission, Student } from '../app/types';`,
  `${slice(1172, 1557)}

${slice(1558, 1704)}

${slice(1705, 2076)}

export { GalaxyMap, CoreCurriculumHub, RocketChatPanel, JourneyMap, SectorView };`
);

const studentCommandConsole = slice(7286, 7540);

writeFile(
  'src/views/StudentConsole.tsx',
  `${license}

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Rocket, School, Activity, Settings, LogIn, Sparkles, ClipboardList, Award, Users, Trophy, Flame, ChevronRight, X, Map as MapIcon,
} from 'lucide-react';
import { safeFetch, fetchWithAuth } from '../app/api';
import type {
  Student,
  StudentProgress,
  Class,
  AssignedMissionRow,
  AssignedQuizRow,
  StudentQuizAttemptRow,
  MissionRecommendation,
  Sector,
} from '../app/types';`,
  `${slice(4501, 4825)}

${slice(5851, 6433)}

export function StudentCommandConsole({
  student,
  missionRecommendations,
  assignedMissions,
  assignedChallenges,
  assignedQuizzes,
  studentQuizHistory,
  recentlyCompletedChallengeIds,
  sectors,
  setSelectedSector,
  setActiveView,
  setGeneratedQuizId,
  setGeneratedQuizTitle,
  setActiveChallengeId,
  challengeAccent,
}: {
  student: Student;
  missionRecommendations: MissionRecommendation[];
  assignedMissions: AssignedMissionRow[];
  assignedChallenges: {
    id: number;
    title: string;
    type: string;
    xp_reward: number;
    latest_score?: number | null;
    latest_correct?: number | null;
    latest_attempted_at?: string | null;
  }[];
  assignedQuizzes: AssignedQuizRow[];
  studentQuizHistory: StudentQuizAttemptRow[];
  recentlyCompletedChallengeIds: number[];
  sectors: Sector[];
  setSelectedSector: (s: Sector | null) => void;
  setActiveView: (v: string) => void;
  setGeneratedQuizId: (id: number | null) => void;
  setGeneratedQuizTitle: (title: string) => void;
  setActiveChallengeId: (id: number | null) => void;
  challengeAccent: (kind: string) => { ring: string; glow: string; badge: string; symbol: string };
}) {
  return (
${studentCommandConsole}
  );
}

export { STUDENT_SKIPPED_JOIN_KEY, StudentDashboard, SquadLeaderboard, AwardsView };`
);

const appShell = `${license}

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Rocket,
  Map as MapIcon,
  Trophy,
  Users,
  Award,
  Lock,
  LayoutDashboard,
  Shield,
  ArrowLeft,
  Layers,
  Settings,
} from 'lucide-react';
import { ChallengeBuilder, ChallengeRenderer } from './challenges';
import { QuizPlayer } from './challenges/QuizPlayer';
import FuturisticBackground from './components/FuturisticBackground';
import AddToHomeScreenPrompt from './components/AddToHomeScreenPrompt';
import Navbar from './components/Navbar';
import SettingsModal from './components/SettingsModal';
import Auth, { StudentInterestModal } from './views/Auth';
import TeacherHub, { MissionSetup } from './views/TeacherHub';
import AdminDashboard from './views/AdminDashboard';
import {
  GamePlayer,
  MissionSimulation,
} from './views/MissionPlayer';
import {
  GalaxyMap,
  CoreCurriculumHub,
  RocketChatPanel,
  SectorView,
} from './views/GalaxyMap';
import {
  StudentDashboard,
  SquadLeaderboard,
  AwardsView,
  StudentCommandConsole,
} from './views/StudentConsole';
import { safeFetch, fetchWithAuth, authFetch } from './app/api';
import {
  isFullscreenMission,
  isElectricityPreFlowMission,
  sectorNameForMission,
} from './app/types';
import type {
  Sector,
  Mission,
  Student,
  AssignedMissionRow,
  AssignedQuizRow,
  StudentQuizAttemptRow,
  MissionRecommendation,
} from './app/types';
import type { NotificationItem } from './components/Navbar';

${slice(6848, 7164)}

  if (!isLoggedIn) {
    return <Auth onLogin={handleLogin} />;
  }

${slice(7174, 7285)}
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
                setActiveView={setActiveView}
                setGeneratedQuizId={setGeneratedQuizId}
                setGeneratedQuizTitle={setGeneratedQuizTitle}
                setActiveChallengeId={setActiveChallengeId}
                challengeAccent={challengeAccent}
              />
              </>
              )}
              </>
              )}
            </motion.div>
          )}
${slice(7546, 7706)}

      <StudentInterestModal
        student={student}
        interestModalOpen={interestModalOpen}
        interestSelections={interestSelections}
        interestError={interestError}
        savingInterests={savingInterests}
        toggleInterest={toggleInterest}
        saveStudentInterests={saveStudentInterests}
      />

${slice(7754, 7915)}`;

fs.writeFileSync(appPath, appShell);
console.log('App.tsx line count:', appShell.split('\\n').length);
