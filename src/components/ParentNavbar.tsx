/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, LogOut } from 'lucide-react';
import type { Student } from '../app/types';
import { authFetch } from '../app/api';

export default function ParentNavbar({
  student,
  onLogout,
}: {
  student: Student | null;
  onLogout: () => void;
}) {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-rose-400/20 bg-gradient-to-r from-[#1a0f1c]/95 via-[#0f1a28]/95 to-[#0d1c32]/95 backdrop-blur-md">
      <div className="max-w-[var(--ca-container-max)] mx-auto px-[var(--ca-gutter)] h-[var(--ca-header-height)] flex items-center justify-between gap-6">
        <button
          type="button"
          onClick={() => navigate('/parent')}
          className="flex items-center gap-3 text-left group"
        >
          <div className="size-12 rounded-[var(--ca-radius-md)] bg-rose-500/15 border border-rose-400/35 flex items-center justify-center shrink-0 group-hover:border-rose-300/50 transition-colors">
            <Heart className="size-6 text-rose-300" aria-hidden />
          </div>
          <div>
            <p className="text-lg font-bold text-white tracking-tight">STEMverse Family</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-rose-200/80 font-semibold">
              Parent dashboard
            </p>
          </div>
        </button>

        <div className="flex items-center gap-4 min-w-0">
          <div className="hidden sm:block text-right min-w-0">
            <p className="text-sm font-semibold text-white truncate">{student?.name || 'Parent'}</p>
            <p className="text-[10px] text-rose-200/70 uppercase tracking-wider">Read-only view</p>
          </div>
          <div className="size-11 rounded-full border-2 border-rose-400/30 overflow-hidden bg-slate-800 shrink-0">
            <img
              src={student?.avatar_url || 'https://picsum.photos/seed/parent/100/100'}
              alt=""
              className="size-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <button
            type="button"
            onClick={async () => {
              await authFetch('/api/logout', { method: 'POST' });
              onLogout();
              navigate('/login');
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-400/25 text-rose-200/90 hover:bg-rose-500/10 text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
