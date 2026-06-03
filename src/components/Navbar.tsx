/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Rocket, Activity, Award, Settings, Bell } from 'lucide-react';
import type { Student } from '../app/types';
type NotificationItem = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  is_read: number;
  created_at: string;
};

const Navbar = ({
  pathname,
  student,
  onOpenSettings,
  notifications = [],
  onMarkRead,
  onMarkAllRead,
  onOpenLink,
}: {
  pathname: string;
  student: Student | null;
  onOpenSettings?: () => void;
  notifications?: NotificationItem[];
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  onOpenLink?: (link: string | null | undefined) => void;
}) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.is_read).length;
  const profilePath = student?.role === 'student' ? '/console/profile' : '/teacher/profile';
  const isGalaxy = pathname.startsWith('/galaxy');
  const isConsole = pathname.startsWith('/console') || pathname.startsWith('/teacher');
  return (
  <header className="fixed top-0 left-0 right-0 z-[130] cosmic-header-bar">
    <div className="cosmic-inverse max-w-[var(--ca-container-max)] mx-auto px-[var(--ca-gutter)] h-[var(--ca-header-height)] flex items-center justify-between gap-8 relative">
      <div
        className={`absolute left-[var(--ca-gutter)] top-0 h-full w-0.5 rounded-full transition-colors ${
          isConsole || isGalaxy ? 'bg-[var(--ca-secondary-container)]' : 'bg-[var(--ca-on-primary-container)]'
        }`}
        aria-hidden
      />

      <div className="flex items-center gap-6 pl-2">
        <div className="relative group cursor-pointer" onClick={() => navigate(profilePath)}>
            <div className={`absolute -inset-2 rounded-full blur-md opacity-25 group-hover:opacity-45 transition duration-300 ${pathname === profilePath ? 'bg-[var(--ca-secondary-container)]' : 'bg-[var(--ca-on-primary-container)]'}`} />
            <div className="relative size-14 p-1 rounded-full border-2 border-[rgba(118,132,159,0.5)] bg-[rgba(13,28,50,0.5)] overflow-hidden">
              <img 
                className="size-full rounded-full object-cover" 
                src={student?.avatar_url || "https://picsum.photos/seed/avatar/100/100"} 
                alt="Avatar"
                referrerPolicy="no-referrer"
              />
            </div>
        </div>
        <div className="hidden sm:block cursor-pointer" onClick={() => navigate('/galaxy')}>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <Rocket className="size-7 cosmic-brand-accent shrink-0" aria-hidden />
            <span className="cosmic-brand-wordmark">STEM</span>
            <span className="cosmic-brand-accent">VERSE</span>
          </h1>
          <p className="cosmic-page-sub text-[8px] -mt-1 ml-9 opacity-90">Earth Recovery Mission</p>
        </div>
      </div>

      {student?.role === 'student' && (
        <>
          <div className="flex sm:hidden flex-col items-center min-w-[4.5rem] shrink-0">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--ca-on-surface-variant)]">XP</span>
            <span className="text-amber-400 font-mono font-bold text-sm tabular-nums leading-none">
              {(student?.xp || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex-1 max-w-xl hidden md:flex flex-col gap-1.5">
            <div className="flex justify-between items-end text-[10px]">
              <span className="flex items-center gap-1 text-[var(--ca-on-primary-container)] font-black uppercase tracking-[0.12em]">
                <Activity className="size-3 text-[var(--ca-secondary-container)]" /> Progress
              </span>
              <span className="text-[var(--ca-secondary-container)] font-mono font-bold tracking-wide">
                {(student?.xp || 0).toLocaleString()} / 1000 XP
              </span>
            </div>
            <div className="h-2 w-full rounded-full overflow-hidden border border-[rgba(118,132,159,0.4)] bg-[rgba(13,28,50,0.55)] p-0.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((student?.xp || 0) % 1000) / 10}%` }}
                className="h-full rounded-full bg-gradient-to-r from-[var(--ca-secondary-container)] to-[var(--ca-tertiary-container)]"
              />
            </div>
          </div>
        </>
      )}

      <div className="flex items-center gap-3 lg:gap-6">
        {student?.role === 'student' && (
          <div className="flex items-center gap-3 px-4 py-2 rounded-[var(--ca-radius-md)] border border-[rgba(118,132,159,0.35)] bg-[rgba(13,28,50,0.45)]">
            <div className="flex flex-col items-end">
              <span className="cosmic-page-sub text-[9px] opacity-90">Level</span>
              <span className="text-cyan-400 font-bold text-base leading-none">LVL {student?.level || 1}</span>
            </div>
            <div className="size-10 rounded-[var(--ca-radius)] border border-[rgba(255,178,4,0.35)] bg-[rgba(255,178,4,0.12)] text-cyan-400 flex items-center justify-center">
              <Award className="size-5" />
            </div>
          </div>
        )}
        <button
          onClick={() => onOpenSettings?.()}
          className="p-3 rounded-[var(--ca-radius)] border border-[rgba(118,132,159,0.35)] bg-[rgba(13,28,50,0.35)] transition-all text-slate-400 hover:text-cyan-400 hover:border-[rgba(255,178,4,0.45)]"
          title="Settings"
        >
          <Settings className="size-5" />
        </button>

        {student?.role === 'student' && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="p-3 rounded-[var(--ca-radius)] border border-[rgba(118,132,159,0.35)] bg-[rgba(13,28,50,0.35)] transition-all text-slate-400 hover:text-cyan-400 hover:border-[rgba(255,178,4,0.45)] relative"
              title="Notifications"
            >
              <Bell className="size-5" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 size-3 rounded-full bg-[var(--ca-error)] border-2 border-[var(--ca-primary-container)]" />
              )}
            </button>

            {open && (
              <div className="cosmic-inverse absolute right-0 mt-3 w-[360px] max-w-[90vw] z-50 rounded-[var(--ca-radius-lg)] border border-[rgba(118,132,159,0.4)] bg-[rgba(13,28,50,0.92)] backdrop-blur-xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(118,132,159,0.35)]">
                  <p className="cosmic-page-sub text-[10px]">Notifications</p>
                  <button
                    type="button"
                    onClick={() => onMarkAllRead?.()}
                    className="cosmic-page-sub text-[10px] text-cyan-400 hover:opacity-90"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-slate-400 text-sm">No notifications yet.</div>
                  ) : (
                    notifications.slice(0, 30).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          onMarkRead?.(n.id);
                          if (n.link) onOpenLink?.(n.link);
                          setOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 border-b border-[rgba(118,132,159,0.25)] hover:bg-[rgba(255,255,255,0.06)] transition-all ${
                          n.is_read ? 'opacity-80' : 'bg-[rgba(255,178,4,0.06)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-100 truncate">{n.title}</p>
                            <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-slate-500 mt-1 font-mono">{new Date(n.created_at).toLocaleString()}</p>
                          </div>
                          {!n.is_read && <span className="mt-1 size-2 rounded-full bg-[var(--ca-secondary-container)] shrink-0" />}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  </header>
  );
};
export default Navbar;
export type { NotificationItem };
