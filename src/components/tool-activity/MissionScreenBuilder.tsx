import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Lock, Plus, Trash2 } from 'lucide-react';
import {
  GRADE_OPTIONS,
  SUBJECT_OPTIONS,
  TOOL_TYPE_LABELS,
  STEMBOT_EMOTIONS,
  allComponentsForTool,
  completionTriggersForTool,
  emptyStep,
  encodeConfigBase64,
  toolActivityPlayerUrl,
  totalScreenCount,
  type ToolActivityConfig,
  type ToolActivityStep,
  type ToolBuilderValidation,
  type ToolType,
} from '../../lib/toolActivity';

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-[#0D1C32] focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none';
const labelClass = 'text-[10px] uppercase font-black text-[var(--ca-on-surface-variant)] tracking-[0.15em]';
const chipOn = 'bg-amber-500 border-amber-500 text-[#0D1C32]';
const chipOff = 'border-slate-300 text-slate-600 hover:border-amber-400 bg-white';

export type MissionScreenBuilderProps = {
  config: ToolActivityConfig;
  onChange: (config: ToolActivityConfig) => void;
  errors?: ToolBuilderValidation;
};

export default function MissionScreenBuilder({ config, onChange, errors }: MissionScreenBuilderProps) {
  const [previewSrc, setPreviewSrc] = useState(() => toolActivityPlayerUrl(config, { preview: true }));
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setPreviewSrc(toolActivityPlayerUrl(config, { preview: true }));
    }, 350);
    return () => window.clearTimeout(t);
  }, [config]);

  const triggers = useMemo(() => completionTriggersForTool(config.tool), [config.tool]);
  const componentOptions = useMemo(() => allComponentsForTool(config.tool), [config.tool]);
  const previewKey = useMemo(() => encodeConfigBase64(config).slice(0, 48), [config]);
  const screenTotal = totalScreenCount(config);

  const patch = (partial: Partial<ToolActivityConfig>) => onChange({ ...config, ...partial });

  const patchStep = (stepId: number, partial: Partial<ToolActivityStep>) => {
    onChange({
      ...config,
      steps: config.steps.map((s) => (s.id === stepId ? { ...s, ...partial } : s)),
    });
  };

  const setTool = (tool: ToolType) => {
    onChange({
      ...config,
      tool,
      components: [...allComponentsForTool(tool)],
      steps:
        config.steps.length > 0
          ? config.steps.map((s, i) => ({
              ...emptyStep(i + 2, tool),
              instruction: s.instruction,
              hint: s.hint,
              id: i + 2,
            }))
          : [emptyStep(2, tool)],
    });
  };

  const addScreen = () => {
    const toolScreens = config.steps.length;
    if (toolScreens >= 9) return;
    const nextId = Math.max(1, ...config.steps.map((s) => s.id), 1) + 1;
    const nextScreenNum = toolScreens + 2;
    onChange({
      ...config,
      steps: [...config.steps, { ...emptyStep(nextScreenNum, config.tool), id: nextId }],
    });
  };

  const removeScreen = (stepId: number) => {
    if (config.steps.length <= 1) return;
    const next = config.steps.filter((s) => s.id !== stepId);
    onChange({
      ...config,
      steps: next.map((s, i) => ({ ...s, id: i + 2 })),
    });
  };

  const toggleComponent = (name: string) => {
    onChange({
      ...config,
      components: config.components.includes(name)
        ? config.components.filter((c) => c !== name)
        : [...config.components, name],
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0px_4px_20px_rgba(10,25,47,0.08)] overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(360px,40%)_1fr] min-h-[min(78vh,760px)]">
        {/* ——— Builder column ——— */}
        <div className="flex flex-col border-r border-slate-100 max-h-[min(78vh,760px)]">
          <div className="shrink-0 px-4 py-3 bg-[#0A192F] text-white border-b border-slate-700">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Mission screens</p>
            <p className="text-xs text-slate-300 mt-1">
              Every mission starts at <strong className="text-white">Screen 1</strong>, then continues screen by screen (
              {screenTotal} total).
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/90">
            {/* Screen 1 — locked intro */}
            <div className="rounded-xl border-2 border-amber-500/50 bg-white p-4 shadow-sm relative">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center min-w-[4.5rem] px-2 py-1 rounded-md bg-amber-500 text-[#0D1C32] text-[10px] font-black uppercase">
                  Screen 1
                </span>
                <Lock className="size-3.5 text-amber-600" aria-hidden />
                <span className="text-xs font-bold text-[#0D1C32] uppercase tracking-wide">STEMbot intro</span>
                <span className="text-[10px] text-slate-500 ml-auto">Required</span>
              </div>
              <label className="block">
                <span className={labelClass}>What STEMbot says when students arrive</span>
                <textarea
                  rows={3}
                  value={config.stembot_intro}
                  onChange={(e) => patch({ stembot_intro: e.target.value })}
                  placeholder="Welcome! I'm STEMbot. Today we'll build a circuit together."
                  className={inputClass}
                />
                {errors?.stembot_intro && (
                  <span className="text-xs text-red-600 block mt-1">{errors.stembot_intro}</span>
                )}
              </label>
            </div>

            {/* Tool + tray (applies to all activity screens) */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#0D1C32]">
                Activity tool (Screens 2–{screenTotal})
              </p>
              <label className="block">
                <span className={labelClass}>Tool</span>
                <select
                  value={config.tool}
                  onChange={(e) => setTool(e.target.value as ToolType)}
                  className={inputClass}
                >
                  {(Object.keys(TOOL_TYPE_LABELS) as ToolType[]).map((t) => (
                    <option key={t} value={t}>
                      {TOOL_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <span className={labelClass}>Parts in tray</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {componentOptions.map((name) => {
                    const on = config.components.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleComponent(name)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border capitalize ${on ? chipOn : chipOff}`}
                      >
                        {name.replace(/_/g, ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>
              {config.tool === '3d_viewer' && (
                <label className="block">
                  <span className={labelClass}>Shapes needed (scene complete)</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={config.target_shape_count ?? 3}
                    onChange={(e) => patch({ target_shape_count: Number(e.target.value) || 3 })}
                    className={inputClass}
                  />
                </label>
              )}
            </div>

            {/* Activity screens 2+ */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-[#0D1C32] uppercase tracking-wide">
                Activity screens ({config.steps.length})
              </p>
              <button
                type="button"
                onClick={addScreen}
                disabled={config.steps.length >= 9}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0D1C32] text-white text-[10px] font-black uppercase disabled:opacity-40"
              >
                <Plus className="size-3.5" /> Add screen
              </button>
            </div>
            {errors?.screens && <p className="text-xs text-red-600">{errors.screens}</p>}

            {config.steps.map((step, index) => {
              const screenNum = index + 2;
              return (
                <div
                  key={step.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center justify-center min-w-[4.5rem] px-2 py-1 rounded-md bg-[#0D1C32] text-white text-[10px] font-black uppercase">
                      Screen {screenNum}
                    </span>
                    {config.steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeScreen(step.id)}
                        className="text-slate-400 hover:text-red-500 p-1"
                        aria-label={`Remove screen ${screenNum}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={step.instruction}
                    onChange={(e) => patchStep(step.id, { instruction: e.target.value })}
                    placeholder="Tell the student what to do on this screen"
                    className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                  />
                  {errors?.stepFields?.[step.id]?.instruction && (
                    <span className="text-xs text-red-600">{errors.stepFields[step.id].instruction}</span>
                  )}
                  <input
                    value={step.hint}
                    onChange={(e) => patchStep(step.id, { hint: e.target.value })}
                    placeholder="Hint if they get stuck"
                    className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                  />
                  <select
                    value={step.completion_trigger}
                    onChange={(e) => patchStep(step.id, { completion_trigger: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
                  >
                    {triggers.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    value={step.stembot_reaction_correct}
                    onChange={(e) => patchStep(step.id, { stembot_reaction_correct: e.target.value })}
                    placeholder="STEMbot message when they succeed"
                    className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                  />
                  <select
                    value={step.stembot_emotion_correct}
                    onChange={(e) =>
                      patchStep(step.id, {
                        stembot_emotion_correct: e.target.value as ToolActivityStep['stembot_emotion_correct'],
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                  >
                    {STEMBOT_EMOTIONS.map((em) => (
                      <option key={em} value={em}>
                        {em}
                      </option>
                    ))}
                  </select>
                  {config.tool === 'blocks' && step.completion_trigger === 'program_correct' && (
                    <textarea
                      rows={2}
                      value={step.target_output ?? ''}
                      onChange={(e) => patchStep(step.id, { target_output: e.target.value })}
                      placeholder="Expected run output"
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
                    />
                  )}
                </div>
              );
            })}

            {/* Collapsible mission metadata */}
            <button
              type="button"
              onClick={() => setDetailsOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-[#0D1C32]"
            >
              Subject & grade (for reports)
              {detailsOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
            {detailsOpen && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                <label className="block col-span-2">
                  <span className={labelClass}>Display title (in player)</span>
                  <input
                    value={config.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    className={inputClass}
                  />
                  {errors?.title && <span className="text-xs text-red-600">{errors.title}</span>}
                </label>
                <label className="block">
                  <span className={labelClass}>Subject</span>
                  <select
                    value={config.subject}
                    onChange={(e) => patch({ subject: e.target.value })}
                    className={inputClass}
                  >
                    {SUBJECT_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>Grade band</span>
                  <select
                    value={config.grade}
                    onChange={(e) => patch({ grade: e.target.value })}
                    className={inputClass}
                  >
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* ——— Live tool (always visible) ——— */}
        <div className="flex flex-col min-h-[min(78vh,760px)] bg-[#080B1A]">
          <div className="shrink-0 px-4 py-3 border-b border-amber-500/25 bg-[#0A192F] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Student experience</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Tool + STEMbot — updates as you edit screens</p>
            </div>
            <span className="text-[10px] font-mono text-amber-300/80">{screenTotal} screens</span>
          </div>
          <iframe
            key={previewKey}
            src={previewSrc}
            title="Mission preview"
            className="flex-1 w-full border-0 min-h-[420px]"
            allow="autoplay"
          />
        </div>
      </div>
    </div>
  );
}
