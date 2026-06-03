/**
 * Admin content management — sectors, domains, and missions without code changes.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Archive, ChevronRight, Layers, Map, Plus, Trash2, X } from 'lucide-react';
import { fetchWithAuth } from '../../app/api';
import type { Mission, Sector } from '../../app/types';
import MissionScreenBuilder from '../tool-activity/MissionScreenBuilder';
import {
  defaultBuilderState,
  parseScreensActivityEmbed,
  parseToolActivityEmbed,
  type MissionScreensEmbedConfig,
  type ToolActivityConfig,
} from '../../lib/toolActivity';

export interface ContentDomain {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
}

type AdminSector = Sector & {
  theme_color?: string | null;
  icon?: string | null;
  unlock_sector_id?: string | null;
  unlock_mastery_percent?: number;
  domain_ids?: string[] | null;
  student_count?: number;
};

type EmbedType = 'screens-activity' | 'tool-activity' | 'arduino-blockly' | 'electricity' | 'custom';

const EMBED_TYPES: { id: EmbedType; label: string }[] = [
  { id: 'screens-activity', label: 'Screens activity' },
  { id: 'tool-activity', label: 'Tool activity' },
  { id: 'arduino-blockly', label: 'Arduino Blockly' },
  { id: 'electricity', label: 'Electricity lab' },
  { id: 'custom', label: 'Custom URL' },
];

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0D1C32] focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none';

const labelClass = 'block text-[10px] uppercase font-black text-slate-500 tracking-[0.15em]';

const slidePanelMotion = {
  initial: { x: '100%' as const },
  animate: { x: 0 },
  exit: { x: '100%' as const },
  transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
};

function statusBadge(status: string) {
  const s = String(status || 'locked').toLowerCase();
  const styles: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800',
    locked: 'bg-amber-100 text-amber-800',
    archived: 'bg-slate-200 text-slate-600',
    maintenance: 'bg-orange-100 text-orange-800',
  };
  return (
    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${styles[s] || styles.locked}`}>
      {s}
    </span>
  );
}

function parseOutcomes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function detectEmbedType(embed?: string | null): EmbedType {
  const v = String(embed || '').trim().toLowerCase();
  if (!v) return 'custom';
  if (parseScreensActivityEmbed(embed)) return 'screens-activity';
  if (parseToolActivityEmbed(embed)) return 'tool-activity';
  if (v.includes('arduino')) return 'arduino-blockly';
  if (v.includes('electricity')) return 'electricity';
  return 'custom';
}

function customUrlFromEmbed(embed?: string | null): string {
  const v = String(embed || '').trim();
  if (!v || v.startsWith('stemverse://')) return '';
  return v;
}

function defaultScreensConfig(): MissionScreensEmbedConfig {
  return { title: '', subject: 'STEM', grade: '6-8', screens: [] };
}

type SectorFormState = {
  name: string;
  description: string;
  theme_color: string;
  icon: string;
  level_lock: number;
  unlock_sector_id: string;
  unlock_mastery_percent: number;
  domain_ids: string[];
  status: string;
  image_url: string;
};

const emptySectorForm = (): SectorFormState => ({
  name: '',
  description: '',
  theme_color: '#6366f1',
  icon: '🚀',
  level_lock: 1,
  unlock_sector_id: '',
  unlock_mastery_percent: 80,
  domain_ids: [],
  status: 'locked',
  image_url: '',
});

type MissionFormState = {
  title: string;
  description: string;
  xp_reward: number;
  difficulty: string;
  domain_id: string;
  embed_type: EmbedType;
  custom_embed_url: string;
  prerequisites: string[];
  learning_outcomes: string[];
  outcomeDraft: string;
};

const emptyMissionForm = (): MissionFormState => ({
  title: '',
  description: '',
  xp_reward: 100,
  difficulty: 'beginner',
  domain_id: '',
  embed_type: 'tool-activity',
  custom_embed_url: '',
  prerequisites: [],
  learning_outcomes: [],
  outcomeDraft: '',
});

function DomainManager({
  domains,
  onRefresh,
  onNotice,
}: {
  domains: ContentDomain[];
  onRefresh: () => void;
  onNotice: (msg: string) => void;
}) {
  const [editing, setEditing] = useState<ContentDomain | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '', color: '#6366f1', icon: '🔬' });
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setDraft({ name: '', description: '', color: '#6366f1', icon: '🔬' });
  };

  const openEdit = (d: ContentDomain) => {
    setCreating(false);
    setEditing(d);
    setDraft({
      name: d.name,
      description: d.description || '',
      color: d.color || '#6366f1',
      icon: d.icon || '🔬',
    });
  };

  const save = async () => {
    if (!draft.name.trim()) {
      onNotice('Domain name is required.');
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/domains/${editing.id}` : '/api/domains';
      const res = await fetchWithAuth(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name.trim(),
          description: draft.description.trim(),
          color: draft.color,
          icon: draft.icon,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        onNotice(data?.message || 'Could not save domain.');
        return;
      }
      setCreating(false);
      setEditing(null);
      onRefresh();
      onNotice(editing ? 'Domain updated.' : 'Domain created.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this domain? Missions referencing it will lose the link.')) return;
    const res = await fetchWithAuth(`/api/domains/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      onNotice(data?.message || 'Could not delete domain.');
      return;
    }
    onRefresh();
    onNotice('Domain deleted.');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(10,25,47,0.05)] p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Layers className="size-5 text-amber-500" />
          <h3 className="text-xl font-semibold text-[#0D1C32]">Domain Manager</h3>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1 rounded-lg bg-[#0A192F] px-3 py-1.5 text-xs font-semibold text-white"
        >
          <Plus className="size-3.5" /> Add domain
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <th className="py-2 pr-3">Icon</th>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Color</th>
              <th className="py-2 pr-3">Description</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {domains.map((d) => (
              <tr key={d.id} className="border-b border-slate-50">
                <td className="py-3 pr-3 text-lg">{d.icon || '—'}</td>
                <td className="py-3 pr-3 font-medium text-[#0D1C32]">{d.name}</td>
                <td className="py-3 pr-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="size-4 rounded border border-slate-200" style={{ background: d.color || '#ccc' }} />
                    <span className="font-mono text-xs text-slate-500">{d.color || '—'}</span>
                  </span>
                </td>
                <td className="py-3 pr-3 text-slate-600 max-w-xs truncate">{d.description || '—'}</td>
                <td className="py-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEdit(d)} className="text-xs font-bold text-amber-700">
                      Edit
                    </button>
                    <button type="button" onClick={() => remove(d.id)} className="text-xs font-bold text-red-600">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!domains.length && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500">
                  No domains yet. Run migration 007_domains.sql or add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {(creating || editing) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[280] flex justify-end"
          >
            <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={() => !saving && (setCreating(false), setEditing(null))} />
            <motion.div
              {...slidePanelMotion}
              className="relative w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-semibold text-[#0D1C32]">{editing ? 'Edit domain' : 'New domain'}</h4>
                <button type="button" onClick={() => !saving && (setCreating(false), setEditing(null))}>
                  <X className="size-5 text-slate-400" />
                </button>
              </div>
              <div className="space-y-4">
                <label className={labelClass}>
                  Name
                  <input className={inputClass} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                </label>
                <label className={labelClass}>
                  Icon (emoji)
                  <input className={inputClass} value={draft.icon} onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))} />
                </label>
                <label className={labelClass}>
                  Color
                  <input type="color" className="mt-1 h-10 w-full rounded-lg border border-slate-300" value={draft.color} onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))} />
                </label>
                <label className={labelClass}>
                  Description
                  <textarea className={`${inputClass} min-h-[80px]`} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
                </label>
                <button type="button" disabled={saving} onClick={save} className="w-full rounded-lg bg-[#0A192F] text-white py-2 text-sm font-semibold disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save domain'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MissionEditorPanel({
  sector,
  mission,
  domains,
  sectorMissions,
  onClose,
  onSaved,
  onNotice,
}: {
  sector: AdminSector;
  mission: Mission | null;
  domains: ContentDomain[];
  sectorMissions: Mission[];
  onClose: () => void;
  onSaved: () => void;
  onNotice: (msg: string) => void;
}) {
  const [form, setForm] = useState<MissionFormState>(() => emptyMissionForm());
  const [toolConfig, setToolConfig] = useState<ToolActivityConfig>(() => defaultBuilderState());
  const [screensConfig, setScreensConfig] = useState<MissionScreensEmbedConfig>(() => defaultScreensConfig());
  const [screensJson, setScreensJson] = useState('');
  const [screensJsonError, setScreensJsonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mission) {
      setForm(emptyMissionForm());
      setToolConfig(defaultBuilderState());
      setScreensConfig(defaultScreensConfig());
      setScreensJson(JSON.stringify(defaultScreensConfig(), null, 2));
      return;
    }
    const embedType = detectEmbedType(mission.embed_code);
    const outcomes = parseOutcomes(mission.learning_outcomes_json);
    setForm({
      title: mission.title,
      description: mission.description || '',
      xp_reward: mission.xp_reward || 100,
      difficulty: mission.difficulty || 'beginner',
      domain_id: String((mission as Mission & { domain_id?: string }).domain_id || ''),
      embed_type: embedType,
      custom_embed_url: customUrlFromEmbed(mission.embed_code),
      prerequisites: mission.prerequisite_mission_id ? [String(mission.prerequisite_mission_id)] : [],
      learning_outcomes: outcomes,
      outcomeDraft: '',
    });
    const parsedTool = parseToolActivityEmbed(mission.embed_code);
    if (parsedTool) setToolConfig(parsedTool);
    const parsedScreens = parseScreensActivityEmbed(mission.embed_code);
    if (parsedScreens) {
      setScreensConfig(parsedScreens);
      setScreensJson(JSON.stringify(parsedScreens, null, 2));
    } else {
      setScreensJson(JSON.stringify(defaultScreensConfig(), null, 2));
    }
  }, [mission]);

  const prereqOptions = useMemo(
    () => sectorMissions.filter((m) => !mission || String(m.id) !== String(mission.id)),
    [sectorMissions, mission],
  );

  const togglePrereq = (id: string) => {
    setForm((f) => {
      const set = new Set(f.prerequisites);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...f, prerequisites: [...set] };
    });
  };

  const addOutcome = () => {
    const t = form.outcomeDraft.trim();
    if (!t) return;
    setForm((f) => ({ ...f, learning_outcomes: [...f.learning_outcomes, t], outcomeDraft: '' }));
  };

  const save = async () => {
    if (!form.title.trim()) {
      onNotice('Mission title is required.');
      return;
    }
    let embed_config: ToolActivityConfig | MissionScreensEmbedConfig | undefined;
    if (form.embed_type === 'tool-activity') {
      embed_config = toolConfig;
    } else if (form.embed_type === 'screens-activity') {
      try {
        embed_config = JSON.parse(screensJson) as MissionScreensEmbedConfig;
        setScreensJsonError(null);
      } catch {
        setScreensJsonError('Invalid JSON for screens config');
        return;
      }
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim(),
        xp_reward: form.xp_reward,
        difficulty: form.difficulty,
        domain_id: form.domain_id || null,
        embed_type: form.embed_type,
        prerequisites: form.prerequisites,
        learning_outcomes: form.learning_outcomes,
        custom_embed_url: form.custom_embed_url.trim() || undefined,
        embed_config,
      };
      const url = mission ? `/api/missions/${mission.id}` : `/api/sectors/${sector.id}/missions`;
      const res = await fetchWithAuth(url, {
        method: mission ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        onNotice(data?.message || 'Could not save mission.');
        return;
      }
      onSaved();
      onClose();
      onNotice(mission ? 'Mission updated.' : 'Mission created.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[290] flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={() => !saving && onClose()} />
      <motion.div
        {...slidePanelMotion}
        className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">{sector.name}</p>
            <h4 className="text-lg font-semibold text-[#0D1C32]">{mission ? 'Edit mission' : 'New mission'}</h4>
          </div>
          <button type="button" onClick={() => !saving && onClose()}>
            <X className="size-5 text-slate-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <label className={labelClass}>
            Title
            <input className={inputClass} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </label>
          <label className={labelClass}>
            Description
            <textarea className={`${inputClass} min-h-[72px]`} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className={labelClass}>
              XP reward
              <input type="number" min={0} className={inputClass} value={form.xp_reward} onChange={(e) => setForm((f) => ({ ...f, xp_reward: Number(e.target.value) || 0 }))} />
            </label>
            <label className={labelClass}>
              Difficulty
              <select className={inputClass} value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className={labelClass}>
            Domain
            <select className={inputClass} value={form.domain_id} onChange={(e) => setForm((f) => ({ ...f, domain_id: e.target.value }))}>
              <option value="">None</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.icon} {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Embed type
            <select className={inputClass} value={form.embed_type} onChange={(e) => setForm((f) => ({ ...f, embed_type: e.target.value as EmbedType }))}>
              {EMBED_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {form.embed_type === 'custom' && (
            <label className={labelClass}>
              Custom URL
              <input className={inputClass} value={form.custom_embed_url} onChange={(e) => setForm((f) => ({ ...f, custom_embed_url: e.target.value }))} placeholder="https://… or /path.html" />
            </label>
          )}
          {form.embed_type === 'tool-activity' && (
            <div className="rounded-xl border border-slate-200 p-4">
              <MissionScreenBuilder config={toolConfig} onChange={setToolConfig} />
            </div>
          )}
          {form.embed_type === 'screens-activity' && (
            <label className={labelClass}>
              Screens config (JSON)
              <textarea
                className={`${inputClass} min-h-[200px] font-mono text-xs`}
                value={screensJson}
                onChange={(e) => {
                  setScreensJson(e.target.value);
                  setScreensJsonError(null);
                }}
              />
              {screensJsonError && <p className="text-xs text-red-600 mt-1">{screensJsonError}</p>}
            </label>
          )}
          <div>
            <span className={labelClass}>Prerequisites</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {prereqOptions.map((m) => {
                const active = form.prerequisites.includes(String(m.id));
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => togglePrereq(String(m.id))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${active ? 'bg-[#0D1C32] text-white border-[#0D1C32]' : 'bg-white text-slate-600 border-slate-300'}`}
                  >
                    {m.title}
                  </button>
                );
              })}
              {!prereqOptions.length && <p className="text-xs text-slate-500">No other missions in this sector yet.</p>}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">First selected prerequisite is enforced as the unlock gate.</p>
          </div>
          <div>
            <span className={labelClass}>Learning outcomes</span>
            <div className="mt-2 flex gap-2">
              <input
                className={inputClass}
                value={form.outcomeDraft}
                onChange={(e) => setForm((f) => ({ ...f, outcomeDraft: e.target.value }))}
                placeholder="Add an outcome…"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOutcome())}
              />
              <button type="button" onClick={addOutcome} className="shrink-0 rounded-lg bg-slate-100 px-3 text-sm font-semibold">
                Add
              </button>
            </div>
            <ul className="mt-2 space-y-1">
              {form.learning_outcomes.map((o, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                  <span>{o}</span>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, learning_outcomes: f.learning_outcomes.filter((_, j) => j !== i) }))}>
                    <Trash2 className="size-3.5 text-red-500" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 shrink-0">
          <button type="button" disabled={saving} onClick={save} className="w-full rounded-lg bg-[#0A192F] text-white py-2.5 text-sm font-semibold disabled:opacity-60">
            {saving ? 'Saving…' : mission ? 'Update mission' : 'Create mission'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ContentManager({
  sectors,
  missions,
  onRefresh,
  onNotice,
}: {
  sectors: Sector[];
  missions: Mission[];
  onRefresh: () => void;
  onNotice: (msg: string) => void;
}) {
  const adminSectors = sectors as AdminSector[];
  const [domains, setDomains] = useState<ContentDomain[]>([]);
  const [sectorPanel, setSectorPanel] = useState<'list' | 'create' | 'edit'>('list');
  const [sectorForm, setSectorForm] = useState<SectorFormState>(() => emptySectorForm());
  const [editingSector, setEditingSector] = useState<AdminSector | null>(null);
  const [savingSector, setSavingSector] = useState(false);
  const [missionEditor, setMissionEditor] = useState<{ sector: AdminSector; mission: Mission | null } | null>(null);
  const [expandedSector, setExpandedSector] = useState<string | null>(null);

  const loadDomains = useCallback(async () => {
    const res = await fetchWithAuth('/api/domains');
    const data = await res.json().catch(() => []);
    setDomains(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  const missionsBySector = useMemo(() => {
    const map = new Map<string, Mission[]>();
    for (const m of missions) {
      const sid = String(m.sector_id);
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid)!.push(m);
    }
    return map;
  }, [missions]);

  const openCreateSector = () => {
    setEditingSector(null);
    setSectorForm(emptySectorForm());
    setSectorPanel('create');
  };

  const openEditSector = (s: AdminSector) => {
    setEditingSector(s);
    setSectorForm({
      name: s.name,
      description: s.description || '',
      theme_color: s.theme_color || '#6366f1',
      icon: s.icon || '🚀',
      level_lock: s.required_level || 1,
      unlock_sector_id: s.unlock_sector_id ? String(s.unlock_sector_id) : '',
      unlock_mastery_percent: s.unlock_mastery_percent ?? 80,
      domain_ids: Array.isArray(s.domain_ids) ? s.domain_ids.map(String) : [],
      status: s.status || 'locked',
      image_url: s.image_url || '',
    });
    setSectorPanel('edit');
  };

  const saveSector = async () => {
    if (!sectorForm.name.trim()) {
      onNotice('Sector name is required.');
      return;
    }
    setSavingSector(true);
    try {
      const body = {
        name: sectorForm.name.trim(),
        description: sectorForm.description.trim(),
        theme_color: sectorForm.theme_color,
        icon: sectorForm.icon,
        level_lock: sectorForm.level_lock,
        unlock_sector_id: sectorForm.unlock_sector_id || null,
        unlock_mastery_percent: sectorForm.unlock_mastery_percent,
        domain_ids: sectorForm.domain_ids,
        status: sectorForm.status,
        image_url: sectorForm.image_url.trim() || undefined,
      };
      const url = sectorPanel === 'edit' && editingSector ? `/api/sectors/${editingSector.id}` : '/api/sectors';
      const res = await fetchWithAuth(url, {
        method: sectorPanel === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        onNotice(data?.message || 'Could not save sector.');
        return;
      }
      setSectorPanel('list');
      setEditingSector(null);
      onRefresh();
      onNotice(sectorPanel === 'edit' ? 'Sector updated.' : 'Sector created.');
    } finally {
      setSavingSector(false);
    }
  };

  const archiveSector = async (s: AdminSector) => {
    if (!window.confirm(`Archive sector "${s.name}"? It will be hidden from students.`)) return;
    const res = await fetchWithAuth(`/api/sectors/${s.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      onNotice(data?.message || 'Could not archive sector.');
      return;
    }
    onRefresh();
    onNotice('Sector archived.');
  };

  const archiveMission = async (m: Mission) => {
    if (!window.confirm(`Archive mission "${m.title}"?`)) return;
    const res = await fetchWithAuth(`/api/missions/${m.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      onNotice(data?.message || 'Could not archive mission.');
      return;
    }
    onRefresh();
    onNotice('Mission archived.');
  };

  const toggleDomain = (id: string) => {
    setSectorForm((f) => {
      const set = new Set(f.domain_ids);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...f, domain_ids: [...set] };
    });
  };

  const unlockOptions = adminSectors.filter((s) => !editingSector || String(s.id) !== String(editingSector.id));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(10,25,47,0.05)] p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Map className="size-5 text-amber-500" />
            <h3 className="text-xl font-semibold text-[#0D1C32]">Sector Manager</h3>
          </div>
          <button type="button" onClick={openCreateSector} className="inline-flex items-center gap-1 rounded-lg bg-[#0A192F] px-3 py-1.5 text-xs font-semibold text-white">
            <Plus className="size-3.5" /> Add sector
          </button>
        </div>

        <div className="space-y-3">
          {adminSectors.map((s) => {
            const sid = String(s.id);
            const sectorMissions = (missionsBySector.get(sid) || []).filter((m) => m.status !== 'archived');
            const expanded = expandedSector === sid;
            return (
              <div key={sid} className="rounded-xl border border-slate-100 bg-slate-50 overflow-hidden">
                <div className="p-4 flex flex-wrap items-center gap-3 justify-between">
                  <button type="button" className="flex items-center gap-2 text-left min-w-0 flex-1" onClick={() => setExpandedSector(expanded ? null : sid)}>
                    <ChevronRight className={`size-4 text-slate-400 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    <span className="text-lg shrink-0">{s.icon || '🗺️'}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0D1C32] truncate">{s.name}</p>
                      <p className="text-xs text-slate-500 truncate">{s.description}</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {statusBadge(s.status)}
                    <span className="text-xs text-slate-500">{s.student_count ?? 0} students</span>
                    <span className="text-xs text-slate-400">{sectorMissions.length} missions</span>
                    <button type="button" onClick={() => openEditSector(s)} className="text-xs font-bold text-amber-700">
                      Edit
                    </button>
                    <button type="button" onClick={() => setMissionEditor({ sector: s, mission: null })} className="text-xs font-bold text-indigo-700">
                      Add mission
                    </button>
                    {s.status !== 'archived' && (
                      <button type="button" onClick={() => archiveSector(s)} className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                        <Archive className="size-3" /> Archive
                      </button>
                    )}
                  </div>
                </div>
                {expanded && (
                  <div className="border-t border-slate-100 bg-white px-4 py-3 space-y-2">
                    {sectorMissions.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 py-2 border-b border-slate-50 last:border-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#0D1C32] truncate">{m.title}</p>
                          <p className="text-xs text-slate-500">+{m.xp_reward} XP · {m.difficulty}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button type="button" onClick={() => setMissionEditor({ sector: s, mission: m })} className="text-xs font-bold text-amber-700">
                            Edit
                          </button>
                          <button type="button" onClick={() => archiveMission(m)} className="text-xs font-bold text-red-600">
                            Archive
                          </button>
                        </div>
                      </div>
                    ))}
                    {!sectorMissions.length && <p className="text-xs text-slate-500 py-2">No missions in this sector.</p>}
                  </div>
                )}
              </div>
            );
          })}
          {!adminSectors.length && <p className="text-sm text-slate-500">No sectors yet.</p>}
        </div>
      </div>

      <DomainManager domains={domains} onRefresh={loadDomains} onNotice={onNotice} />

      <AnimatePresence>
        {sectorPanel !== 'list' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[270] flex justify-end">
            <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={() => !savingSector && setSectorPanel('list')} />
            <motion.div {...slidePanelMotion} className="relative w-full max-w-lg bg-white h-full shadow-2xl p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-semibold text-[#0D1C32]">{sectorPanel === 'edit' ? 'Edit sector' : 'New sector'}</h4>
                <button type="button" onClick={() => !savingSector && setSectorPanel('list')}>
                  <X className="size-5 text-slate-400" />
                </button>
              </div>
              <div className="space-y-4">
                <label className={labelClass}>
                  Name
                  <input className={inputClass} value={sectorForm.name} onChange={(e) => setSectorForm((f) => ({ ...f, name: e.target.value }))} />
                </label>
                <label className={labelClass}>
                  Description
                  <textarea className={`${inputClass} min-h-[80px]`} value={sectorForm.description} onChange={(e) => setSectorForm((f) => ({ ...f, description: e.target.value }))} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={labelClass}>
                    Theme color
                    <input type="color" className="mt-1 h-10 w-full rounded-lg border border-slate-300" value={sectorForm.theme_color} onChange={(e) => setSectorForm((f) => ({ ...f, theme_color: e.target.value }))} />
                  </label>
                  <label className={labelClass}>
                    Icon (emoji)
                    <input className={inputClass} value={sectorForm.icon} onChange={(e) => setSectorForm((f) => ({ ...f, icon: e.target.value }))} />
                  </label>
                </div>
                <label className={labelClass}>
                  Level required
                  <input type="number" min={1} className={inputClass} value={sectorForm.level_lock} onChange={(e) => setSectorForm((f) => ({ ...f, level_lock: Number(e.target.value) || 1 }))} />
                </label>
                <label className={labelClass}>
                  Unlocks after (sector)
                  <select className={inputClass} value={sectorForm.unlock_sector_id} onChange={(e) => setSectorForm((f) => ({ ...f, unlock_sector_id: e.target.value }))}>
                    <option value="">None — always available when active</option>
                    {unlockOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Mastery threshold ({sectorForm.unlock_mastery_percent}%)
                  <input
                    type="range"
                    min={50}
                    max={100}
                    className="mt-2 w-full accent-amber-500"
                    value={sectorForm.unlock_mastery_percent}
                    onChange={(e) => setSectorForm((f) => ({ ...f, unlock_mastery_percent: Number(e.target.value) }))}
                  />
                </label>
                <div>
                  <span className={labelClass}>Domains</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {domains.map((d) => {
                      const active = sectorForm.domain_ids.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleDomain(d.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${active ? 'bg-amber-500 text-[#0D1C32] border-amber-500' : 'bg-white text-slate-600 border-slate-300'}`}
                        >
                          {d.icon} {d.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className={labelClass}>
                  Status
                  <select className={inputClass} value={sectorForm.status} onChange={(e) => setSectorForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="locked">Locked</option>
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </label>
                <button type="button" disabled={savingSector} onClick={saveSector} className="w-full rounded-lg bg-[#0A192F] text-white py-2.5 text-sm font-semibold disabled:opacity-60">
                  {savingSector ? 'Saving…' : sectorPanel === 'edit' ? 'Update sector' : 'Create sector'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {missionEditor && (
          <MissionEditorPanel
            sector={missionEditor.sector}
            mission={missionEditor.mission}
            domains={domains}
            sectorMissions={missionsBySector.get(String(missionEditor.sector.id)) || []}
            onClose={() => setMissionEditor(null)}
            onSaved={onRefresh}
            onNotice={onNotice}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
