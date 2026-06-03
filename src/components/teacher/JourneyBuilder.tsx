/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, CirclePlay, Target, Wrench, Zap, Plus, Trash2, Save, AlertTriangle, X } from 'lucide-react';
import { authFetch, safeFetch } from '../../app/api';
import type { Class, Mission } from '../../app/types';

type Curriculum = {
  id: string;
  title: string;
  description?: string | null;
  is_published?: boolean;
  order_index?: number;
};

type Journey = {
  id: string;
  title: string;
  description?: string | null;
  curriculum_id?: string | null;
  sector_id?: string | null;
  node_count?: number;
  is_deployed?: boolean;
};

type JourneyNode = {
  id: string;
  journey_id: string;
  sector_id?: string | null;
  node_type: 'mission' | 'challenge' | 'video' | 'reading' | 'practice';
  content_id?: string | null;
  content_url?: string | null;
  title?: string | null;
  order_index: number;
  prerequisite_node_id?: string | null;
  xp_reward: number;
};

type Challenge = { id: string; title: string };
type Quiz = { id: string; title: string };
type ActivityBankItem = {
  id: string;
  title: string;
  description?: string | null;
  activity_type: 'video' | 'reading' | 'tool' | 'challenge' | 'quiz' | 'interactive';
  xp_reward?: number | null;
  estimated_minutes?: number | null;
};
type AddNodeDraft = {
  node_type: JourneyNode['node_type'];
  title: string;
  xp_reward: number;
  content_id: string;
  content_url: string;
  needsPrevious: boolean;
  useInlineCreator: boolean;
  newActivityType: ActivityBankItem['activity_type'];
  newActivityDescription: string;
  newActivityDifficulty: string;
  newActivityMinutes: number;
  newActivityTags: string;
  saveScope: 'my' | 'school' | 'default';
  videoUrl: string;
  videoTranscript: string;
  readingBody: string;
  toolType: string;
  toolEmbedCode: string;
  challengeId: string;
  quizId: string;
  missionEmbedCode: string;
};
const isUuid = (v: string | null | undefined) =>
  Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v));

const nodeMeta: Record<JourneyNode['node_type'], { label: string; icon: React.ReactNode; color: string }> = {
  mission: { label: 'Mission', icon: <Target className="size-4" />, color: 'bg-teal-100 text-teal-700 border-teal-300' },
  challenge: { label: 'Challenge', icon: <Zap className="size-4" />, color: 'bg-amber-100 text-amber-700 border-amber-300' },
  video: { label: 'Video', icon: <CirclePlay className="size-4" />, color: 'bg-purple-100 text-purple-700 border-purple-300' },
  reading: { label: 'Reading', icon: <BookOpen className="size-4" />, color: 'bg-blue-100 text-blue-700 border-blue-300' },
  practice: { label: 'Practice', icon: <Wrench className="size-4" />, color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
};

export default function JourneyBuilder({
  selectedClassId,
  classes,
  sectors,
}: {
  selectedClassId: string | null;
  classes: Class[];
  sectors: Array<{ id: string; name: string }>;
}) {
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<string | null>(null);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<JourneyNode[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activities, setActivities] = useState<ActivityBankItem[]>([]);
  const [savingNodeId, setSavingNodeId] = useState<string | null>(null);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [journeyEditorOpen, setJourneyEditorOpen] = useState(false);
  const [addNodePanelOpen, setAddNodePanelOpen] = useState(false);
  const [addNodeStep, setAddNodeStep] = useState<1 | 2 | 3>(1);
  const [addNodeDraft, setAddNodeDraft] = useState<AddNodeDraft>({
    node_type: 'mission',
    title: '',
    xp_reward: 100,
    content_id: '',
    content_url: '',
    needsPrevious: true,
    useInlineCreator: false,
    newActivityType: 'interactive',
    newActivityDescription: '',
    newActivityDifficulty: 'beginner',
    newActivityMinutes: 10,
    newActivityTags: '',
    saveScope: 'my',
    videoUrl: '',
    videoTranscript: '',
    readingBody: '',
    toolType: 'circuit_builder',
    toolEmbedCode: '',
    challengeId: '',
    quizId: '',
    missionEmbedCode: '',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creatingInlineActivity, setCreatingInlineActivity] = useState(false);

  const apiError = async (res: Response, fallback: string) => {
    const body = await res.json().catch(() => ({}));
    return body.error || body.message || fallback;
  };

  const selectedCurriculum = useMemo(
    () => curriculums.find((c) => c.id === selectedCurriculumId) ?? null,
    [curriculums, selectedCurriculumId],
  );

  const selectedJourney = useMemo(
    () => journeys.find((j) => j.id === selectedJourneyId) ?? null,
    [journeys, selectedJourneyId],
  );

  const selectedClass = useMemo(
    () => classes.find((c) => String(c.id) === String(selectedClassId)) ?? null,
    [classes, selectedClassId],
  );
  const validClassId = isUuid(selectedClassId);

  const loadCurriculums = async () => {
    if (!selectedClassId) {
      setCurriculums([]);
      setSelectedCurriculumId(null);
      setJourneys([]);
      setSelectedJourneyId(null);
      return;
    }
    const data = await safeFetch(`/api/classes/${selectedClassId}/curriculums`);
    const list = Array.isArray(data) ? (data as Curriculum[]) : [];
    setCurriculums(list);
    if (list.length > 0) {
      setSelectedCurriculumId((prev) => (prev && list.some((c) => c.id === prev) ? prev : list[0].id));
    } else {
      setSelectedCurriculumId(null);
      setJourneys([]);
      setSelectedJourneyId(null);
      setNodes([]);
    }
  };

  const loadJourneys = async (curriculumId: string) => {
    if (!selectedClassId) return;
    const data = await safeFetch(`/api/classes/${selectedClassId}/journeys?curriculum_id=${encodeURIComponent(curriculumId)}`);
    const list = Array.isArray(data) ? (data as Journey[]) : [];
    setJourneys(list);
    if (list.length > 0) {
      setSelectedJourneyId((prev) => (prev && list.some((j) => j.id === prev) ? prev : list[0].id));
    } else {
      setSelectedJourneyId(null);
      setNodes([]);
    }
  };

  const loadNodes = async (journeyId: string) => {
    const data = await safeFetch(`/api/journeys/${journeyId}/nodes`);
    setNodes(Array.isArray(data) ? (data as JourneyNode[]) : []);
  };

  useEffect(() => {
    loadCurriculums();
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedCurriculumId) {
      setJourneys([]);
      setSelectedJourneyId(null);
      setSelectedSectorId(null);
      setNodes([]);
      return;
    }
    void loadJourneys(selectedCurriculumId);
  }, [selectedCurriculumId]);

  useEffect(() => {
    const sectorIds = journeys.map((j) => String(j.sector_id || '')).filter(Boolean);
    if (!sectorIds.length) {
      setSelectedSectorId(null);
      return;
    }
    setSelectedSectorId((prev) => (prev && sectorIds.includes(prev) ? prev : sectorIds[0]));
  }, [journeys]);

  useEffect(() => {
    if (!selectedJourneyId) return;
    void loadNodes(selectedJourneyId);
  }, [selectedJourneyId]);

  useEffect(() => {
    safeFetch('/api/missions').then((data) => setMissions(Array.isArray(data) ? (data as Mission[]) : []));
    safeFetch('/api/challenges').then((data) => setChallenges(Array.isArray(data) ? (data as Challenge[]) : []));
    safeFetch('/api/quizzes').then((data) => setQuizzes(Array.isArray(data) ? (data as Quiz[]) : []));
    safeFetch('/api/activities').then((data) => setActivities(Array.isArray(data) ? (data as ActivityBankItem[]) : []));
  }, []);

  const mapActivityToNodeType = (type: ActivityBankItem['activity_type']): JourneyNode['node_type'] => {
    if (type === 'video') return 'video';
    if (type === 'reading') return 'reading';
    if (type === 'challenge') return 'challenge';
    if (type === 'quiz') return 'practice';
    if (type === 'tool') return 'practice';
    return 'mission';
  };

  const buildActivityContent = (type: ActivityBankItem['activity_type'], draft: AddNodeDraft) => {
    if (type === 'video') return { url: draft.videoUrl || draft.content_url || '', duration: null, transcript: draft.videoTranscript || '' };
    if (type === 'reading') return { body: draft.readingBody || '', source_url: draft.content_url || '' };
    if (type === 'tool') return { tool_type: draft.toolType || 'circuit_builder', embed_code: draft.toolEmbedCode || '' };
    if (type === 'challenge') return { challenge_id: draft.challengeId || null };
    if (type === 'quiz') return { quiz_id: draft.quizId || null };
    return { embed_code: draft.missionEmbedCode || '', source_url: draft.content_url || '' };
  };

  const createCurriculum = async () => {
    if (!selectedClassId || !validClassId) {
      setError('Select a valid class first.');
      return;
    }
    setError(null);
    const res = await authFetch(`/api/classes/${selectedClassId}/curriculums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `Curriculum ${curriculums.length + 1}`, order_index: curriculums.length }),
    });
    if (!res.ok) {
      setError(await apiError(res, 'Could not create curriculum.'));
      return;
    }
    await loadCurriculums();
    setMessage('Curriculum created.');
    setTimeout(() => setMessage(null), 1800);
  };

  const saveCurriculumMeta = async (patch: Partial<Curriculum>) => {
    if (!selectedCurriculumId) return;
    setError(null);
    const res = await authFetch(`/api/curriculums/${selectedCurriculumId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setError(await apiError(res, 'Could not update curriculum.'));
      return;
    }
    await loadCurriculums();
    setMessage('Curriculum updated.');
    setTimeout(() => setMessage(null), 1600);
  };

  const deleteCurriculum = async () => {
    if (!selectedCurriculumId) return;
    if (!window.confirm('Delete this curriculum and all its sector journeys/activities?')) return;
    setError(null);
    const res = await authFetch(`/api/curriculums/${selectedCurriculumId}`, { method: 'DELETE' });
    if (!res.ok) {
      setError(await apiError(res, 'Could not delete curriculum.'));
      return;
    }
    await loadCurriculums();
    setMessage('Curriculum deleted.');
    setTimeout(() => setMessage(null), 1800);
  };

  const createSectorJourney = async (sectorId: string) => {
    if (!selectedClassId || !selectedCurriculumId) return;
    const sector = sectors.find((s) => String(s.id) === String(sectorId));
    if (!sector) return;
    const res = await authFetch(`/api/classes/${selectedClassId}/journeys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${sector.name} Journey`,
        curriculum_id: selectedCurriculumId,
        sector_id: sector.id,
        order_index: journeys.length,
      }),
    });
    if (!res.ok) {
      setError(await apiError(res, 'Could not add sector.'));
      return;
    }
    await loadJourneys(selectedCurriculumId);
    setMessage(`${sector.name} sector added.`);
    setTimeout(() => setMessage(null), 1800);
  };

  const createJourneyInSelectedSector = async () => {
    if (!selectedSectorId) {
      setError('Select a sector first.');
      return;
    }
    await createSectorJourney(selectedSectorId);
  };

  const removeSectorJourney = async (journeyId: string, sectorName?: string) => {
    if (!window.confirm(`Remove ${sectorName || 'this sector'} from curriculum?`)) return;
    setError(null);
    const res = await authFetch(`/api/journeys/${journeyId}`, { method: 'DELETE' });
    if (!res.ok) {
      setError(await apiError(res, 'Could not remove sector.'));
      return;
    }
    if (selectedCurriculumId) await loadJourneys(selectedCurriculumId);
    if (selectedJourneyId === journeyId) setSelectedJourneyId(null);
    setMessage('Sector removed.');
    setTimeout(() => setMessage(null), 1600);
  };

  const setJourneyDeploy = async (journeyId: string, isDeployed: boolean) => {
    const res = await authFetch(`/api/journeys/${journeyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_deployed: isDeployed }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(await apiError(res, 'Could not update deployment status.'));
      return;
    }
    if (selectedCurriculumId) {
      await loadJourneys(selectedCurriculumId);
      await loadCurriculums();
    }
    if (isDeployed) {
      const classLabel =
        String(data.class_name || selectedClass?.name || 'your class').trim() || 'your class';
      setMessage(`Journey deployed. Students in ${classLabel} can now access this content.`);
    } else {
      setMessage('Journey undeployed.');
    }
    setTimeout(() => setMessage(null), 3200);
  };

  const createNodeAt = async (index: number, sectorId?: string | null) => {
    if (!selectedJourneyId) return;
    const res = await authFetch(`/api/journeys/${selectedJourneyId}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_type: 'mission',
        order_index: index,
        sector_id: sectorId ?? null,
        title: 'New activity',
        xp_reward: 100,
      }),
    });
    if (!res.ok) {
      setError(await apiError(res, 'Could not add activity.'));
      return;
    }
    await loadNodes(selectedJourneyId);
    await reorderSequential();
    setMessage('Activity added.');
    setTimeout(() => setMessage(null), 1200);
  };

  const createConfiguredNode = async () => {
    if (!selectedJourneyId) return;
    const orderIndex = nodes.length;
    const previousNode = nodes[orderIndex - 1];
    const res = await authFetch(`/api/journeys/${selectedJourneyId}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_type: addNodeDraft.node_type,
        order_index: orderIndex,
        sector_id: selectedJourney?.sector_id || null,
        title: addNodeDraft.title || 'New activity',
        content_id: addNodeDraft.content_id || null,
        content_url: addNodeDraft.content_url || null,
        xp_reward: Number(addNodeDraft.xp_reward || 0),
        prerequisite_node_id: addNodeDraft.needsPrevious && previousNode ? previousNode.id : null,
      }),
    });
    if (!res.ok) {
      setError(await apiError(res, 'Could not add configured activity.'));
      return;
    }
    if (selectedJourneyId) await loadNodes(selectedJourneyId);
    setAddNodePanelOpen(false);
    setAddNodeStep(1);
    setAddNodeDraft({
      node_type: 'mission',
      title: '',
      xp_reward: 100,
      content_id: '',
      content_url: '',
      needsPrevious: true,
      useInlineCreator: false,
      newActivityType: 'interactive',
      newActivityDescription: '',
      newActivityDifficulty: 'beginner',
      newActivityMinutes: 10,
      newActivityTags: '',
      saveScope: 'my',
      videoUrl: '',
      videoTranscript: '',
      readingBody: '',
      toolType: 'circuit_builder',
      toolEmbedCode: '',
      challengeId: '',
      quizId: '',
      missionEmbedCode: '',
    });
    setMessage('Activity node added.');
    setTimeout(() => setMessage(null), 1400);
  };

  const createInlineActivity = async () => {
    if (!addNodeDraft.title.trim()) {
      setError('Activity title is required before saving.');
      return;
    }
    setCreatingInlineActivity(true);
    setError(null);
    try {
      const res = await authFetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: addNodeDraft.title.trim(),
          description: addNodeDraft.newActivityDescription.trim() || null,
          activity_type: addNodeDraft.newActivityType,
          sector_id: selectedJourney?.sector_id || null,
          difficulty: addNodeDraft.newActivityDifficulty,
          xp_reward: addNodeDraft.xp_reward,
          estimated_minutes: addNodeDraft.newActivityMinutes,
          tags: addNodeDraft.newActivityTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          is_default: addNodeDraft.saveScope === 'default',
          content: buildActivityContent(addNodeDraft.newActivityType, addNodeDraft),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || data.message || 'Could not create activity.');
        return;
      }
      const created = data.activity as ActivityBankItem | undefined;
      if (created?.id) {
        setActivities((prev) => [created, ...prev]);
        setAddNodeDraft((prev) => ({
          ...prev,
          content_id: created.id,
          node_type: mapActivityToNodeType(created.activity_type),
          useInlineCreator: false,
        }));
        setMessage('Activity created and linked to node.');
        setTimeout(() => setMessage(null), 1400);
      }
    } finally {
      setCreatingInlineActivity(false);
    }
  };

  const updateNode = async (id: string, patch: Partial<JourneyNode>) => {
    setSavingNodeId(id);
    try {
      const res = await authFetch(`/api/journey-nodes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        setError(await apiError(res, 'Could not save activity.'));
        return;
      }
      if (selectedJourneyId) await loadNodes(selectedJourneyId);
    } finally {
      setSavingNodeId(null);
    }
  };

  const deleteNode = async (id: string) => {
    setError(null);
    const res = await authFetch(`/api/journey-nodes/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError(await apiError(res, 'Could not delete activity.'));
      return;
    }
    if (selectedJourneyId) {
      await loadNodes(selectedJourneyId);
      await reorderSequential();
    }
  };

  const reorderSequential = async (baseNodes?: JourneyNode[]) => {
    const src = (baseNodes || nodes).map((n, i) => ({ id: n.id, order_index: i }));
    if (!src.length) return;
    await authFetch('/api/journey-nodes/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes: src }),
    });
  };

  const onDropNode = async (targetId: string) => {
    if (!dragNodeId || dragNodeId === targetId) return;
    const next = [...nodes];
    const from = next.findIndex((n) => n.id === dragNodeId);
    const to = next.findIndex((n) => n.id === targetId);
    if (from < 0 || to < 0) return;
    const [picked] = next.splice(from, 1);
    next.splice(to, 0, picked);
    setNodes(next.map((n, i) => ({ ...n, order_index: i })));
    setDragNodeId(null);
    await reorderSequential(next);
    if (selectedJourneyId) await loadNodes(selectedJourneyId);
  };

  const curriculumSectorIds = useMemo(
    () => journeys.map((j) => String(j.sector_id || '')).filter(Boolean),
    [journeys],
  );
  const journeysInSelectedSector = useMemo(
    () => journeys.filter((j) => String(j.sector_id || '') === String(selectedSectorId || '')),
    [journeys, selectedSectorId],
  );
  const availableSectorsToAdd = useMemo(
    () => sectors.filter((s) => !curriculumSectorIds.includes(String(s.id))),
    [sectors, curriculumSectorIds],
  );

  const hasSectors = journeys.length > 0;
  const hasActivities = journeys.some((j) => Number(j.node_count || 0) > 0);
  const checklist = [
    { label: 'Add at least one sector', done: hasSectors },
    { label: 'Add at least one activity', done: hasActivities },
    { label: 'Deploy a journey', done: journeys.some((j) => j.is_deployed) },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <aside className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-600">Curriculums</h3>
          <button
            type="button"
            onClick={createCurriculum}
            disabled={!selectedClassId || !validClassId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A192F] text-teal-300 text-xs font-bold disabled:opacity-50"
          >
            <Plus className="size-4" />
            Add curriculum
          </button>
        </div>
        {!selectedClassId ? (
          <p className="text-sm text-slate-500">Select a class to manage curriculums.</p>
        ) : !validClassId ? (
          <p className="text-sm text-amber-700">This class uses a legacy ID format and cannot use curriculum maps yet.</p>
        ) : (
          <div className="space-y-2">
            {curriculums.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => setSelectedCurriculumId(j.id)}
                className={`w-full text-left rounded-xl border px-3 py-2 ${selectedCurriculumId === j.id ? 'border-teal-400 bg-teal-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <p className="font-semibold text-slate-900 truncate">{j.title}</p>
                <p
                  className={`inline-flex mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
                    j.is_published
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-slate-300 bg-slate-50 text-slate-600'
                  }`}
                >
                  {j.is_published ? 'Deployed' : 'Draft'}
                </p>
              </button>
            ))}
            {curriculums.length === 0 && <p className="text-sm text-slate-500">No curriculums yet.</p>}
          </div>
        )}
      </aside>

      <section className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-5">
        {!selectedCurriculum ? (
          <p className="text-sm text-slate-500">Open a curriculum to start editing.</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                value={selectedCurriculum.title}
                onChange={(e) =>
                  setCurriculums((prev) => prev.map((j) => (j.id === selectedCurriculum.id ? { ...j, title: e.target.value } : j)))
                }
                onBlur={(e) => saveCurriculumMeta({ title: e.target.value })}
                className="md:col-span-2 rounded-xl border border-slate-300 px-3 py-2 font-semibold"
                placeholder="Curriculum title"
              />
              <textarea
                value={selectedCurriculum.description || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setCurriculums((prev) => prev.map((j) => (j.id === selectedCurriculum.id ? { ...j, description: value } : j)));
                }}
                onBlur={(e) => void saveCurriculumMeta({ description: e.target.value })}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[42px]"
                placeholder="Description"
              />
              {selectedCurriculum.is_published && (
                <span className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Published
                </span>
              )}
              <button
                type="button"
                onClick={() => void deleteCurriculum()}
                className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-rose-700"
              >
                Delete curriculum
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2">Build checklist</p>
              <div className="flex flex-wrap gap-2">
                {checklist.map((item) => (
                  <span
                    key={item.label}
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide border ${
                      item.done
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-amber-300 bg-amber-50 text-amber-700'
                    }`}
                  >
                    {item.done ? 'Done' : 'Pending'} · {item.label}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Class: <span className="font-semibold text-slate-700">{selectedClass?.name || '—'}</span>
            </p>
            <p className="text-xs text-slate-500">
              Summary: <span className="font-semibold text-slate-700">{curriculumSectorIds.length} sectors</span> ·{' '}
              <span className="font-semibold text-slate-700">{journeys.length} journeys</span> ·{' '}
              <span className="font-semibold text-slate-700">{nodes.length} activities</span>
            </p>
            {message && <p className="text-xs text-emerald-700">{message}</p>}
            {error && (
              <p className="text-xs text-rose-700 inline-flex items-center gap-1">
                <AlertTriangle className="size-3.5" />
                {error}
              </p>
            )}

            <div className="space-y-4 border border-slate-200 rounded-xl p-4 bg-slate-50">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-black uppercase tracking-widest text-slate-600">Sectors in this curriculum</p>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) {
                      void createSectorJourney(id);
                      e.currentTarget.value = '';
                    }
                  }}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white"
                >
                  <option value="">Add sector…</option>
                  {availableSectorsToAdd.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {curriculumSectorIds.map((sectorId) => {
                  const sector = sectors.find((s) => String(s.id) === sectorId);
                  const count = journeys.filter((j) => String(j.sector_id || '') === sectorId).length;
                  const selected = String(selectedSectorId || '') === sectorId;
                  return (
                    <button
                      key={sectorId}
                      type="button"
                      onClick={() => setSelectedSectorId(sectorId)}
                      className={`rounded-lg border px-3 py-2 text-left ${
                        selected ? 'border-teal-400 bg-teal-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-900">{sector?.name || 'Sector'}</p>
                      <p className="text-[11px] text-slate-500">{count} journeys</p>
                    </button>
                  );
                })}
              </div>
              {curriculumSectorIds.length === 0 && (
                <p className="text-sm text-slate-500">No sectors yet. Use “Add sector” to start building this curriculum.</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">
                  Journeys {selectedSectorId ? `in ${sectors.find((s) => String(s.id) === String(selectedSectorId))?.name || 'sector'}` : ''}
                </h4>
                <button
                  type="button"
                  onClick={() => void createJourneyInSelectedSector()}
                  disabled={!selectedSectorId}
                  className="inline-flex items-center gap-1 rounded-lg border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 disabled:opacity-50"
                >
                  <Plus className="size-3.5" /> New Journey
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {journeysInSelectedSector.map((journey) => {
                const sectorId = String(journey.sector_id || '');
                const sector = sectors.find((s) => String(s.id) === sectorId);
                const sectorNodes = selectedJourneyId === journey.id ? nodes : [];
                return (
                  <div key={journey.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className={`text-sm font-bold ${selectedJourneyId === journey.id ? 'text-teal-700' : 'text-slate-900'}`}>
                          {journey.title || sector?.name || 'Journey'}
                        </p>
                        <p className="text-[11px] text-slate-500">{journey.node_count || 0} nodes</p>
                      </div>
                      {selectedJourneyId === journey.id && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedJourneyId(journey.id);
                              setJourneyEditorOpen(true);
                            }}
                            className="text-xs text-indigo-700 inline-flex items-center gap-1 font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void setJourneyDeploy(journey.id, !journey.is_deployed)}
                            className={`text-xs inline-flex items-center gap-1 font-semibold ${
                              journey.is_deployed ? 'text-amber-700' : 'text-emerald-700'
                            }`}
                          >
                            {journey.is_deployed ? 'Undeploy' : 'Deploy'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeSectorJourney(journey.id, sector?.name)}
                            className="text-xs text-rose-700 inline-flex items-center gap-1 font-semibold"
                          >
                            <Trash2 className="size-3.5" /> Remove sector
                          </button>
                        </div>
                      )}
                    </div>
                    {selectedJourneyId !== journey.id && (
                      <div className="mb-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedJourneyId(journey.id);
                            setJourneyEditorOpen(true);
                          }}
                          className="text-xs text-indigo-700 font-semibold"
                        >
                          Edit journey
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-slate-500">
                      {selectedJourneyId === journey.id ? `${sectorNodes.length} activities ready` : 'Open journey editor to manage activities.'}
                    </p>
                  </div>
                );
              })}
              {selectedSectorId && journeysInSelectedSector.length === 0 && (
                <p className="text-sm text-slate-500">No journeys in this sector yet. Click “New Journey” to add one.</p>
              )}
            </div>

            {nodes.filter((n) => !n.sector_id).length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">
                  Some legacy activities are not assigned to a sector yet. Assign a sector in each activity card.
                </p>
                </div>
            )}
          </div>
        )}
      </section>

      {journeyEditorOpen && selectedJourney && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm">
          <div className="h-full w-full p-4 md:p-6">
            <div className="h-full w-full rounded-2xl border border-slate-700 bg-[#0d1c32] text-slate-100 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-teal-300 font-black">Journey Builder</p>
                  <h3 className="text-lg font-bold text-white">{selectedJourney.title || 'Untitled journey'}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setJourneyEditorOpen(false);
                    setAddNodePanelOpen(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200"
                >
                  <X className="size-4" /> Close
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 h-[calc(100%-64px)]">
                <div className="lg:col-span-8 overflow-y-auto p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-slate-300">Winding path nodes for this journey</p>
                    <button
                      type="button"
                      onClick={() => {
                        setAddNodePanelOpen(true);
                        setAddNodeStep(1);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-teal-500/20 border border-teal-300/40 px-3 py-1.5 text-sm font-semibold text-teal-200"
                    >
                      <Plus className="size-4" /> Add Node
                    </button>
                  </div>

                  <div className="space-y-4">
                    {nodes.map((n, i) => (
                      <div key={n.id}>
                        <div
                          className="rounded-xl border border-slate-700 bg-slate-900/60 p-3"
                          draggable
                          onDragStart={() => setDragNodeId(n.id)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            void onDropNode(n.id);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-semibold ${nodeMeta[n.node_type].color}`}>
                              {nodeMeta[n.node_type].icon}
                              {nodeMeta[n.node_type].label}
                            </span>
                            <button type="button" onClick={() => void deleteNode(n.id)} className="text-rose-300 hover:text-rose-200">
                              <Trash2 className="size-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                              value={n.title || ''}
                              onChange={(e) => setNodes((prev) => prev.map((x) => (x.id === n.id ? { ...x, title: e.target.value } : x)))}
                              onBlur={(e) => void updateNode(n.id, { title: e.target.value })}
                              className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                              placeholder="Node title"
                            />
                            <input
                              type="number"
                              value={n.xp_reward}
                              onChange={(e) => setNodes((prev) => prev.map((x) => (x.id === n.id ? { ...x, xp_reward: Number(e.target.value) || 0 } : x)))}
                              onBlur={(e) => void updateNode(n.id, { xp_reward: Number(e.target.value) || 0 })}
                              className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                              placeholder="XP"
                            />
                            <select
                              value={n.node_type}
                              onChange={(e) => void updateNode(n.id, { node_type: e.target.value as JourneyNode['node_type'] })}
                              className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                            >
                              {Object.keys(nodeMeta).map((k) => (
                                <option key={k} value={k}>{nodeMeta[k as JourneyNode['node_type']].label}</option>
                              ))}
                            </select>
                            <select
                              value={n.content_id || ''}
                              onChange={(e) => void updateNode(n.id, { content_id: e.target.value || null })}
                              className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                            >
                              <option value="">Content id</option>
                              {activities.map((a) => (
                                <option key={a.id} value={a.id}>[{a.activity_type}] {a.title}</option>
                              ))}
                            </select>
                          </div>
                          {savingNodeId === n.id && (
                            <p className="mt-2 text-[11px] text-slate-400 inline-flex items-center gap-1">
                              <Save className="size-3" /> Saving...
                            </p>
                          )}
                        </div>
                        {i < nodes.length - 1 && <div className="ml-6 my-2 h-5 border-l-2 border-dashed border-slate-600" />}
                      </div>
                    ))}
                    {nodes.length === 0 && <p className="text-sm text-slate-400">No nodes yet. Use Add Node to start this journey.</p>}
                  </div>
                </div>

                <aside className="lg:col-span-4 border-l border-slate-700 bg-slate-900/50 p-4 overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs uppercase tracking-widest font-black text-slate-300">Add Node Flow</p>
                    <button
                      type="button"
                      onClick={() => setAddNodePanelOpen((v) => !v)}
                      className="text-xs text-teal-200"
                    >
                      {addNodePanelOpen ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {!addNodePanelOpen ? (
                    <p className="text-sm text-slate-400">Open this panel to create a node in 3 steps.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-2 text-xs">
                        {[1, 2, 3].map((step) => (
                          <button
                            key={step}
                            type="button"
                            onClick={() => setAddNodeStep(step as 1 | 2 | 3)}
                            className={`rounded px-2 py-1 border ${addNodeStep === step ? 'border-teal-300 text-teal-200' : 'border-slate-600 text-slate-400'}`}
                          >
                            Step {step}
                          </button>
                        ))}
                      </div>

                      {addNodeStep === 1 && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-white">Choose type</p>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(nodeMeta).map(([k, meta]) => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => setAddNodeDraft((prev) => ({ ...prev, node_type: k as JourneyNode['node_type'] }))}
                                className={`rounded-lg border px-2 py-2 text-xs ${addNodeDraft.node_type === k ? 'border-teal-300 bg-teal-500/10' : 'border-slate-600'}`}
                              >
                                {meta.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {addNodeStep === 2 && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-white">Choose content</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setAddNodeDraft((prev) => ({ ...prev, useInlineCreator: false }))}
                              className={`rounded-lg border px-2 py-2 text-xs ${
                                !addNodeDraft.useInlineCreator ? 'border-teal-300 bg-teal-500/10 text-teal-200' : 'border-slate-600 text-slate-300'
                              }`}
                            >
                              Pick from bank
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddNodeDraft((prev) => ({ ...prev, useInlineCreator: true }))}
                              className={`rounded-lg border px-2 py-2 text-xs ${
                                addNodeDraft.useInlineCreator ? 'border-teal-300 bg-teal-500/10 text-teal-200' : 'border-slate-600 text-slate-300'
                              }`}
                            >
                              Create new activity
                            </button>
                          </div>

                          {!addNodeDraft.useInlineCreator ? (
                            <>
                              <select
                                value={addNodeDraft.content_id}
                                onChange={(e) => {
                                  const id = e.target.value;
                                  const picked = activities.find((a) => a.id === id);
                                  setAddNodeDraft((prev) => ({
                                    ...prev,
                                    content_id: id,
                                    title: picked?.title || prev.title,
                                    node_type: picked ? mapActivityToNodeType(picked.activity_type) : prev.node_type,
                                    xp_reward: Number(picked?.xp_reward || prev.xp_reward),
                                  }));
                                }}
                                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                              >
                                <option value="">Pick from Activity Bank</option>
                                {activities.map((a) => (
                                  <option key={a.id} value={a.id}>[{a.activity_type}] {a.title}</option>
                                ))}
                              </select>
                              <input
                                value={addNodeDraft.content_url}
                                onChange={(e) => setAddNodeDraft((prev) => ({ ...prev, content_url: e.target.value }))}
                                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                                placeholder="Optional URL"
                              />
                            </>
                          ) : (
                            <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  ['video', 'Explainer Video'],
                                  ['reading', 'Reading/Text'],
                                  ['tool', 'Interactive Tool'],
                                  ['challenge', 'Challenge'],
                                  ['quiz', 'Quick Quiz'],
                                  ['interactive', 'STEMverse Mission'],
                                ].map(([value, label]) => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() =>
                                      setAddNodeDraft((prev) => ({
                                        ...prev,
                                        newActivityType: value as ActivityBankItem['activity_type'],
                                      }))
                                    }
                                    className={`rounded-lg border px-2 py-2 text-xs ${
                                      addNodeDraft.newActivityType === value
                                        ? 'border-teal-300 bg-teal-500/10 text-teal-200'
                                        : 'border-slate-600 text-slate-300'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                              <textarea
                                value={addNodeDraft.newActivityDescription}
                                onChange={(e) => setAddNodeDraft((prev) => ({ ...prev, newActivityDescription: e.target.value }))}
                                className="min-h-[72px] w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                                placeholder="Description"
                              />
                              {addNodeDraft.newActivityType === 'video' && (
                                <>
                                  <input
                                    value={addNodeDraft.videoUrl}
                                    onChange={(e) => setAddNodeDraft((prev) => ({ ...prev, videoUrl: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                                    placeholder="Video URL"
                                  />
                                  <textarea
                                    value={addNodeDraft.videoTranscript}
                                    onChange={(e) => setAddNodeDraft((prev) => ({ ...prev, videoTranscript: e.target.value }))}
                                    className="min-h-[64px] w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                                    placeholder="Transcript (optional)"
                                  />
                                </>
                              )}
                              {addNodeDraft.newActivityType === 'reading' && (
                                <textarea
                                  value={addNodeDraft.readingBody}
                                  onChange={(e) => setAddNodeDraft((prev) => ({ ...prev, readingBody: e.target.value }))}
                                  className="min-h-[96px] w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                                  placeholder="Reading content/body"
                                />
                              )}
                              {addNodeDraft.newActivityType === 'tool' && (
                                <>
                                  <select
                                    value={addNodeDraft.toolType}
                                    onChange={(e) => setAddNodeDraft((prev) => ({ ...prev, toolType: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                                  >
                                    <option value="circuit_builder">Circuit Builder</option>
                                    <option value="arduino_ide">Arduino IDE</option>
                                    <option value="simulation">Simulation</option>
                                  </select>
                                  <textarea
                                    value={addNodeDraft.toolEmbedCode}
                                    onChange={(e) => setAddNodeDraft((prev) => ({ ...prev, toolEmbedCode: e.target.value }))}
                                    className="min-h-[80px] w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                                    placeholder="Embed code / config"
                                  />
                                </>
                              )}
                              {addNodeDraft.newActivityType === 'challenge' && (
                                <select
                                  value={addNodeDraft.challengeId}
                                  onChange={(e) => setAddNodeDraft((prev) => ({ ...prev, challengeId: e.target.value }))}
                                  className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                                >
                                  <option value="">Pick challenge</option>
                                  {challenges.map((c) => (
                                    <option key={c.id} value={c.id}>{c.title}</option>
                                  ))}
                                </select>
                              )}
                              {addNodeDraft.newActivityType === 'quiz' && (
                                <select
                                  value={addNodeDraft.quizId}
                                  onChange={(e) => setAddNodeDraft((prev) => ({ ...prev, quizId: e.target.value }))}
                                  className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                                >
                                  <option value="">Pick quiz</option>
                                  {quizzes.map((q) => (
                                    <option key={q.id} value={q.id}>{q.title}</option>
                                  ))}
                                </select>
                              )}
                              {addNodeDraft.newActivityType === 'interactive' && (
                                <>
                                  <select
                                    value={addNodeDraft.content_id}
                                    onChange={(e) => setAddNodeDraft((prev) => ({ ...prev, content_id: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                                  >
                                    <option value="">Reference mission (optional)</option>
                                    {missions.map((m) => (
                                      <option key={m.id} value={m.id}>{m.title}</option>
                                    ))}
                                  </select>
                                  <textarea
                                    value={addNodeDraft.missionEmbedCode}
                                    onChange={(e) => setAddNodeDraft((prev) => ({ ...prev, missionEmbedCode: e.target.value }))}
                                    className="min-h-[80px] w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                                    placeholder="Mission embed code"
                                  />
                                </>
                              )}
                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  value={addNodeDraft.newActivityDifficulty}
                                  onChange={(e) => setAddNodeDraft((prev) => ({ ...prev, newActivityDifficulty: e.target.value }))}
                                  className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                                >
                                  <option value="beginner">Beginner</option>
                                  <option value="intermediate">Intermediate</option>
                                  <option value="advanced">Advanced</option>
                                </select>
                                <input
                                  type="number"
                                  value={addNodeDraft.newActivityMinutes}
                                  onChange={(e) => setAddNodeDraft((prev) => ({ ...prev, newActivityMinutes: Number(e.target.value) || 0 }))}
                                  className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                                  placeholder="Minutes"
                                />
                              </div>
                              <input
                                value={addNodeDraft.newActivityTags}
                                onChange={(e) => setAddNodeDraft((prev) => ({ ...prev, newActivityTags: e.target.value }))}
                                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                                placeholder="Tags (comma separated)"
                              />
                              <select
                                value={addNodeDraft.saveScope}
                                onChange={(e) =>
                                  setAddNodeDraft((prev) => ({
                                    ...prev,
                                    saveScope: e.target.value as AddNodeDraft['saveScope'],
                                  }))
                                }
                                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                              >
                                <option value="my">Save to My Library</option>
                                <option value="school">Save to School Bank</option>
                                <option value="default">Save as STEMverse Default</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => void createInlineActivity()}
                                disabled={creatingInlineActivity}
                                className="w-full rounded-lg border border-emerald-300/40 bg-emerald-500/20 px-2 py-2 text-sm font-semibold text-emerald-200 disabled:opacity-60"
                              >
                                {creatingInlineActivity ? 'Saving activity...' : 'Create and attach activity'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {addNodeStep === 3 && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-white">Configure node</p>
                          <input
                            value={addNodeDraft.title}
                            onChange={(e) => setAddNodeDraft((prev) => ({ ...prev, title: e.target.value }))}
                            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                            placeholder="Node title"
                          />
                          <input
                            type="number"
                            value={addNodeDraft.xp_reward}
                            onChange={(e) => setAddNodeDraft((prev) => ({ ...prev, xp_reward: Number(e.target.value) || 0 }))}
                            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
                            placeholder="XP"
                          />
                          <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={addNodeDraft.needsPrevious}
                              onChange={(e) => setAddNodeDraft((prev) => ({ ...prev, needsPrevious: e.target.checked }))}
                            />
                            Requires previous node
                          </label>
                          <button
                            type="button"
                            onClick={() => void createConfiguredNode()}
                            className="w-full mt-2 rounded-lg bg-teal-500/20 border border-teal-300/40 px-3 py-2 text-sm font-semibold text-teal-200"
                          >
                            Add Node To Journey
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </aside>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
