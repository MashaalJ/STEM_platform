/**
 * Challenge Studio - STEMverse Builder layout from mockups.
 * Header, left sequence sidebar, center (Editor / Preview / Dataset), right feedback panel.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Rocket,
  Edit3,
  Eye,
  Database,
  Settings,
  PlusCircle,
  GripVertical,
  HelpCircle,
  PlayCircle,
  Puzzle,
  LayoutGrid,
  Type,
  MousePointer2,
  GitBranch,
  Crosshair,
  Layers,
  ListChecks,
  MessageSquare,
  ArrowUpDown,
} from 'lucide-react';
import type { ChallengeType, ChallengeContent, ChallengeRecord } from './types';
import { getAllChallengeTypes, getChallengeType, getDefaultContent } from './registry';
import { getContentTypeCatalog } from './catalog';
import { PreviewPanel } from './components/PreviewPanel';

const safeFetch = async (url: string, options?: RequestInit) => {
  try {
    const res = await fetch(url, { ...options, credentials: options?.credentials ?? 'include' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ListChecks,
  Layers,
  Type,
  GripVertical,
  GitBranch,
  MessageSquare,
  MousePointer2,
  Crosshair,
  ArrowUpDown,
  Puzzle,
  LayoutGrid,
};

export function ChallengeBuilder() {
  const [challenges, setChallenges] = useState<ChallengeRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [challengeType, setChallengeType] = useState<ChallengeType>('multiple_choice');
  const [content, setContent] = useState<ChallengeContent>(() => getDefaultContent('multiple_choice')!);
  const [world, setWorld] = useState('');
  const [zone, setZone] = useState('');
  const [xpReward, setXpReward] = useState(100);
  const [xpBonusFirstTry, setXpBonusFirstTry] = useState(0);
  const [xpRetryPenalty, setXpRetryPenalty] = useState(0);
  const [newChallengeTypeChosen, setNewChallengeTypeChosen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [assignedTo, setAssignedTo] = useState<{ id: number; name: string; assigned_at: string }[]>([]);
  const [assignClassId, setAssignClassId] = useState<number | ''>('');
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);
  const [centerTab, setCenterTab] = useState<'editor' | 'preview' | 'dataset'>('editor');
  const [timeLimitSec, setTimeLimitSec] = useState<number>(45);

  const catalog = getContentTypeCatalog();
  const plugin = getChallengeType(challengeType);
  const Editor = plugin?.Editor;
  const Player = plugin?.Player;
  const showEditorArea = selectedId !== null || newChallengeTypeChosen;

  const loadChallenges = () => {
    safeFetch('/api/challenges').then((data) => data && setChallenges(Array.isArray(data) ? data : []));
  };

  useEffect(() => {
    loadChallenges();
    safeFetch('/api/classes').then((data) => {
      if (Array.isArray(data)) setClasses(data.map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })));
    });
  }, []);

  useEffect(() => {
    if (selectedId) {
      const c = challenges.find((x) => x.id === selectedId);
      if (c) {
        setTitle(c.title);
        setChallengeType(c.type as ChallengeType);
        try {
          setContent(JSON.parse(c.content_json || '{}'));
        } catch {
          setContent(getDefaultContent(c.type as ChallengeType) || {});
        }
        setWorld(c.world || '');
        setZone(c.zone || '');
        setXpReward(c.xp_reward ?? 100);
        setXpBonusFirstTry(c.xp_bonus_first_try ?? 0);
        setXpRetryPenalty(c.xp_retry_penalty ?? 0);
      }
    } else {
      setTitle('');
      setChallengeType('multiple_choice');
      setContent(getDefaultContent('multiple_choice')!);
      setWorld('');
      setZone('');
      setXpReward(100);
      setXpBonusFirstTry(0);
      setXpRetryPenalty(0);
    }
    setAssignMsg(null);
    setAssignClassId('');
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setAssignedTo([]);
      return;
    }
    safeFetch(`/api/challenges/${selectedId}/assigned-classes`).then((data) => {
      setAssignedTo(Array.isArray(data) ? data : []);
    });
  }, [selectedId]);

  const onTypeChange = (t: ChallengeType) => {
    setChallengeType(t);
    setContent(getDefaultContent(t) || {});
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        type: challengeType,
        world: world.trim() || undefined,
        zone: zone.trim() || undefined,
        xp_reward: xpReward,
        xp_bonus_first_try: xpBonusFirstTry,
        xp_retry_penalty: xpRetryPenalty,
        content_json: JSON.stringify(content),
      };
      const url = selectedId ? `/api/challenges/${selectedId}` : '/api/challenges';
      const method = selectedId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || data.message || 'Failed to save');
        return;
      }
      loadChallenges();
      if (data.id) setSelectedId(data.id);
      setError(null);
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedId) {
      setAssignMsg('Save the challenge first.');
      return;
    }
    const cid = Number(assignClassId);
    if (!Number.isInteger(cid) || cid < 1) {
      setAssignMsg('Pick a class to assign to.');
      return;
    }
    setAssignMsg(null);
    setAssigning(true);
    try {
      const res = await fetch(`/api/classes/${cid}/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ challenge_id: selectedId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAssignMsg(data.error || data.message || `Assign failed (${res.status})`);
        return;
      }
      setAssignMsg('Assigned.');
      const refreshed = await safeFetch(`/api/challenges/${selectedId}/assigned-classes`);
      setAssignedTo(Array.isArray(refreshed) ? refreshed : []);
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (classId: number) => {
    if (!selectedId) return;
    setAssignMsg(null);
    setAssigning(true);
    try {
      await fetch(`/api/classes/${classId}/challenges/${selectedId}`, { method: 'DELETE', credentials: 'include' });
      const refreshed = await safeFetch(`/api/challenges/${selectedId}/assigned-classes`);
      setAssignedTo(Array.isArray(refreshed) ? refreshed : []);
      setAssignMsg('Unassigned.');
    } finally {
      setAssigning(false);
    }
  };

  const handleClone = (c: ChallengeRecord) => {
    setSelectedId(null);
    setNewChallengeTypeChosen(true);
    setTitle(`${c.title} (copy)`);
    setChallengeType(c.type as ChallengeType);
    try {
      setContent(JSON.parse(c.content_json || '{}'));
    } catch {
      setContent(getDefaultContent(c.type as ChallengeType) || {});
    }
    setWorld(c.world || '');
    setZone(c.zone || '');
    setXpReward(c.xp_reward ?? 100);
    setXpBonusFirstTry(c.xp_bonus_first_try ?? 0);
    setXpRetryPenalty(c.xp_retry_penalty ?? 0);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this challenge?')) return;
    const res = await fetch(`/api/challenges/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      loadChallenges();
      if (selectedId === id) setSelectedId(null);
    }
  };

  const startNew = () => {
    setSelectedId(null);
    setNewChallengeTypeChosen(true);
    setTitle('');
    setChallengeType('multiple_choice');
    setContent(getDefaultContent('multiple_choice')!);
    setXpReward(100);
    setXpBonusFirstTry(0);
    setXpRetryPenalty(0);
  };

  const displayTitle = title.trim() || 'Untitled Challenge';

  return (
    <div className="flex flex-col h-full min-h-[100vh] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top bar - mockup: STEMverse Builder, challenge title, nav, Save Draft, Deploy to Squad */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#2d3548] bg-slate-900/80 backdrop-blur-md z-50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[#256af4]">
            <Box className="w-8 h-8" />
            <h1 className="text-xl font-bold tracking-tight">
              STEMverse <span className="text-slate-400 font-medium">Builder</span>
            </h1>
          </div>
          <div className="h-6 w-px bg-[#2d3548] mx-2 hidden sm:block" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">Challenge Title</span>
            <span className="text-sm font-semibold truncate">{displayTitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <nav className="hidden md:flex items-center gap-6">
            <a className="text-sm font-medium text-slate-400 hover:text-[#256af4] transition-colors" href="#">Dashboard</a>
            <a className="text-sm font-medium text-slate-400 hover:text-[#256af4] transition-colors" href="#">Asset Vault</a>
            <a className="text-sm font-medium text-slate-400 hover:text-[#256af4] transition-colors" href="#">Analytics</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" className="p-2 rounded-lg bg-[#161b2a] border border-[#2d3548] text-slate-400 hover:text-white transition-all" title="Settings">
              <Settings className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#161b2a] border border-[#2d3548] text-sm font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-[#256af4] text-white text-sm font-bold shadow-[0_0_15px_rgba(37,106,244,0.3)] hover:brightness-110 transition-all flex items-center gap-2"
            >
              <Rocket className="w-4 h-4" />
              Publish
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#256af4] to-purple-600 border-2 border-[#2d3548] shrink-0" aria-hidden />
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Left: Sequence sidebar */}
        <aside className="w-72 border-r border-[#2d3548] bg-slate-900 flex flex-col shrink-0">
          <div className="p-4 border-b border-[#2d3548] flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Sequence</h3>
            <span className="text-xs bg-[#256af4]/20 text-[#256af4] px-2 py-0.5 rounded-full font-bold">
              {challenges.length} {challenges.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
            {challenges.map((c, idx) => {
              const isActive = selectedId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`p-3 rounded-xl border flex flex-col gap-2 cursor-pointer transition-all ${
                    isActive
                      ? 'border-2 border-[#256af4] bg-[#256af4]/10 shadow-[0_0_15px_rgba(37,106,244,0.3)]'
                      : 'border-[#2d3548] bg-[#161b2a]/40 hover:border-[#256af4]/50 opacity-90 hover:opacity-100'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`text-[10px] font-bold uppercase ${isActive ? 'text-[#256af4]' : 'text-slate-500'}`}>
                      {String(idx + 1).padStart(2, '0')} {c.type.toUpperCase().replace(/_/g, ' ')}
                    </span>
                    <GripVertical className={`w-3.5 h-3.5 ${isActive ? 'text-[#256af4]' : 'text-slate-500'}`} />
                  </div>
                  <div className="h-16 rounded-lg bg-slate-800 overflow-hidden relative border border-slate-700/50">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <PlayCircle className="w-6 h-6 text-[#256af4]" />
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-slate-200 truncate">{c.title}</p>
                  <div className="flex gap-1 justify-end">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleClone(c); }}
                      className="text-[10px] text-slate-400 hover:text-[#256af4] font-bold"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-bold"
                    >
                      Del
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-4 border-t border-[#2d3548]">
            <button
              type="button"
              onClick={startNew}
              className="w-full py-3 rounded-xl border-2 border-dashed border-[#2d3548] text-slate-500 hover:border-[#256af4] hover:text-[#256af4] transition-all flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-5 h-5" />
              <span className="text-sm font-bold">Insert Question</span>
            </button>
          </div>
        </aside>

        {/* Center: Editor / Preview / Dataset */}
        <section className="flex-1 bg-slate-950/50 p-6 overflow-y-auto custom-scrollbar flex flex-col">
          {!showEditorArea ? (
            <div className="max-w-2xl mx-auto py-16 text-center">
              <p className="text-slate-400 mb-4">Select a challenge from the sequence or insert a new question to start editing.</p>
              <button
                type="button"
                onClick={startNew}
                className="px-6 py-3 rounded-xl bg-[#256af4] text-white font-bold flex items-center gap-2 mx-auto"
              >
                <PlusCircle className="w-5 h-5" />
                Insert Question
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
              {/* Tabs: Editor | Preview | Dataset */}
              <div className="builder-glass rounded-2xl p-2 flex gap-1 self-center">
                <button
                  type="button"
                  onClick={() => setCenterTab('editor')}
                  className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                    centerTab === 'editor' ? 'bg-[#256af4] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  Editor
                </button>
                <button
                  type="button"
                  onClick={() => setCenterTab('preview')}
                  className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                    centerTab === 'preview' ? 'bg-[#256af4] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setCenterTab('dataset')}
                  className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                    centerTab === 'dataset' ? 'bg-[#256af4] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Database className="w-4 h-4" />
                  Dataset
                </button>
              </div>

              {centerTab === 'editor' && (
                <>
                  <div className="builder-glass rounded-3xl p-8 flex flex-col gap-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#256af4]/10 rounded-full blur-[100px]" aria-hidden />
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="px-3 py-1 rounded-full bg-[#256af4]/20 text-[#256af4] text-[10px] font-black tracking-widest uppercase">Level: Advanced</span>
                        <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-black tracking-widest uppercase">Module: {plugin?.meta.label ?? challengeType}</span>
                      </div>
                      <label className="block">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Title</span>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Challenge title"
                          className="mt-2 block w-full bg-slate-900/50 border border-[#2d3548] rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-[#256af4]/50 focus:border-[#256af4]"
                        />
                      </label>
                      <p className="text-slate-400 text-sm">{plugin?.meta.description}</p>
                    </div>

                    {Editor && (
                      <div className="pt-4 border-t border-[#2d3548]">
                        <Editor
                          content={content}
                          onChange={setContent}
                          {...(challengeType === 'multiple_choice'
                            ? {
                                xpReward,
                                onXpRewardChange: setXpReward,
                                timeLimitSec: timeLimitSec ?? 45,
                                onTimeLimitSecChange: setTimeLimitSec,
                              }
                            : {})}
                        />
                      </div>
                    )}

                    {/* Change Interaction Type - icon grid */}
                    <div className="mt-6 border-t border-[#2d3548] pt-8">
                      <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Change Interaction Type</h4>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                        {catalog.map((entry) => {
                          const Icon = ICON_MAP[entry.icon] ?? Puzzle;
                          const isSelected = entry.id === challengeType;
                          return (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => onTypeChange(entry.id)}
                              className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all group ${
                                isSelected
                                  ? 'bg-[#256af4]/10 border-[#256af4]'
                                  : 'bg-slate-900/50 border-[#2d3548] hover:border-[#256af4] hover:bg-[#256af4]/5'
                              }`}
                            >
                              <Icon className={`w-6 h-6 ${isSelected ? 'text-[#256af4]' : 'text-slate-400 group-hover:text-[#256af4]'}`} />
                              <span className={`text-[10px] font-bold text-center leading-tight ${isSelected ? 'text-[#256af4]' : 'text-slate-500 group-hover:text-slate-200'}`}>
                                {entry.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Scene Builder Assets row - optional */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="builder-glass p-4 rounded-2xl border border-[#2d3548] flex items-center gap-4 hover:bg-[#161b2a] transition-all cursor-pointer">
                      <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-[#256af4] border border-[#256af4]/20">
                        <LayoutGrid className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white text-sm">Visual Background</p>
                        <p className="text-xs text-slate-500">Optional</p>
                      </div>
                    </div>
                    <div className="builder-glass p-4 rounded-2xl border border-[#2d3548] flex items-center gap-4 hover:bg-[#161b2a] transition-all cursor-pointer">
                      <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-purple-400 border border-purple-400/20">
                        <Box className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white text-sm">3D Object</p>
                        <p className="text-xs text-slate-500">Optional</p>
                      </div>
                    </div>
                    <div className="builder-glass p-4 rounded-2xl border border-[#2d3548] flex items-center gap-4 hover:bg-[#161b2a] transition-all cursor-pointer">
                      <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 border border-emerald-400/20">
                        <Layers className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white text-sm">Ambient Sound</p>
                        <p className="text-xs text-slate-500">Optional</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {centerTab === 'preview' && (
                <div className="builder-glass rounded-3xl p-8">
                  {Player ? (
                    <Player content={content} onComplete={() => {}} disabled={false} />
                  ) : (
                    <PreviewPanel content={content} challengeType={challengeType} title={title} />
                  )}
                </div>
              )}

              {centerTab === 'dataset' && (
                <div className="builder-glass rounded-3xl p-8 text-center text-slate-500">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Dataset configuration coming soon.</p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="max-w-5xl mx-auto mt-4">
              <p className="text-rose-400 text-sm">{error}</p>
            </div>
          )}
        </section>

        {/* Right: Feedback & rewards + Assign */}
        <aside className="w-80 border-l border-[#2d3548] bg-slate-900/80 flex flex-col hidden xl:flex shrink-0">
          <div className="p-4 border-b border-[#2d3548]">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Feedback & rewards</h3>
          </div>
          <div className="flex-1 p-6 space-y-8 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <h5 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="text-[#256af4]">✓</span> When it&apos;s right
              </h5>
              <div className="p-4 rounded-xl bg-[#161b2a] border border-[#2d3548] text-xs text-slate-400 leading-relaxed">
                Based on interaction type and content. Preview to verify.
              </div>
            </div>
            <div className="space-y-4">
              <h5 className="text-sm font-bold text-white flex items-center gap-2">Completion Reward</h5>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-[#2d3548]">
                  <span className="text-xs font-medium">XP Bonus</span>
                  <input
                    type="number"
                    min={0}
                    value={xpReward}
                    onChange={(e) => setXpReward(Number(e.target.value) || 0)}
                    className="w-16 bg-transparent border-none text-right text-xs font-bold text-[#256af4] focus:ring-0 p-0"
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-[#2d3548]">
                  <span className="text-xs font-medium">Bonus (first try)</span>
                  <input
                    type="number"
                    min={0}
                    value={xpBonusFirstTry}
                    onChange={(e) => setXpBonusFirstTry(Number(e.target.value) || 0)}
                    className="w-16 bg-transparent border-none text-right text-xs font-bold text-[#256af4] focus:ring-0 p-0"
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-[#2d3548]">
                  <span className="text-xs font-medium">Retry penalty</span>
                  <input
                    type="number"
                    min={0}
                    value={xpRetryPenalty}
                    onChange={(e) => setXpRetryPenalty(Number(e.target.value) || 0)}
                    className="w-16 bg-transparent border-none text-right text-xs font-bold text-[#256af4] focus:ring-0 p-0"
                  />
                </div>
              </div>
            </div>
            {selectedId && (
              <div className="space-y-4 pt-4 border-t border-[#2d3548]">
                <h5 className="text-sm font-bold text-white">Assign to Class</h5>
                <select
                  value={assignClassId}
                  onChange={(e) => setAssignClassId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-slate-900 border border-[#2d3548] rounded-xl px-3 py-2 text-slate-100 text-sm"
                >
                  <option value="">— Select class —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={assigning}
                  className="w-full py-2 rounded-xl bg-[#256af4] text-white text-sm font-bold disabled:opacity-50"
                >
                  {assigning ? 'Assigning…' : 'Assign to class'}
                </button>
                {assignMsg && <p className="text-xs text-slate-400">{assignMsg}</p>}
                {assignedTo.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase">Assigned to</p>
                    {assignedTo.map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900 border border-[#2d3548] text-sm">
                        <span className="font-medium">{c.name}</span>
                        <button type="button" onClick={() => handleUnassign(c.id)} className="text-[10px] text-rose-400 hover:text-rose-300 font-bold">Unassign</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="p-4 bg-slate-900/50 border-t border-[#2d3548]">
            <button type="button" className="w-full py-3 bg-[#256af4]/10 border border-[#256af4]/40 rounded-xl text-[#256af4] text-xs font-black uppercase tracking-widest hover:bg-[#256af4]/20 transition-all">
              Try it
            </button>
          </div>
        </aside>
      </main>

      <button
        type="button"
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-[#256af4] text-white shadow-xl shadow-[#256af4]/30 flex items-center justify-center hover:scale-110 transition-transform z-50"
        title="Help"
      >
        <HelpCircle className="w-6 h-6" />
      </button>
    </div>
  );
}
