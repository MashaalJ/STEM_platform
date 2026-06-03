/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import FuturisticBackground from './components/FuturisticBackground';
import AddToHomeScreenPrompt from './components/AddToHomeScreenPrompt';
import Navbar from './components/Navbar';
import ParentNavbar from './components/ParentNavbar';
import SettingsModal from './components/SettingsModal';
import AppRoutes from './components/AppRoutes';
import MissionCompleteCelebration from './components/MissionCompleteCelebration';
import QuizPromptModal from './components/QuizPromptModal';
import AppBottomNav from './components/AppBottomNav';
import { StudentOnboardingModal } from './components/StudentOnboardingModal';
import StudentFirstLoginTutorial from './components/StudentFirstLoginTutorial';
import SchoolActivationModal from './components/SchoolActivationModal';
import { BrowserRouter } from 'react-router-dom';
import { useAppState } from './app/useAppState';
import { AppProvider } from './context/AppContext';

function AppShell() {
  const app = useAppState();
  const isParent = app.student?.role === 'parent';

  return (
    <AppProvider value={app}>
      <div
        className={`min-h-screen font-sans relative overflow-x-hidden ${
          isParent
            ? 'text-slate-100 bg-gradient-to-b from-[#120a14] via-[#0a1628] to-[#081018]'
            : 'text-[var(--ca-on-background)] bg-[var(--ca-background)]'
        }`}
      >
        <FuturisticBackground withParticles={false} />

        {app.isLoggedIn && !app.isImmersiveSection && isParent && (
          <ParentNavbar
            student={app.student}
            onLogout={() => {
              localStorage.removeItem('stemverse_access_token');
              app.setIsLoggedIn(false);
              app.setStudent(null);
            }}
          />
        )}

        {app.isLoggedIn && !app.isImmersiveSection && !isParent && (
          <Navbar
            pathname={app.pathname}
            student={app.student}
            onOpenSettings={() => app.setSettingsOpen(true)}
            notifications={app.notifications}
            onMarkRead={app.markNotificationRead}
            onMarkAllRead={app.markAllNotificationsRead}
            onOpenLink={app.openNotificationLink}
          />
        )}

        {app.settingsOpen && app.student && !isParent && (
          <SettingsModal
            student={app.student}
            setStudent={app.setStudent}
            onClose={() => app.setSettingsOpen(false)}
          />
        )}

        <AppRoutes />

        {app.isLoggedIn && (
          <>
            {app.student?.role === 'student' && (
              <>
                <StudentOnboardingModal
                  student={app.student}
                  open={app.interestModalOpen}
                  onComplete={app.completeStudentOnboarding}
                  onDismiss={app.dismissStudentOnboarding}
                />
                <StudentFirstLoginTutorial
                  open={app.tutorialOpen && !app.interestModalOpen}
                  onSkip={app.markTutorialComplete}
                  onFinish={app.markTutorialComplete}
                />
              </>
            )}
            {app.student &&
              (app.student.needs_school_activation ||
                app.student.needs_teacher_invite ||
                (app.student.role === 'school_admin' && !app.student.school_id) ||
                (app.student.role === 'teacher' && !app.student.school_id)) && (
              <SchoolActivationModal
                student={app.student}
                onLinked={(user) => {
                  app.setStudent(user);
                  if (user.role === 'school_admin') window.location.href = '/school';
                  else if (user.role === 'teacher') window.location.href = '/teacher';
                }}
              />
            )}
            {app.student?.role !== 'parent' && (
              <>
                <MissionCompleteCelebration {...app} />
                <QuizPromptModal {...app} />
              </>
            )}
            <AppBottomNav {...app} />
          </>
        )}

        <AddToHomeScreenPrompt />
      </div>
    </AppProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
