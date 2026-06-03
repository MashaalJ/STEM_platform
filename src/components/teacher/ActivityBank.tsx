import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, CirclePlay, Plus, Search, Target, Wrench, Zap,
} from 'lucide-react';
import { authFetch, safeFetch } from '../../app/api';

type ActivityType = 'video' | 'reading' | 'tool' | 'challenge' | 'quiz' | 'interactive';

type Activity = {
  id: string;
  title: string;
  description?: string | null;
  activity_type: ActivityType;
  difficulty?: string | null;
  sector_id?: string | null;
  xp_reward?: number | null;
  estimated_minutes?: number | null;
  is_default?: boolean;
};

type TemplateDef = {
  id: ActivityType;
  label: string;
  icon: React.ReactNode;
  blurb: string;
};

const TEMPLATES: TemplateDef[] = [
  { id: 'video', label: 'Explainer Video', icon: <CirclePlay className="size-5" />, blurb: 'YouTube or hosted video URL' },
  { id: 'reading', label: 'Reading', icon: <BookOpen className="size-5" />, blurb: 'Text lesson for students to read' },
  { id: 'tool', label: 'Interactive Tool', icon: <Wrench className="size-5" />, blurb: 'Circuit builder, Arduino, or embed' },
  { id: 'challenge', label: 'Challenge', icon: <Zap className="size-5" />, blurb: 'Link an existing challenge' },
  { id: 'quiz', label: 'Quick Quiz', icon: <Target className="size-5" />, blurb: 'Link an existing quiz' },
  { id: 'interactive', label: 'STEMverse Mission', icon: <Target className="size-5" />, blurb: 'Full-screen mission embed' },
];

type ContentFields = {
  videoUrl: string;
  videoTranscript: string;
  readingBody: string;
  toolType: string;
  toolEmbed: string;
  challengeId: string;
  quizId: string;
  missionEmbed: string;
  missionId: string;
};

const TOOL_INTERACTIVE_SAVE_MSG =
  'Please select a tool type or enter an embed code before saving.';

const emptyContent = (): ContentFields => ({
  videoUrl: '',
  videoTranscript: '',
  readingBody: '',
  toolType: '',
  toolEmbed: '',
  challengeId: '',
  quizId: '',
  missionEmbed: '',
  missionId: '',
});

function buildContent(type: ActivityType, c: ContentFields) {
  if (type === 'video') return { url: c.videoUrl, transcript: c.videoTranscript || '' };
  if (type === 'reading') return { body: c.readingBody };
  if (type === 'tool') {
    const payload: Record<string, string> = {};
    if (c.toolType.trim()) payload.tool_type = c.toolType.trim();
    if (c.toolEmbed.trim()) payload.embed_code = c.toolEmbed.trim();
    if (c.missionId.trim()) payload.mission_id = c.missionId.trim();
    return payload;
  }
  if (type === 'challenge') return { challenge_id: c.challengeId || null };
  if (type === 'quiz') return { quiz_id: c.quizId || null };
  const payload: Record<string, string> = {};
  if (c.missionEmbed.trim()) payload.embed_code = c.missionEmbed.trim();
  if (c.missionId.trim()) payload.mission_id = c.missionId.trim();
  return payload;
}

function toolOrInteractiveContentValid(type: ActivityType, c: ContentFields): boolean {
  if (type === 'tool') {
    return Boolean(c.toolEmbed.trim() || c.toolType.trim() || c.missionId.trim());
  }
  if (type === 'interactive') {
    return Boolean(c.missionEmbed.trim() || c.missionId.trim());
  }
  return true;
}

export default function ActivityBank({
  sectors,
}: {
  sectors: Array<{ id: string; name: string }>;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [challenges, setChallenges] = useState<Array<{ id: string; title: string }>>([]);
  const [quizzes, setQuizzes] = useState<Array<{ id: string; title: string }>>([]);
  const [missions, setMissions] = useState<Array<{ id: string; title: string }>>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [template, setTemplate] = useState<ActivityType>('video');
  const [content, setContent] = useState<ContentFields>(emptyContent);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [difficulty, setDifficulty] = useState('beginner');
  const [xpReward, setXpReward] = useState(50);
  const [minutes, setMinutes] = useState(10);

  const load = async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (sectorFilter !== 'all') params.set('sector_id', sectorFilter);
    const url = `/api/activities${params.toString() ? `?${params.toString()}` : ''}`;
    const data = await safeFetch(url);
    setActivities(Array.isArray(data) ? (data as Activity[]) : []);
  };

  useEffect(() => {
    void load();
  }, [search, typeFilter, sectorFilter]);

  useEffect(() => {
    safeFetch('/api/challenges').then((d) => setChallenges(Array.isArray(d) ? d : []));
    safeFetch('/api/quizzes').then((d) => setQuizzes(Array.isArray(d) ? d : []));
    safeFetch('/api/missions').then((d) => setMissions(Array.isArray(d) ? d : []));
  }, []);

  const pickTemplate = (id: ActivityType) => {
    setTemplate(id);
    setContent(emptyContent());
    if (!title.trim()) {
      const t = TEMPLATES.find((x) => x.id === id);
      if (t) setTitle(`New ${t.label}`);
    }
  };

  const resetCreator = () => {
    setTemplate('video');
    setContent(emptyContent());
    setTitle('');
    setDescription('');
    setSectorId('');
    setDifficulty('beginner');
    setXpReward(50);
    setMinutes(10);
    setError(null);
  };

  const createActivity = async () => {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (template === 'video' && !content.videoUrl.trim()) {
      setError('Video URL is required.');
      return;
    }
    if (template === 'reading' && !content.readingBody.trim()) {
      setError('Reading content is required.');
      return;
    }
    if (template === 'challenge' && !content.challengeId) {
      setError('Pick a challenge.');
      return;
    }
    if (template === 'quiz' && !content.quizId) {
      setError('Pick a quiz.');
      return;
    }
    if ((template === 'tool' || template === 'interactive') && !toolOrInteractiveContentValid(template, content)) {
      setError(TOOL_INTERACTIVE_SAVE_MSG);
      return;
    }
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          activity_type: template,
          sector_id: sectorId || null,
          difficulty,
          xp_reward: xpReward,
          estimated_minutes: minutes,
          content: buildContent(template, content),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || data.message || 'Could not save activity.');
        return;
      }
      setMessage('Activity saved to your bank.');
      setShowCreator(false);
      resetCreator();
      await load();
    } finally {
      setCreating(false);
    }
  };

  const activeTemplate = useMemo(() => TEMPLATES.find((t) => t.id === template), [template]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Activity Bank</p>
          <h3 className="text-xl font-bold text-[#0A192F]">Your learning content library</h3>
        </div>
        <button
          type="button"
          onClick={() => {
            if (showCreator) {
              setShowCreator(false);
              resetCreator();
            } else {
              resetCreator();
              setShowCreator(true);
            }
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0A192F] px-4 py-2 text-xs font-black uppercase tracking-widest text-teal-300"
        >
          <Plus className="size-4" />
          {showCreator ? 'Close' : 'New activity'}
        </button>
      </div>

      {showCreator && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">1 · Pick a template</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickTemplate(t.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    template === t.id
                      ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-400'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`mb-1 ${template === t.id ? 'text-teal-700' : 'text-slate-600'}`}>{t.icon}</div>
                  <p className="text-sm font-bold text-slate-900">{t.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t.blurb}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              2 · {activeTemplate?.label} content
            </p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              {template === 'video' && (
                <>
                  <input
                    value={content.videoUrl}
                    onChange={(e) => setContent((c) => ({ ...c, videoUrl: e.target.value }))}
                    placeholder="Video URL (YouTube, Vimeo, etc.)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <textarea
                    value={content.videoTranscript}
                    onChange={(e) => setContent((c) => ({ ...c, videoTranscript: e.target.value }))}
                    placeholder="Transcript or notes (optional)"
                    className="min-h-[72px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </>
              )}
              {template === 'reading' && (
                <textarea
                  value={content.readingBody}
                  onChange={(e) => setContent((c) => ({ ...c, readingBody: e.target.value }))}
                  placeholder="Lesson text students will read"
                  className="min-h-[140px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              )}
              {template === 'tool' && (
                <>
                  <select
                    value={content.toolType}
                    onChange={(e) => setContent((c) => ({ ...c, toolType: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select tool type…</option>
                    <option value="circuit_builder">Circuit Builder</option>
                    <option value="block_coding">Block Coding (Arduino)</option>
                    <option value="3d_viewer">3D Viewer</option>
                    <option value="arduino_ide">Arduino IDE</option>
                  </select>
                  <select
                    value={content.missionId}
                    onChange={(e) => setContent((c) => ({ ...c, missionId: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Or link an existing mission…</option>
                    {missions.map((m) => (
                      <option key={m.id} value={m.id}>{m.title}</option>
                    ))}
                  </select>
                  <textarea
                    value={content.toolEmbed}
                    onChange={(e) => setContent((c) => ({ ...c, toolEmbed: e.target.value }))}
                    placeholder="Custom embed code (optional if tool type or mission is set)"
                    className="min-h-[80px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
                  />
                </>
              )}
              {template === 'challenge' && (
                <select
                  value={content.challengeId}
                  onChange={(e) => setContent((c) => ({ ...c, challengeId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select challenge…</option>
                  {challenges.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              )}
              {template === 'quiz' && (
                <select
                  value={content.quizId}
                  onChange={(e) => setContent((c) => ({ ...c, quizId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select quiz…</option>
                  {quizzes.map((q) => (
                    <option key={q.id} value={q.id}>{q.title}</option>
                  ))}
                </select>
              )}
              {template === 'interactive' && (
                <>
                  <select
                    value={content.missionId}
                    onChange={(e) => setContent((c) => ({ ...c, missionId: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select mission…</option>
                    {missions.map((m) => (
                      <option key={m.id} value={m.id}>{m.title}</option>
                    ))}
                  </select>
                  <textarea
                    value={content.missionEmbed}
                    onChange={(e) => setContent((c) => ({ ...c, missionEmbed: e.target.value }))}
                    placeholder="Or paste mission embed code (stemverse://… or iframe HTML)"
                    className="min-h-[100px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
                  />
                </>
              )}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">3 · Settings</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description"
                className="min-h-[72px] rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              />
              <select
                value={sectorId}
                onChange={(e) => setSectorId(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">No sector</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <input
                type="number"
                value={xpReward}
                onChange={(e) => setXpReward(Number(e.target.value) || 0)}
                placeholder="XP"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value) || 0)}
                placeholder="Minutes"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void createActivity()}
            disabled={creating}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60"
          >
            {creating ? 'Saving…' : 'Save to Activity Bank'}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-xs">
          <option value="all">All types</option>
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-xs">
          <option value="all">All sectors</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {(message || error) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {activities.map((a) => (
          <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-black uppercase text-teal-700">{a.activity_type}</p>
            <h4 className="mt-1 font-semibold text-slate-900 line-clamp-2">{a.title}</h4>
            <p className="mt-1 text-xs text-slate-500 line-clamp-2">{a.description || '—'}</p>
            <p className="mt-3 text-[11px] text-slate-600">+{a.xp_reward || 0} XP · {a.estimated_minutes || 0} min</p>
          </div>
        ))}
        {activities.length === 0 && (
          <p className="col-span-full text-sm text-slate-500 py-8 text-center">No activities yet. Click “New activity” to create one.</p>
        )}
      </div>
    </div>
  );
}
