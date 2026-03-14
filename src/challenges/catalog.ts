/**
 * Content type catalog for H5P Studio–style display.
 * Builds a categorized list of challenge types for the type picker grid.
 */

import { getAllChallengeTypes } from './registry';
import type { ChallengeType, ChallengeCategory } from './types';

export interface CatalogEntry {
  id: ChallengeType;
  label: string;
  description: string;
  icon: string;
  category: ChallengeCategory;
}

const CATEGORY_ORDER: ChallengeCategory[] = ['quiz', 'interactive', 'media', 'other'];
const DEFAULT_ICON = 'Puzzle';

/** Returns catalog entries grouped by category for the studio type picker */
export function getContentTypeCatalog(): CatalogEntry[] {
  const types = getAllChallengeTypes();
  return types
    .map((t) => ({
      id: t.meta.id as ChallengeType,
      label: t.meta.label,
      description: t.meta.description,
      icon: t.meta.icon || DEFAULT_ICON,
      category: (t.meta.category || 'other') as ChallengeCategory,
    }))
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
}

/** Returns catalog entries grouped by category key */
export function getContentTypeCatalogByCategory(): Record<ChallengeCategory, CatalogEntry[]> {
  const list = getContentTypeCatalog();
  const byCategory: Record<ChallengeCategory, CatalogEntry[]> = {
    quiz: [],
    interactive: [],
    media: [],
    other: [],
  };
  list.forEach((entry) => {
    byCategory[entry.category].push(entry);
  });
  return byCategory;
}
