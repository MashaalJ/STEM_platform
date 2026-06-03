/**
 * Resolve activity embed codes to in-app player URLs (client-side).
 */
import {
  defaultBuilderState,
  emptyStep,
  encodeToolActivityEmbed,
  isScreensActivityEmbed,
  isToolActivityEmbed,
  parseToolActivityEmbed,
  screensActivityPlayerUrl,
  toolActivityPlayerUrl,
  type ToolActivityConfig,
  type ToolType,
} from './toolActivity';
import { isArduinoBlocklyEmbed, isElectricityPreFlowEmbed, electricityActivityUrl } from '../app/types';

function defaultConfigForTool(tool: ToolType): ToolActivityConfig {
  const base = defaultBuilderState();
  base.tool = tool;
  if (tool === '3d_viewer') {
    base.tool = '3d_viewer';
    base.steps = [{ ...emptyStep(2, '3d_viewer'), id: 2 }];
  } else if (tool === 'blocks') {
    base.tool = 'blocks';
    base.steps = [{ ...emptyStep(2, 'blocks'), id: 2 }];
  }
  return base;
}

/** Server-side default embed strings for activity bank tool types. */
export function defaultEmbedForToolType(toolType: string): string {
  switch (String(toolType || '').toLowerCase()) {
    case 'circuit_builder':
      return encodeToolActivityEmbed(defaultConfigForTool('circuit_builder'));
    case 'block_coding':
    case 'arduino_ide':
    case 'arduino':
      return 'stemverse://arduino-uno-blockly';
    case '3d_viewer':
      return encodeToolActivityEmbed(defaultConfigForTool('3d_viewer'));
    default:
      return '';
  }
}

export function resolveActivityEmbedPlayerUrl(embedCode: string): string | null {
  const embed = String(embedCode || '').trim();
  if (!embed) return null;

  if (isToolActivityEmbed(embed)) {
    let config = parseToolActivityEmbed(embed);
    if (!config) {
      const lower = embed.toLowerCase();
      if (lower.includes('config=circuit')) config = defaultConfigForTool('circuit_builder');
      else if (lower.includes('config=3d')) config = defaultConfigForTool('3d_viewer');
    }
    if (config) return toolActivityPlayerUrl(config);
  }

  if (isScreensActivityEmbed(embed)) {
    return screensActivityPlayerUrl(embed);
  }

  if (isElectricityPreFlowEmbed(embed)) {
    return electricityActivityUrl();
  }

  if (/^https?:\/\//i.test(embed)) {
    return embed;
  }

  const iframeSrc = embed.match(/src\s*=\s*["'](https?:\/\/[^"']+)["']/i);
  if (iframeSrc?.[1]) return iframeSrc[1];

  return null;
}

export function isActivityEmbedPlayableInOverlay(embedCode: string): boolean {
  const embed = String(embedCode || '').trim();
  if (!embed) return false;
  if (isArduinoBlocklyEmbed(embed)) return true;
  return Boolean(resolveActivityEmbedPlayerUrl(embed));
}
