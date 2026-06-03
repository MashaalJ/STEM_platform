/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Save, CheckCircle2, Sparkles, RotateCcw } from 'lucide-react';
import { fetchWithAuth } from '../../app/api';
import {
  normalizeCurriculumTrack,
  CURRICULUM_TRACK_LABELS,
} from '../../../lib/rosterCredentials';

export type CurriculumMissionRow = {
  id: string;
  title: string;
  description?: string;
  effective_title?: string;
  effective_description?: string;
  is_enabled: boolean;
  custom_order: number | null;
  custom_title: string | null;
  custom_description: string | null;
  unlock_after_mission_id: string | null;
  has_override?: boolean;
  xp_reward?: number;
  difficulty?: string;
};

export type CurriculumSectorBlock = {
  sector: { id: string; name: string; description?: string };
  missions: CurriculumMissionRow[];
};

type Props = {
  /** Class UUID, or omit for default curriculum mode */
  classId?: string | null;
  mode?: 'class' | 'default' | 'advanced';
  title?: string;
  subtitle?: string;
  onTrackSaved?: (track: string) => void;
};

function SortableMissionRow({
  mission,
  sectorMissions,
  expanded,
  onToggleExpand,
  onChange,
}: {
  mission: CurriculumMissionRow;
  sectorMissions: CurriculumMissionRow[];
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (patch: Partial<CurriculumMissionRow>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: mission.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border bg-white ${mission.is_enabled ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}
    >
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-amber-600 p-1"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-5" />
        </button>
        <label className="flex items-center gap-2 shrink-0">
          <input
            type="checkbox"
            checked={mission.is_enabled}
            onChange={(e) => onChange({ is_enabled: e.target.checked })}
            className="size-4 rounded accent-amber-500"
          />
          <span className="text-[10px] font-black uppercase text-slate-400">On</span>
        </label>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate text-sm">
            {mission.custom_title || mission.effective_title || mission.title}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {mission.difficulty || 'Mission'}
            {mission.xp_reward != null ? ` · +${mission.xp_reward} XP` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleExpand}
          className="text-xs font-bold text-indigo-600 uppercase tracking-wide shrink-0"
        >
          {expanded ? 'Hide' : 'Edit'}
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-slate-100">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500">Custom title</label>
            <input
              value={mission.custom_title ?? ''}
              onChange={(e) => onChange({ custom_title: e.target.value || null })}
              placeholder={mission.title}
              className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500">Custom description</label>
            <textarea
              value={mission.custom_description ?? ''}
              onChange={(e) => onChange({ custom_description: e.target.value || null })}
              placeholder={mission.description || ''}
              className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[72px]"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500">Unlocks after</label>
            <select
              value={mission.unlock_after_mission_id ?? ''}
              onChange={(e) => onChange({ unlock_after_mission_id: e.target.value || null })}
              className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Global default / none</option>
              {sectorMissions
                .filter((m) => m.id !== mission.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.custom_title || m.title}
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CurriculumEditor({
  classId,
  mode = 'class',
  title = 'Class curriculum',
  subtitle = 'Choose which missions appear and in what order for this class.',
  onTrackSaved,
}: Props) {
  const [sectors, setSectors] = useState<CurriculumSectorBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [curriculumTrack, setCurriculumTrack] = useState('core_stem');
  const [trackSaving, setTrackSaving] = useState(false);
  const [expandedMission, setExpandedMission] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Record<string, CurriculumMissionRow>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<string[] | null>(null);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);
  const [diagnosticsCooldownUntil, setDiagnosticsCooldownUntil] = useState<number>(0);

  const loadUrl =
    mode === 'default'
      ? '/api/default-curriculum'
      : mode === 'advanced'
        ? '/api/advanced-curriculum'
        : !classId
          ? '/api/default-curriculum'
          : `/api/classes/${classId}/curriculum`;

  const patchUrl =
    mode === 'default'
      ? '/api/default-curriculum'
      : mode === 'advanced'
        ? '/api/advanced-curriculum'
        : !classId
          ? '/api/default-curriculum'
          : `/api/classes/${classId}/curriculum`;

  const load = useCallback(async () => {
    if (mode === 'class' && !classId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(loadUrl);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // Fallback to default curriculum so teachers can still edit a baseline path
        // even when a class-scoped curriculum read fails.
        if (mode === 'class') {
          const fallbackRes = await fetchWithAuth('/api/default-curriculum');
          const fallback = await fallbackRes.json().catch(() => null);
          if (fallbackRes.ok) {
            const blocks = (fallback?.sectors || []) as CurriculumSectorBlock[];
            setSectors(blocks);
            setSelectedSectorId(blocks.length ? String(blocks[0].sector.id) : null);
            setDirty({});
            setError(data?.error || 'Could not load class curriculum. Showing default curriculum.');
            return;
          }
        }
        setError(data?.error || 'Could not load curriculum');
        setSectors([]);
        return;
      }
      const blocks = (data?.sectors || []) as CurriculumSectorBlock[];
      setSectors(blocks);
      if (blocks.length > 0) {
        setSelectedSectorId((prev) =>
          prev && blocks.some((b) => String(b.sector.id) === prev)
            ? prev
            : String(blocks[0].sector.id),
        );
      } else {
        setSelectedSectorId(null);
      }
      setDirty({});
    } finally {
      setLoading(false);
    }
  }, [classId, loadUrl, mode]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (mode !== 'class' || !classId) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetchWithAuth('/api/classes');
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !alive) return;
        const classes = Array.isArray(data) ? data : Array.isArray(data?.classes) ? data.classes : [];
        const current = classes.find((c: { id: string; curriculum_track?: string | null }) => String(c.id) === String(classId));
        if (current?.curriculum_track && alive) {
          setCurriculumTrack(normalizeCurriculumTrack(current.curriculum_track));
        }
      } catch {
        // Non-blocking: editor still works without this metadata.
      }
    })();
    return () => {
      alive = false;
    };
  }, [classId, mode]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const getMission = (sectorId: string, missionId: string): CurriculumMissionRow | undefined => {
    const dirtyRow = dirty[missionId];
    if (dirtyRow) return dirtyRow;
    const block = sectors.find((s) => String(s.sector.id) === sectorId);
    return block?.missions.find((m) => m.id === missionId);
  };

  const updateMission = (missionId: string, sectorId: string, patch: Partial<CurriculumMissionRow>) => {
    const current = getMission(sectorId, missionId);
    if (!current) return;
    setDirty((prev) => ({
      ...prev,
      [missionId]: { ...current, ...patch },
    }));
    setSaved(false);
  };

  const handleDragEnd = (sectorId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSectors((prev) =>
      prev.map((block) => {
        if (String(block.sector.id) !== sectorId) return block;
        const ids = block.missions.map((m) => m.id);
        const oldIndex = ids.indexOf(String(active.id));
        const newIndex = ids.indexOf(String(over.id));
        if (oldIndex < 0 || newIndex < 0) return block;
        const reordered = arrayMove<CurriculumMissionRow>(block.missions, oldIndex, newIndex).map((m, i) => {
          const merged: CurriculumMissionRow = dirty[m.id] ? { ...m, ...dirty[m.id] } : m;
          return { ...merged, custom_order: i + 1 };
        });
        const nextDirty: Record<string, CurriculumMissionRow> = { ...dirty };
        reordered.forEach((m) => {
          nextDirty[m.id] = { ...(dirty[m.id] || m), custom_order: m.custom_order };
        });
        setDirty(nextDirty);
        setSaved(false);
        return { ...block, missions: reordered };
      }),
    );
  };

  const dirtyCount = useMemo(() => Object.keys(dirty).length, [dirty]);

  const saveAll = async () => {
    if (!dirtyCount) return;
    setSaving(true);
    setError(null);
    try {
      for (const [missionId, row] of Object.entries(dirty) as [string, CurriculumMissionRow][]) {
        const res = await fetchWithAuth(patchUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mission_id: missionId,
            is_enabled: row.is_enabled,
            custom_order: row.custom_order,
            custom_title: row.custom_title,
            custom_description: row.custom_description,
            unlock_after_mission_id: row.unlock_after_mission_id,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || data.message || 'Save failed');
        }
      }
      setSaved(true);
      setDirty({});
      await load();
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveTrack = async () => {
    if (mode !== 'class' || !classId || !curriculumTrack.trim()) return;
    setTrackSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/classes/${classId}/curriculum-track`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curriculum_track: curriculumTrack }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || 'Could not save curriculum track');
      }
      onTrackSaved?.(curriculumTrack);
      setDirty({});
      await load();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save curriculum track');
    } finally {
      setTrackSaving(false);
    }
  };

  const trackHelp =
    curriculumTrack === 'core_stem'
      ? 'Uses the global Core STEM mission preset (same baseline for all classes on this track).'
      : curriculumTrack === 'advanced'
        ? 'Uses the STEMverse Advanced preset. Save track to reload missions.'
        : 'Uses missions you enable and order for this class only.';

  const runDiagnostics = async () => {
    if (mode !== 'class' || !classId) return;
    const now = Date.now();
    if (now < diagnosticsCooldownUntil) {
      const waitSec = Math.max(1, Math.ceil((diagnosticsCooldownUntil - now) / 1000));
      setDiagnostics([`FAIL: diagnostics endpoint — rate limited. Retry in ${waitSec}s.`]);
      return;
    }
    if (diagnosticsBusy) return;
    setDiagnosticsBusy(true);
    setDiagnostics(null);
    try {
      const res = await fetchWithAuth(`/api/classes/${classId}/curriculum-diagnostics`);
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        const retryAfterRaw = res.headers.get('retry-after');
        const retryAfterSec = Number(retryAfterRaw);
        const waitSec = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec : 20;
        setDiagnosticsCooldownUntil(Date.now() + waitSec * 1000);
        setDiagnostics([`FAIL: diagnostics endpoint — too many requests. Retry in ${waitSec}s.`]);
        return;
      }
      const checks = Array.isArray(data?.checks) ? data.checks : [];
      if (checks.length) {
        setDiagnostics(
          checks.map(
            (c: { name: string; ok: boolean; detail: string }) =>
              `${c.ok ? 'OK' : 'FAIL'}: ${c.name} — ${c.detail}`,
          ),
        );
        return;
      }
      const directError = data?.error || data?.message;
      if (directError) {
        setDiagnostics([`FAIL: diagnostics endpoint — ${String(directError)}`]);
        return;
      }
      setDiagnostics([`FAIL: diagnostics endpoint — empty response (HTTP ${res.status})`]);
    } catch (e) {
      setDiagnostics([`FAIL: diagnostics request — ${e instanceof Error ? e.message : 'network/auth error'}`]);
    } finally {
      setDiagnosticsBusy(false);
    }
  };

  const setSectorEnabledState = (enabled: boolean) => {
    if (!activeBlock) return;
    const sectorId = String(activeBlock.sector.id);
    setDirty((prev) => {
      const next = { ...prev };
      activeMissions.forEach((mission, index) => {
        const base = getMission(sectorId, mission.id) || mission;
        next[mission.id] = {
          ...base,
          is_enabled: enabled,
          custom_order: base.custom_order ?? index + 1,
        };
      });
      return next;
    });
    setSaved(false);
  };

  if (mode === 'class' && !classId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500 text-sm">
        Select a class to edit its curriculum.
      </div>
    );
  }

  const activeBlock = useMemo(
    () => sectors.find((b) => String(b.sector.id) === selectedSectorId) ?? null,
    [sectors, selectedSectorId],
  );

  const activeMissions = useMemo(() => {
    if (!activeBlock) return [];
    return activeBlock.missions.map((m) => (dirty[m.id] ? { ...m, ...dirty[m.id] } : m));
  }, [activeBlock, dirty]);

  const sectorAccent = (index: number) => {
    const accents = ['border-teal-500', 'border-amber-500', 'border-indigo-500', 'border-rose-500'];
    return accents[index % accents.length];
  };

  if (loading) {
    return <p className="text-slate-500 text-sm p-6">Loading curriculum…</p>;
  }

  return (
    <div className="flex flex-col min-h-[520px] rounded-2xl border border-slate-200 bg-slate-100 overflow-hidden shadow-sm">
      <header className="bg-[#0A192F] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-[#1B2B44]">
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="text-xs text-slate-300 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Curriculum track
            <select
              value={curriculumTrack}
              onChange={(e) => setCurriculumTrack(normalizeCurriculumTrack(e.target.value))}
              className="mt-1 block rounded-lg border border-[#1B2B44] bg-[#0D1C32] text-white text-xs px-3 py-2 min-w-[160px]"
            >
              <option value="core_stem">{CURRICULUM_TRACK_LABELS.core_stem}</option>
              <option value="advanced">{CURRICULUM_TRACK_LABELS.advanced}</option>
              <option value="custom">{CURRICULUM_TRACK_LABELS.custom}</option>
            </select>
            <p className="mt-1 text-[10px] text-slate-400 max-w-xs leading-snug">{trackHelp}</p>
          </label>
          {mode === 'class' && classId && (
            <button
              type="button"
              onClick={() => void saveTrack()}
              disabled={trackSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-teal-400/40 text-teal-200 text-xs font-bold uppercase tracking-widest hover:bg-white/10 disabled:opacity-50"
            >
              <Save className="size-4" />
              {trackSaving ? 'Saving track…' : 'Save track'}
            </button>
          )}
          {dirtyCount > 0 && (
            <button
              type="button"
              onClick={saveAll}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-500 text-[#0A192F] font-black text-xs uppercase tracking-widest disabled:opacity-50"
            >
              {saved ? <CheckCircle2 className="size-4" /> : <Save className="size-4" />}
              {saving ? 'Saving…' : saved ? 'Saved' : `Save (${dirtyCount})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reload curriculum from server? Unsaved changes will be lost.')) {
                setDirty({});
                void load();
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-500 text-slate-200 text-xs font-bold uppercase tracking-widest hover:bg-white/10"
          >
            <RotateCcw className="size-4" />
            Reset
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 space-y-3">
          <p>{error}</p>
          {mode === 'class' && classId && (
            <button
              type="button"
              onClick={() => void runDiagnostics()}
              disabled={diagnosticsBusy || Date.now() < diagnosticsCooldownUntil}
              className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-700 disabled:opacity-50"
            >
              {diagnosticsBusy ? 'Running diagnostics…' : 'Run diagnostics'}
            </button>
          )}
          {diagnostics && (
            <div className="rounded-lg border border-red-200 bg-white p-2 text-xs text-red-900 font-mono space-y-1">
              {diagnostics.map((line, idx) => (
                <p key={`${line}-${idx}`}>{line}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        <aside className="lg:w-[35%] border-b lg:border-b-0 lg:border-r border-slate-200 bg-white p-4 overflow-y-auto">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Sectors</p>
          <div className="space-y-2">
            {sectors.map((block, i) => {
              const sectorId = String(block.sector.id);
              const selected = sectorId === selectedSectorId;
              const enabled = block.missions.filter((m) => m.is_enabled).length;
              return (
                <button
                  key={sectorId}
                  type="button"
                  onClick={() => {
                    setSelectedSectorId(sectorId);
                    setExpandedMission(null);
                  }}
                  className={`w-full text-left rounded-xl border-l-4 bg-white p-4 shadow-sm transition-all hover:shadow-md ${
                    sectorAccent(i)
                  } ${selected ? 'ring-2 ring-teal-500/40 border-teal-500' : 'border-slate-200 opacity-90'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#0A192F]/5 text-teal-600">
                      <Sparkles className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{block.sector.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {enabled}/{block.missions.length} missions on
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {!sectors.length && (
            <p className="text-sm text-slate-500 py-6 text-center">No sectors found.</p>
          )}
        </aside>

        <section className="flex-1 bg-slate-50 p-4 sm:p-6 overflow-y-auto min-h-[320px]">
          {!activeBlock ? (
            <div className="h-full flex items-center justify-center text-center p-8">
              <p className="text-slate-500 text-sm max-w-xs">
                Select a sector on the left to customise its missions.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <h4 className="text-lg font-bold text-slate-900">{activeBlock.sector.name}</h4>
                <p className="text-xs text-slate-500">Drag to reorder · toggle to enable/disable</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSectorEnabledState(true)}
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700"
                  >
                    Enable all in sector
                  </button>
                  <button
                    type="button"
                    onClick={() => setSectorEnabledState(false)}
                    className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-700"
                  >
                    Disable all in sector
                  </button>
                </div>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => handleDragEnd(String(activeBlock.sector.id), e)}
              >
                <SortableContext items={activeMissions.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {activeMissions.map((mission) => (
                      <div key={mission.id}>
                      <SortableMissionRow
                        mission={mission}
                        sectorMissions={activeMissions}
                        expanded={expandedMission === mission.id}
                        onToggleExpand={() =>
                          setExpandedMission((cur) => (cur === mission.id ? null : mission.id))
                        }
                        onChange={(patch) => updateMission(mission.id, String(activeBlock.sector.id), patch)}
                      />
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              {!activeMissions.length && (
                <p className="text-sm text-slate-500 text-center py-10">No missions in this sector yet.</p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
