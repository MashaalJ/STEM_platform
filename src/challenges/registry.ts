/**
 * Challenge Type Registry - plugin system for challenge types.
 * Register a type to make it available in the Builder and Player.
 */

import type {
  ChallengeType,
  ChallengeContent,
  ChallengeTypePlugin,
  EvaluationResult,
} from './types';

const registry = new Map<ChallengeType, ChallengeTypePlugin>();

export function registerChallengeType(plugin: ChallengeTypePlugin): void {
  registry.set(plugin.meta.id as ChallengeType, plugin);
}

export function getChallengeType(type: ChallengeType): ChallengeTypePlugin | undefined {
  return registry.get(type);
}

export function getAllChallengeTypes(): ChallengeTypePlugin[] {
  return Array.from(registry.values());
}

export function getDefaultContent(type: ChallengeType): ChallengeContent | null {
  const plugin = registry.get(type);
  return plugin ? plugin.defaultContent() : null;
}

export function evaluateResponse(
  type: ChallengeType,
  content: ChallengeContent,
  response: unknown
): EvaluationResult {
  const plugin = registry.get(type);
  if (!plugin) return { score: 0, correct: false };
  return plugin.evaluate(content, response);
}
