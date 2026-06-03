/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Fragment, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Map as MapIcon,
  Users,
  Award,
  LayoutGrid,
  LayoutDashboard,
  Shield,
  Layers,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authFetch } from '../app/api';
import type { AppState } from '../app/useAppState';

type NavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
  tutorialId?: string;
};

function NavTab({
  active,
  onClick,
  label,
  icon: Icon,
  tutorialId,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tutorialId?: string;
}) {
  return (
    <button
      type="button"
      data-stemverse-tutorial={tutorialId}
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 group transition-colors min-w-[3.15rem] ${
        active ? 'cosmic-nav-active' : 'text-slate-400 opacity-80 hover:opacity-100'
      }`}
    >
      {active && (
        <motion.span
          layoutId="nav-indicator"
          className="absolute -inset-x-2 -inset-y-1 rounded-xl bg-[var(--ca-secondary-container)]/20 -z-10"
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        />
      )}
      <Icon className={`size-6 group-hover:scale-110 transition-transform ${active ? 'text-[var(--ca-secondary-container)]' : 'text-slate-400'}`} />
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

export default function AppBottomNav(app: AppState) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { student, isLoggedIn, setIsLoggedIn, setStudent, isImmersivePlay } = app;

  const [expanded, setExpanded] = useState(true);

  if (!isLoggedIn || isImmersivePlay) return null;

  const isSchoolAdmin = student?.role === 'school_admin';
  const isTeacher = student?.role === 'teacher' || student?.role === 'admin';
  const isParent = student?.role === 'parent';
  const consolePath = isTeacher ? '/teacher' : '/console';

  const items: NavItem[] = isSchoolAdmin
    ? [
        {
          id: 'school',
          label: 'School',
          icon: LayoutDashboard,
          active: pathname.startsWith('/school'),
          onClick: () => navigate('/school'),
        },
      ]
    : isParent
    ? [
        { id: 'home', label: 'Family', icon: LayoutDashboard, active: pathname === '/parent', onClick: () => navigate('/parent') },
      ]
    : [
        {
          id: 'dashboard',
          label: isTeacher ? 'Dashboard' : 'Command',
          icon: LayoutDashboard,
          active: pathname === consolePath || pathname.startsWith('/teacher/'),
          onClick: () => navigate(consolePath),
          tutorialId: isTeacher ? undefined : 'nav-console',
        },
        { id: 'galaxy', label: 'Galaxy', icon: MapIcon, active: pathname.startsWith('/galaxy'), onClick: () => navigate('/galaxy') },
        ...(isTeacher
          ? [{ id: 'challenges', label: 'Challenges', icon: Layers, active: pathname === '/teacher/challenges', onClick: () => navigate('/teacher/challenges') }]
          : [
              { id: 'squad', label: 'Squad', icon: Users, active: pathname === '/console/squad', onClick: () => navigate('/console/squad') },
              { id: 'awards', label: 'Awards', icon: Award, active: pathname === '/console/awards', onClick: () => navigate('/console/awards') },
            ]),
      ];

  if (student?.role === 'admin' && !isParent && !items.some((i) => i.id === 'admin')) {
    items.push({
      id: 'admin',
      label: 'Admin',
      icon: Shield,
      active: pathname === '/admin',
      onClick: () => navigate('/admin'),
    });
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
      <AnimatePresence mode="wait">
        {expanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="cosmic-inverse cosmic-bottom-nav rounded-[var(--ca-radius-lg)] px-6 py-3 flex items-center gap-6"
          >
            {items.map((item) => (
              <Fragment key={item.id}>
                <NavTab
                  active={item.active}
                  onClick={item.onClick}
                  label={item.label}
                  icon={item.icon}
                  tutorialId={item.tutorialId}
                />
              </Fragment>
            ))}
            <button
              onClick={async () => {
                await authFetch('/api/logout', { method: 'POST' });
                localStorage.removeItem('stemverse_access_token');
                setIsLoggedIn(false);
                setStudent(null);
                navigate('/login');
              }}
              className="flex flex-col items-center gap-1 group transition-all text-red-500/60 hover:text-red-500"
            >
              <Lock className="size-6 group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-black uppercase tracking-widest">Logout</span>
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="size-10 rounded-xl border border-slate-600/50 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 flex items-center justify-center transition-colors"
              aria-label="Collapse navigation"
            >
              <ChevronDown className="size-5" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            type="button"
            onClick={() => setExpanded(true)}
            className="cosmic-inverse cosmic-bottom-nav px-4 py-2.5 rounded-2xl flex items-center gap-2 border border-cyan-500/25"
            aria-label="Expand navigation"
          >
            <LayoutGrid className="size-5 text-cyan-300" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">Navigation</span>
            <ChevronUp className="size-4 text-cyan-300" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
