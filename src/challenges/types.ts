/**
 * STEMverse Challenge Engine - shared types and JSON schemas for H5P-style challenges.
 * All challenge content is stored as structured JSON (content_json).
 */

import type React from 'react';

export type ChallengeType =
  | 'multiple_choice'
  | 'multi_question'
  | 'drag_drop'
  | 'drag_the_words'
  | 'fill_in_blank'
  | 'hotspot'
  | 'matching_pairs'
  | 'sorting'
  | 'short_answer'
  | 'interactive_simulation'
  | 'flashcards'
  | 'interactive_video'
  | 'branching_scenario';

/** Category for H5P-style content type gallery */
export type ChallengeCategory = 'quiz' | 'interactive' | 'media' | 'other';

export interface ChallengeMeta {
  id: ChallengeType;
  label: string;
  description: string;
  icon?: string; // Lucide icon name, e.g. 'ListChecks', 'LayoutList'
  category?: ChallengeCategory;
}

/** Base challenge record from API */
export interface ChallengeRecord {
  id: number;
  title: string;
  type: ChallengeType;
  world?: string;
  zone?: string;
  grade_level?: string | null;
  xp_reward: number;
  xp_bonus_first_try: number;
  xp_retry_penalty: number;
  content_json: string;
  created_at?: string;
}

/** Optional media for question types (image, video, or audio URL) */
export type MediaType = 'image' | 'video' | 'audio';

/** Parsed content per type */
export interface MultipleChoiceContent {
  question: string;
  multiple: boolean;
  options: { text: string; correct: boolean; feedback?: string }[];
  partialScoring?: boolean;
  time_limit_sec?: number;
  /** Optional media URL (image, video, or audio) shown with the question */
  mediaUrl?: string;
  mediaType?: MediaType;
}

export interface FillInBlankContent {
  text: string; // e.g. "The ___ sensor measures ___."
  blanks: { accept: string[]; caseSensitive?: boolean }[];
}

export interface DragTheWordsContent {
  text: string; // e.g. "Ultrasonic sensors measure **distance** using sound."
  blanks: string[]; // correct words in order (from **word** in text)
}

export interface MatchingPairsContent {
  pairs: { left: string; right: string }[];
}

export interface DragDropContent {
  items: { id: string; label: string }[];
  zones: { id: string; label: string; correctIds: string[] }[];
}

export interface SortingContent {
  items: string[];
  correctOrder: string[];
}

export interface HotspotContent {
  imageUrl: string;
  regions: {
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
    isCorrect?: boolean;
    hint?: string;
  }[];
}

export interface FlashcardsContent {
  cards: { front: string; back: string }[];
}

export interface ShortAnswerContent {
  question: string;
  accept: string[];
  caseSensitive?: boolean;
  mediaUrl?: string;
  mediaType?: MediaType;
}

export interface MultiQuestionContent {
  questions: { type: Exclude<ChallengeType, 'multi_question'>; content: ChallengeContent }[];
}

export type ChallengeContent =
  | MultipleChoiceContent
  | MultiQuestionContent
  | FillInBlankContent
  | DragTheWordsContent
  | MatchingPairsContent
  | DragDropContent
  | SortingContent
  | HotspotContent
  | FlashcardsContent
  | ShortAnswerContent
  | Record<string, unknown>;

export interface EvaluationResult {
  score: number;
  correct: boolean;
  feedback?: string;
}

export type ChallengeEvaluator = (
  content: ChallengeContent,
  response: unknown
) => EvaluationResult;

export interface ChallengeTypePlugin {
  meta: ChallengeMeta;
  defaultContent: () => ChallengeContent;
  Editor: React.ComponentType<{
    content: ChallengeContent;
    onChange: (c: ChallengeContent) => void;
  }>;
  Player: React.ComponentType<{
    content: ChallengeContent;
    onComplete: (response: unknown) => void;
    disabled?: boolean;
  }>;
  evaluate: ChallengeEvaluator;
}
