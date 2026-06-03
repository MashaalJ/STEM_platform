/**
 * Guided tool activity config — shared by builder, mission embed, and player URL.
 */

export type ToolType = 'circuit_builder' | 'blocks' | '3d_viewer';

export type StembotEmotion = 'celebrate' | 'excited' | 'correct' | 'thinking';

export interface ToolActivityStep {
  id: number;
  instruction: string;
  hint: string;
  completion_trigger: string;
  stembot_reaction_correct: string;
  stembot_emotion_correct: StembotEmotion;
  target_output?: string;
}

export interface ToolActivityConfig {
  tool: ToolType;
  title: string;
  subject: string;
  grade: string;
  stembot_intro: string;
  components: string[];
  target_shape_count?: number;
  steps: ToolActivityStep[];
}

export const TOOL_ACTIVITY_EMBED_PREFIX = 'stemverse://tool-activity';
export const SCREENS_ACTIVITY_EMBED_PREFIX = 'stemverse://screens-activity';

export const SUBJECT_OPTIONS = [
  'Electricity',
  'Structures',
  'Robotics',
  'IoT',
  'Coding',
  'AI',
  'General',
] as const;

export const GRADE_OPTIONS = ['6-8', '8-10', '10-12', '12-15'] as const;

const CIRCUIT_TRIGGERS = [
  'component_placed:battery',
  'component_placed:wire',
  'component_placed:led',
  'component_placed:switch',
  'component_placed:resistor',
  'wire_connected:battery_positive',
  'wire_connected:battery_negative',
  'circuit_closed',
  'led_on',
] as const;

const BLOCKS_TRIGGERS = [
  'block_placed:move_forward',
  'block_placed:turn_left',
  'block_placed:turn_right',
  'block_placed:repeat_N',
  'block_placed:if_then',
  'block_placed:wait_seconds',
  'block_placed:play_sound',
  'block_placed:light_on',
  'block_placed:light_off',
  'program_run',
  'program_correct',
] as const;

const VIEWER_TRIGGERS = [
  'shape_added:cube',
  'shape_added:sphere',
  'shape_added:cylinder',
  'shape_added:cone',
  'shape_added:pyramid',
  'shape_added:torus',
  'shape_added:rectangular_prism',
  'shape_count:2',
  'shape_count:3',
  'shape_count:4',
  'shape_count:5',
  'color_applied',
  'scene_complete',
] as const;

export function completionTriggersForTool(tool: ToolType): readonly string[] {
  if (tool === 'circuit_builder') return CIRCUIT_TRIGGERS;
  if (tool === 'blocks') return BLOCKS_TRIGGERS;
  return VIEWER_TRIGGERS;
}

export function defaultComponentsForTool(tool: ToolType): string[] {
  if (tool === 'circuit_builder') return ['battery', 'wire', 'led'];
  if (tool === 'blocks') return ['move_forward', 'turn_left', 'turn_right'];
  return ['cube', 'sphere'];
}

export const ALL_CIRCUIT_COMPONENTS = [
  'battery',
  'wire',
  'led',
  'switch',
  'resistor',
  'buzzer',
] as const;

export const ALL_BLOCK_TYPES = [
  'move_forward',
  'turn_left',
  'turn_right',
  'repeat_N',
  'if_then',
  'wait_seconds',
  'play_sound',
  'light_on',
  'light_off',
] as const;

export const ALL_VIEWER_SHAPES = [
  'cube',
  'sphere',
  'cylinder',
  'cone',
  'pyramid',
  'rectangular_prism',
  'torus',
] as const;

export function allComponentsForTool(tool: ToolType): readonly string[] {
  if (tool === 'circuit_builder') return ALL_CIRCUIT_COMPONENTS;
  if (tool === 'blocks') return ALL_BLOCK_TYPES;
  return ALL_VIEWER_SHAPES;
}

export const TOOL_TYPE_LABELS: Record<ToolType, string> = {
  circuit_builder: 'Circuit builder',
  blocks: 'Code blocks',
  '3d_viewer': '3D viewer',
};

export const STEMBOT_EMOTIONS: StembotEmotion[] = ['celebrate', 'excited', 'correct', 'thinking'];

export function emptyStep(id: number, tool: ToolType): ToolActivityStep {
  const triggers = completionTriggersForTool(tool);
  return {
    id,
    instruction: '',
    hint: '',
    completion_trigger: triggers[0] || 'circuit_closed',
    stembot_reaction_correct: '',
    stembot_emotion_correct: 'celebrate',
  };
}

/** Screen 1 = intro; steps[] = Screens 2, 3, … */
export function totalScreenCount(config: ToolActivityConfig): number {
  return 1 + config.steps.length;
}

export function defaultBuilderState(): ToolActivityConfig {
  return {
    tool: 'circuit_builder',
    title: '',
    subject: 'Electricity',
    grade: '8-10',
    stembot_intro: "Welcome! I'm STEMbot. Let's work through this mission together.",
    components: defaultComponentsForTool('circuit_builder'),
    target_shape_count: 3,
    steps: [{ ...emptyStep(2, 'circuit_builder'), id: 2 }],
  };
}

export function encodeConfigBase64(config: ToolActivityConfig): string {
  const json = JSON.stringify(config);
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeConfigBase64(b64: string): ToolActivityConfig | null {
  try {
    const raw = decodeURIComponent(escape(atob(decodeURIComponent(b64))));
    return JSON.parse(raw) as ToolActivityConfig;
  } catch {
    return null;
  }
}

export function encodeToolActivityEmbed(config: ToolActivityConfig): string {
  return `${TOOL_ACTIVITY_EMBED_PREFIX}?config=${encodeURIComponent(encodeConfigBase64(config))}`;
}

/** Extended mission player payload (intro + circuit_builder / blocks / challenge screens). */
export interface MissionScreensEmbedConfig {
  title?: string;
  subject?: string;
  grade?: string;
  tool?: ToolType;
  xp_reward?: number;
  screens: Record<string, unknown>[];
}

export function encodeConfigBase64Raw(payload: Record<string, unknown> | MissionScreensEmbedConfig): string {
  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeScreensEmbedBase64(b64: string): MissionScreensEmbedConfig | null {
  try {
    const raw = decodeURIComponent(escape(atob(decodeURIComponent(b64))));
    return JSON.parse(raw) as MissionScreensEmbedConfig;
  } catch {
    return null;
  }
}

export function encodeMissionScreensEmbed(config: MissionScreensEmbedConfig): string {
  return `${SCREENS_ACTIVITY_EMBED_PREFIX}?embed=${encodeURIComponent(encodeConfigBase64Raw(config))}`;
}

export function parseScreensActivityEmbed(embed: string | null | undefined): MissionScreensEmbedConfig | null {
  const s = String(embed || '').trim();
  if (!s.toLowerCase().startsWith(SCREENS_ACTIVITY_EMBED_PREFIX)) return null;
  const q = s.includes('?') ? s.slice(s.indexOf('?') + 1) : '';
  const params = new URLSearchParams(q);
  const cfg = params.get('embed') || params.get('config');
  if (!cfg) return null;
  return decodeScreensEmbedBase64(cfg);
}

export function isScreensActivityEmbed(embed: string | null | undefined): boolean {
  const s = String(embed || '').trim().toLowerCase();
  if (s.startsWith(SCREENS_ACTIVITY_EMBED_PREFIX)) return true;
  return isLegacyScreensToolEmbed(embed);
}

/** Missions seeded before screens-activity token used tool-activity?config= with screens[]. */
export function isLegacyScreensToolEmbed(embed: string | null | undefined): boolean {
  const s = String(embed || '').trim();
  if (!s.toLowerCase().startsWith(TOOL_ACTIVITY_EMBED_PREFIX)) return false;
  const q = s.includes('?') ? s.slice(s.indexOf('?') + 1) : '';
  const cfg = new URLSearchParams(q).get('config');
  if (!cfg) return false;
  try {
    const parsed = decodeScreensEmbedBase64(cfg) as { screens?: unknown[] } | null;
    return Boolean(parsed && Array.isArray(parsed.screens) && parsed.screens.length > 0);
  } catch {
    return false;
  }
}

export function screensActivityPlayerUrl(
  embed: string,
  opts?: { missionId?: number | string; xp?: number },
): string {
  let b64 = '';
  const s = String(embed || '').trim();
  if (s.toLowerCase().startsWith(SCREENS_ACTIVITY_EMBED_PREFIX)) {
    b64 = new URLSearchParams(s.slice(s.indexOf('?') + 1)).get('embed') || '';
  } else if (isLegacyScreensToolEmbed(s)) {
    b64 = new URLSearchParams(s.slice(s.indexOf('?') + 1)).get('config') || '';
  }
  const q = new URLSearchParams();
  q.set('embed', b64);
  if (opts?.missionId) q.set('mission_id', String(opts.missionId));
  if (opts?.xp != null) q.set('xp', String(opts.xp));
  return `/stemverse-screens-player.html?${q.toString()}`;
}

export function parseToolActivityEmbed(embed: string | null | undefined): ToolActivityConfig | null {
  const s = String(embed || '').trim();
  if (!s.toLowerCase().startsWith(TOOL_ACTIVITY_EMBED_PREFIX)) return null;
  const q = s.includes('?') ? s.slice(s.indexOf('?') + 1) : '';
  const params = new URLSearchParams(q);
  const cfg = params.get('config');
  if (!cfg) return null;
  return decodeConfigBase64(cfg);
}

export function isToolActivityEmbed(embed: string | null | undefined): boolean {
  return String(embed || '').trim().toLowerCase().startsWith(TOOL_ACTIVITY_EMBED_PREFIX);
}

export function toolActivityPlayerUrl(
  config: ToolActivityConfig,
  opts?: { missionId?: number | string; preview?: boolean },
): string {
  if (typeof window === 'undefined') {
    const q = new URLSearchParams();
    q.set('embed', '1');
    q.set('config', encodeConfigBase64(config));
    if (opts?.missionId) q.set('mission_id', String(opts.missionId));
    if (opts?.preview) q.set('preview', '1');
    return `/stemverse-tool-player.html?${q.toString()}`;
  }
  const u = new URL('/stemverse-tool-player.html', window.location.origin);
  u.searchParams.set('embed', '1');
  u.searchParams.set('config', encodeConfigBase64(config));
  if (opts?.missionId) u.searchParams.set('mission_id', String(opts.missionId));
  if (opts?.preview) u.searchParams.set('preview', '1');
  return u.href;
}

export function previewToolActivityUrl(
  config: ToolActivityConfig,
  opts?: { missionId?: number | string; preview?: boolean },
): string {
  return toolActivityPlayerUrl(config, { preview: true, ...opts });
}

export type ToolBuilderValidation = {
  title?: string;
  stembot_intro?: string;
  screens?: string;
  /** @deprecated use screens */
  steps?: string;
  stepFields?: Record<number, { instruction?: string; completion_trigger?: string }>;
};

export function validateToolActivityConfig(config: ToolActivityConfig): ToolBuilderValidation {
  const errors: ToolBuilderValidation = {};
  if (!config.title.trim()) errors.title = 'Player title is required (expand Subject & grade).';
  if (!config.stembot_intro.trim()) {
    errors.stembot_intro = 'Screen 1 intro message is required.';
  }
  if (!config.steps.length) {
    errors.screens = 'Add at least Screen 2 — every mission needs an activity screen after the intro.';
  } else if (config.steps.length > 9) {
    errors.screens = 'Maximum 9 activity screens (10 screens total including intro).';
  }
  const stepFields: Record<number, { instruction?: string; completion_trigger?: string }> = {};
  config.steps.forEach((step) => {
    const sf: { instruction?: string; completion_trigger?: string } = {};
    if (!step.instruction.trim()) sf.instruction = 'Instruction is required.';
    if (!step.completion_trigger.trim()) sf.completion_trigger = 'Choose a completion trigger.';
    if (Object.keys(sf).length) stepFields[step.id] = sf;
  });
  if (Object.keys(stepFields).length) errors.stepFields = stepFields;
  return errors;
}

export function hasValidationErrors(errors: ToolBuilderValidation): boolean {
  return Boolean(
    errors.title ||
      errors.stembot_intro ||
      errors.screens ||
      errors.steps ||
      (errors.stepFields && Object.keys(errors.stepFields).length > 0)
  );
}

/** Build mission POST payload fields from form + screen config. */
export function buildMissionFromScreens(
  form: {
    title: string;
    description: string;
    sector_id: string | number;
    difficulty: string;
    grade_level: string;
    xp_reward: number;
    prerequisite_mission_id: string | number | null;
    learning_outcomes: string[];
    domains: string[];
  },
  config: ToolActivityConfig,
) {
  const merged: ToolActivityConfig = {
    ...config,
    title: form.title.trim() || config.title,
    grade: form.grade_level || config.grade,
  };
  const meta = configToMissionFields(merged);
  return {
    ...form,
    title: form.title.trim(),
    description: form.description.trim() || meta.description,
    grade_level: form.grade_level || merged.grade,
    embed_code: meta.embed_code,
    learning_outcomes: form.learning_outcomes,
    domains: form.domains,
    prerequisite_mission_id: form.prerequisite_mission_id || undefined,
  };
}

export const TOOL_BUILDER_DRAFT_KEY = 'stemverse_tool_builder_draft';

export function configToMissionFields(config: ToolActivityConfig) {
  return {
    title: config.title.trim(),
    description: `${config.subject} · Grade ${config.grade} · Guided ${config.tool.replace(/_/g, ' ')} activity`,
    grade_level: config.grade,
    embed_code: encodeToolActivityEmbed(config),
  };
}
