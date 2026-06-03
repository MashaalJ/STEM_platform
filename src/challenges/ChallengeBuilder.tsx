/**
 * Challenge Studio - STEMverse Builder layout from mockups.
 * Header, left sequence sidebar, center (Editor / Preview), right feedback panel.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Rocket,
  Edit3,
  Eye,
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
  Code2,
  X,
} from 'lucide-react';
import type { ChallengeType, ChallengeContent, ChallengeRecord } from './types';
import { getAllChallengeTypes, getChallengeType, getDefaultContent } from './registry';
import { getContentTypeCatalog } from './catalog';
import { PreviewPanel } from './components/PreviewPanel';
import { safeFetch, fetchWithAuth, authFetch } from '../app/api';

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
  Code2,
  Puzzle,
  LayoutGrid,
};

export function ChallengeBuilder() {
  const [challenges, setChallenges] = useState<ChallengeRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [challengeType, setChallengeType] = useState<ChallengeType>('multiple_choice');
  const [content, setContent] = useState<ChallengeContent>(() => getDefaultContent('multiple_choice')!);
  const [world, setWorld] = useState('');
  const [zone, setZone] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [xpReward, setXpReward] = useState(100);
  const [xpBonusFirstTry, setXpBonusFirstTry] = useState(0);
  const [xpRetryPenalty, setXpRetryPenalty] = useState(0);
  const [newChallengeTypeChosen, setNewChallengeTypeChosen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [assignedTo, setAssignedTo] = useState<{ id: string; name: string; assigned_at: string }[]>([]);
  const [assignClassId, setAssignClassId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);
  const [centerTab, setCenterTab] = useState<'editor' | 'preview'>('editor');
  const [timeLimitSec, setTimeLimitSec] = useState<number>(45);
  const [saveMessage, setSaveMessage] = useState<'saved' | 'error' | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [publishClassId, setPublishClassId] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [sceneAssetNotice, setSceneAssetNotice] = useState<string | null>(null);
  const [previewLockedFeedback, setPreviewLockedFeedback] = useState<string | null>(null);

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
    authFetch('/api/classes')
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.classes ?? [];
        if (Array.isArray(list)) {
          setClasses(list.map((c: { id: string; name: string }) => ({ id: String(c.id), name: c.name })));
        }
      })
      .catch((e) => console.error('ChallengeBuilder: could not load classes', e));
  }, []);

  useEffect(() => {
    if (selectedId) {
      const c = challenges.find((x) => x.id === selectedId);
      if (c) {
        setTitle(c.title);
        setChallengeType(c.type as ChallengeType);
        try {
          const parsed = JSON.parse(c.content_json || '{}');
          setContent(parsed);
          if (typeof parsed?.time_limit_sec === 'number' && Number.isFinite(parsed.time_limit_sec)) {
            setTimeLimitSec(parsed.time_limit_sec);
          }
        } catch {
          setContent(getDefaultContent(c.type as ChallengeType) || {});
        }
        setWorld(c.world || '');
        setZone(c.zone || '');
        setGradeLevel((c as any).grade_level || '');
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
      setGradeLevel('');
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

  const handleSave = async (): Promise<string | null> => {
    if (!title.trim()) {
      setError('Title is required');
      return null;
    }
    setError(null);
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        type: challengeType,
        world: world.trim() || undefined,
        zone: zone.trim() || undefined,
        grade_level: gradeLevel.trim() || undefined,
        xp_reward: xpReward,
        xp_bonus_first_try: xpBonusFirstTry,
        xp_retry_penalty: xpRetryPenalty,
        content_json: JSON.stringify(content),
      };
      const url = selectedId ? `/api/challenges/${selectedId}` : '/api/challenges';
      const method = selectedId ? 'PATCH' : 'POST';
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || data.message || (res.status === 401 ? 'Please sign in again.' : 'Failed to save'));
        setSaveMessage('error');
        return null;
      }
      loadChallenges();
      const id = selectedId ?? (data.id != null ? String(data.id) : null);
      if (!id) {
        setError('Save succeeded but no challenge id was returned.');
        setSaveMessage('error');
        return null;
      }
      setSelectedId(id);
      setError(null);
      setSaveMessage('saved');
      setTimeout(() => setSaveMessage(null), 2500);
      return id;
    } finally {
      setSaving(false);
    }
  };

  const handlePublishToClass = async () => {
    const cid = publishClassId.trim();
    if (!cid) {
      setPublishMessage('Select a class.');
      return;
    }
    setPublishMessage(null);
    setPublishing(true);
    try {
      let id = selectedId;
      if (!id) {
        id = await handleSave();
        if (!id) {
          setPublishMessage('Save failed. Fix errors and try again.');
          return;
        }
      }
      const res = await fetchWithAuth(`/api/classes/${cid}/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPublishMessage(data.error || data.message || 'Assign failed');
        return;
      }
      setPublishMessage('Published to class.');
      setShowPublishModal(false);
      setPublishClassId('');
      const refreshed = await safeFetch(`/api/challenges/${id}/assigned-classes`);
      setAssignedTo(Array.isArray(refreshed) ? refreshed : []);
      setTimeout(() => setPublishMessage(null), 2000);
    } finally {
      setPublishing(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedId) {
      setAssignMsg('Save the challenge first.');
      return;
    }
    const cid = assignClassId.trim();
    if (!cid) {
      setAssignMsg('Pick a class to assign to.');
      return;
    }
    setAssignMsg(null);
    setAssigning(true);
    try {
      const res = await fetchWithAuth(`/api/classes/${cid}/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const handleUnassign = async (classId: string) => {
    if (!selectedId) return;
    setAssignMsg(null);
    setAssigning(true);
    try {
      await fetchWithAuth(`/api/classes/${classId}/challenges/${selectedId}`, { method: 'DELETE' });
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
      const parsed = JSON.parse(c.content_json || '{}');
      setContent(parsed);
      if (typeof parsed?.time_limit_sec === 'number' && Number.isFinite(parsed.time_limit_sec)) {
        setTimeLimitSec(parsed.time_limit_sec);
      }
    } catch {
      setContent(getDefaultContent(c.type as ChallengeType) || {});
    }
    setWorld(c.world || '');
    setZone(c.zone || '');
    setGradeLevel((c as any).grade_level || '');
    setXpReward(c.xp_reward ?? 100);
    setXpBonusFirstTry(c.xp_bonus_first_try ?? 0);
    setXpRetryPenalty(c.xp_retry_penalty ?? 0);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this challenge?')) return;
    const res = await fetchWithAuth(`/api/challenges/${id}`, { method: 'DELETE' });
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
    setGradeLevel('');
    setXpReward(100);
    setXpBonusFirstTry(0);
    setXpRetryPenalty(0);
  };

  const handlePublish = async () => {
    const cid = publishClassId.trim();
    if (!cid) {
      setPublishMessage('Select a class first.');
      return;
    }
    setPublishMessage(null);
    setPublishing(true);
    try {
      let challengeId = selectedId;
      if (!challengeId) {
        if (!title.trim()) {
          setPublishMessage('Add a title and save first.');
          setPublishing(false);
          return;
        }
        setError(null);
        const body = {
          title: title.trim(),
          type: challengeType,
          world: world.trim() || undefined,
          zone: zone.trim() || undefined,
          grade_level: gradeLevel.trim() || undefined,
          xp_reward: xpReward,
          xp_bonus_first_try: xpBonusFirstTry,
          xp_retry_penalty: xpRetryPenalty,
          content_json: JSON.stringify(content),
        };
        const res = await fetchWithAuth('/api/challenges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPublishMessage(data.error || data.message || (res.status === 401 ? 'Please sign in again.' : 'Save failed.'));
          setPublishing(false);
          return;
        }
        challengeId = data.id != null ? String(data.id) : null;
        if (!challengeId) {
          setPublishMessage('Save succeeded but no challenge id was returned.');
          setPublishing(false);
          return;
        }
        setSelectedId(challengeId);
        loadChallenges();
      }
      const assignRes = await fetchWithAuth(`/api/classes/${cid}/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId }),
      });
      if (!assignRes.ok) {
        const data = await assignRes.json().catch(() => ({}));
        setPublishMessage(data.error || data.message || 'Assign failed.');
        setPublishing(false);
        return;
      }
      const refreshed = await safeFetch(`/api/challenges/${challengeId}/assigned-classes`);
      setAssignedTo(Array.isArray(refreshed) ? refreshed : []);
      const cls = classes.find((c) => String(c.id) === cid);
      setPublishMessage(cls ? `Published to ${cls.name}.` : 'Published.');
      setTimeout(() => {
        setShowPublishModal(false);
        setPublishMessage(null);
        setPublishClassId('');
      }, 1500);
    } finally {
      setPublishing(false);
    }
  };

  const displayTitle = title.trim() || 'Untitled Challenge';
  const contentMeta = (content || {}) as Record<string, any>;
  const setContentMeta = (patch: Record<string, any>) => setContent({ ...(content as Record<string, any>), ...patch } as ChallengeContent);

  return (
    <div className="flex flex-col h-full min-h-[100vh] bg-slate-100 text-slate-900 overflow-hidden">
      {/* Top bar – integrated with main app look */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white z-40 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center size-9 rounded-xl bg-slate-100 border border-slate-200 text-[#256af4]">
            <Box className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-600 font-black">
              Challenge Builder
            </span>
            <span className="text-sm font-semibold truncate text-slate-900">
              {displayTitle}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-slate-100 border border-slate-200 text-sm font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving…' : saveMessage === 'saved' ? 'Saved' : 'Save'}
            </button>
            {error && <span className="text-rose-400 text-xs font-medium">{error}</span>}
            <button
              type="button"
              onClick={() => setShowPublishModal(true)}
              className="px-4 py-2 rounded-lg bg-[#256af4] text-white text-sm font-bold shadow-[0_0_15px_rgba(37,106,244,0.3)] hover:brightness-110 transition-all flex items-center gap-2"
            >
              <Rocket className="w-4 h-4" />
              Publish
            </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Left: Sequence sidebar */}
        <aside className="w-72 border-r border-slate-200 bg-white flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600">Sequence</h3>
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
                      : 'border-slate-200 bg-slate-50 hover:border-[#256af4]/50 opacity-95 hover:opacity-100'
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
                  <p className="text-xs font-semibold text-slate-800 truncate">{c.title}</p>
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

        {/* Center: Editor / Preview */}
        <section className="flex-1 bg-slate-100 p-6 overflow-y-auto custom-scrollbar flex flex-col">
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
            <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full min-w-0">
              {/* Tabs: Editor | Preview */}
              <div className="bg-white rounded-2xl p-2 flex gap-1 self-center border border-slate-200 shadow-sm">
                <button
                  type="button"
                  onClick={() => setCenterTab('editor')}
                  className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                    centerTab === 'editor' ? 'bg-[#256af4] text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  Editor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewLockedFeedback(null);
                    setCenterTab('preview');
                  }}
                  className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                    centerTab === 'preview' ? 'bg-[#256af4] text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
              </div>

              {centerTab === 'editor' && (
                <>
                  <div className="bg-white rounded-3xl p-8 flex flex-col gap-8 shadow-sm border border-slate-200 relative overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#256af4]/10 rounded-full blur-[100px]" aria-hidden />
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="px-3 py-1 rounded-full bg-[#256af4]/20 text-[#256af4] text-[10px] font-black tracking-widest uppercase">Level: Advanced</span>
                        <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-black tracking-widest uppercase">Module: {plugin?.meta.label ?? challengeType}</span>
                      </div>
                      <label className="block">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Title</span>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Challenge title"
                          className="mt-2 block w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-[#256af4]/50 focus:border-[#256af4]"
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
                      <h4 className="text-sm font-bold text-slate-600 uppercase tracking-widest mb-6">Change Interaction Type</h4>
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
                                  : 'bg-slate-50 border-slate-200 hover:border-[#256af4] hover:bg-[#256af4]/5'
                              }`}
                            >
                              <Icon className={`w-6 h-6 ${isSelected ? 'text-[#256af4]' : 'text-slate-500 group-hover:text-[#256af4]'}`} />
                              <span className={`text-[10px] font-bold text-center leading-tight ${isSelected ? 'text-[#256af4]' : 'text-slate-600 group-hover:text-slate-900'}`}>
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
                    <button type="button" onClick={() => { setContentMeta({ visual_background: contentMeta.visual_background || 'nebula-grid' }); setSceneAssetNotice('Visual background enabled.'); }} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4 hover:bg-slate-50 transition-all cursor-pointer text-left">
                      <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-[#256af4] border border-[#256af4]/20">
                        <LayoutGrid className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm">Visual Background</p>
                        <p className="text-xs text-slate-600">{contentMeta.visual_background ? 'Enabled' : 'Optional'}</p>
                      </div>
                    </button>
                    <button type="button" onClick={() => { setContentMeta({ object_3d: contentMeta.object_3d || 'default-core' }); setSceneAssetNotice('3D object enabled.'); }} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4 hover:bg-slate-50 transition-all cursor-pointer text-left">
                      <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-purple-400 border border-purple-400/20">
                        <Box className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm">3D Object</p>
                        <p className="text-xs text-slate-600">{contentMeta.object_3d ? 'Enabled' : 'Optional'}</p>
                      </div>
                    </button>
                    <button type="button" onClick={() => { setContentMeta({ ambient_sound: contentMeta.ambient_sound || 'orbital-hum' }); setSceneAssetNotice('Ambient sound enabled.'); }} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4 hover:bg-slate-50 transition-all cursor-pointer text-left">
                      <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 border border-emerald-400/20">
                        <Layers className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm">Ambient Sound</p>
                        <p className="text-xs text-slate-600">{contentMeta.ambient_sound ? 'Enabled' : 'Optional'}</p>
                      </div>
                    </button>
                  </div>
                  {sceneAssetNotice && <p className="text-xs text-emerald-600 font-semibold">{sceneAssetNotice}</p>}
                </>
              )}

              {centerTab === 'preview' && (
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                  <PreviewPanel
                    content={content}
                    challengeType={challengeType}
                    title={title}
                    lockedFeedback={previewLockedFeedback}
                    onPreviewComplete={(response) => {
                      console.log('[ChallengeBuilder] preview lock answer', response);
                      setPreviewLockedFeedback('Answer locked in preview — students will submit this response.');
                    }}
                  />
                </div>
              )}
            </div>
          )}

          </section>

        {/* Right: Feedback & rewards + Assign */}
        <aside className="w-80 border-l border-slate-200 bg-white flex flex-col hidden xl:flex shrink-0">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600">Feedback & rewards</h3>
          </div>
          <div className="flex-1 p-6 space-y-8 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <h5 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="text-[#256af4]">✓</span> When it&apos;s right
              </h5>
              <textarea
                value={String(contentMeta.feedback_right || '')}
                onChange={(e) => setContentMeta({ feedback_right: e.target.value })}
                placeholder="Type success feedback shown when the student gets it right..."
                className="w-full min-h-[90px] p-3 rounded-xl bg-white border border-slate-300 text-sm text-slate-800 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-[#256af4]/50 focus:border-[#256af4]"
              />
            </div>
            <div className="space-y-4">
              <h5 className="text-sm font-bold text-slate-900 flex items-center gap-2">Completion Reward</h5>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 gap-2">
                  <span className="text-xs font-medium text-slate-700">Grade level</span>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="bg-transparent border border-slate-300 rounded px-2 py-1 text-xs text-slate-700"
                  >
                    <option value="">All</option>
                    <option value="K-2">K-2</option>
                    <option value="3-5">3-5</option>
                    <option value="6-8">6-8</option>
                    <option value="9-12">9-12</option>
                    <option value="College">College</option>
                  </select>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-xs font-medium text-slate-700">XP Bonus</span>
                  <input
                    type="number"
                    min={0}
                    value={xpReward}
                    onChange={(e) => setXpReward(Number(e.target.value) || 0)}
                    className="w-16 bg-transparent border-none text-right text-xs font-bold text-[#256af4] focus:ring-0 p-0"
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-xs font-medium text-slate-700">Bonus (first try)</span>
                  <input
                    type="number"
                    min={0}
                    value={xpBonusFirstTry}
                    onChange={(e) => setXpBonusFirstTry(Number(e.target.value) || 0)}
                    className="w-16 bg-transparent border-none text-right text-xs font-bold text-[#256af4] focus:ring-0 p-0"
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-xs font-medium text-slate-700">Retry penalty</span>
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
                <h5 className="text-sm font-bold text-slate-900">Assign to Class</h5>
                <select
                  value={assignClassId}
                  onChange={(e) => setAssignClassId(e.target.value)}
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
                {assignMsg && <p className="text-xs text-slate-600">{assignMsg}</p>}
                {assignedTo.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-600 uppercase">Assigned to</p>
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
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <button type="button" onClick={() => setCenterTab('preview')} className="w-full py-3 bg-[#256af4]/10 border border-[#256af4]/40 rounded-xl text-[#256af4] text-xs font-black uppercase tracking-widest hover:bg-[#256af4]/20 transition-all">
              Try it
            </button>
          </div>
        </aside>
      </main>

      {/* Publish to class modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-[#2d3548] rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Rocket className="w-5 h-5 text-[#256af4]" />
                Publish to class
              </h3>
              <button type="button" onClick={() => { setShowPublishModal(false); setPublishMessage(null); setPublishClassId(''); }} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-4">Choose which class will receive this challenge. Students in that class will see it in their Command Console.</p>
            <select
              value={publishClassId}
              onChange={(e) => setPublishClassId(e.target.value)}
              className="w-full bg-slate-950 border border-[#2d3548] rounded-xl px-4 py-3 text-slate-100 text-sm mb-4 focus:ring-2 focus:ring-[#256af4]/50 focus:border-[#256af4] outline-none"
            >
              <option value="">— Select class —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              {classes.length === 0 && <option disabled>No classes yet</option>}
            </select>
            {publishMessage && <p className={`text-sm mb-4 ${publishMessage.startsWith('Published') ? 'text-emerald-400' : 'text-rose-400'}`}>{publishMessage}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowPublishModal(false); setPublishMessage(null); setPublishClassId(''); }}
                className="flex-1 py-2.5 rounded-xl border border-[#2d3548] text-slate-300 text-sm font-bold hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublishToClass}
                disabled={publishing || classes.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-[#256af4] text-white text-sm font-bold hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {publishing ? 'Publishing…' : selectedId ? 'Publish to class' : 'Save & Publish to class'}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowHelpModal(true)}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-[#256af4] text-white shadow-xl shadow-[#256af4]/30 flex items-center justify-center hover:scale-110 transition-transform z-50"
        title="Help"
      >
        <HelpCircle className="w-6 h-6" />
      </button>

      {showHelpModal && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowHelpModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xl font-black text-[#0D1C32]">How to Use Challenge Maker</h3>
                <p className="text-sm text-slate-600 mt-1">Quick guide for creating, testing, and publishing challenges.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                aria-label="Close help"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-700">
              <div>
                <p className="font-bold text-[#0D1C32]">1) Start a challenge</p>
                <p>Click <strong>Insert Question</strong>, choose a type, then enter title and prompt/content.</p>
              </div>
              <div>
                <p className="font-bold text-[#0D1C32]">2) Add answers and media</p>
                <p>Use Data Pods to set options/correct answers. You can paste/upload images directly in supported editors.</p>
              </div>
              <div>
                <p className="font-bold text-[#0D1C32]">3) Configure rewards and feedback</p>
                <p>Set XP bonus, first-try bonus, retry penalty, and custom success feedback in the right panel.</p>
              </div>
              <div>
                <p className="font-bold text-[#0D1C32]">4) Test before publishing</p>
                <p>Click <strong>Try it</strong> to open Preview and verify behavior and readability.</p>
              </div>
              <div>
                <p className="font-bold text-[#0D1C32]">5) Save and publish</p>
                <p>Click <strong>Save</strong> to store the challenge. Then use <strong>Publish</strong> or <strong>Assign to class</strong> to deliver it to students.</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-lg bg-[#256af4] text-white font-bold hover:brightness-110"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish to class modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !publishing && setShowPublishModal(false)}>
          <div className="bg-slate-900 border border-[#2d3548] rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Rocket className="w-5 h-5 text-[#256af4]" />
                Publish to class
              </h3>
              <button type="button" onClick={() => !publishing && setShowPublishModal(false)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-4">Choose which class should receive this challenge. Students in that class will see it in their Command Console.</p>
            <select
              value={publishClassId}
              onChange={(e) => setPublishClassId(e.target.value)}
              className="w-full bg-slate-800 border border-[#2d3548] rounded-xl px-4 py-3 text-slate-100 text-sm focus:ring-2 focus:ring-[#256af4]/50 focus:border-[#256af4] outline-none"
            >
              <option value="">— Select class —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {classes.length === 0 && <p className="text-xs text-slate-500 mt-2">No classes yet. Create one in Dashboard → Classroom Manager.</p>}
            {publishMessage && <p className={`mt-3 text-sm font-medium ${publishMessage.startsWith('Published') ? 'text-emerald-400' : 'text-rose-400'}`}>{publishMessage}</p>}
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => !publishing && setShowPublishModal(false)} className="flex-1 py-2.5 rounded-xl border border-[#2d3548] text-slate-300 text-sm font-bold hover:bg-slate-800 transition-colors">Cancel</button>
              <button type="button" onClick={handlePublish} disabled={publishing || classes.length === 0} className="flex-1 py-2.5 rounded-xl bg-[#256af4] text-white text-sm font-bold disabled:opacity-50 hover:brightness-110 transition-all">
                {publishing ? 'Publishing…' : 'Publish to class'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
