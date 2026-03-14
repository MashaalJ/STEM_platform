/**
 * STEMverse Challenge Engine - entry point.
 * Registers all challenge types and exports Builder + Player.
 */

import { registerChallengeType } from './registry';
import type { ChallengeTypePlugin } from './types';
import * as MCQ from './plugins/multipleChoice';
import * as FillBlank from './plugins/fillInBlank';
import * as DragWords from './plugins/dragTheWords';
import * as Matching from './plugins/matchingPairs';
import * as ShortAnswer from './plugins/shortAnswer';
import * as DragDrop from './plugins/dragDrop';
import * as Hotspot from './plugins/hotspot';
import * as Sorting from './plugins/sorting';
import * as MultiQuestion from './plugins/multiQuestion';
import * as Flashcards from './plugins/flashcards';
import { createStubPlugin } from './plugins/stub';

// Register question/challenge types (H5P Studio–style: icon + category for gallery)
registerChallengeType({
  meta: { id: 'multi_question', label: 'Multi‑question Challenge', description: 'Bundle multiple questions into one challenge (H5P-style quiz)', icon: 'Layers', category: 'quiz' },
  defaultContent: MultiQuestion.defaultContent,
  Editor: MultiQuestion.MultiQuestionEditor,
  Player: MultiQuestion.MultiQuestionPlayer,
  evaluate: MultiQuestion.evaluate,
} as ChallengeTypePlugin);

registerChallengeType({
  meta: { id: 'multiple_choice', label: 'Multiple Choice', description: 'Single or multiple answers, feedback per option, partial scoring', icon: 'ListChecks', category: 'quiz' },
  defaultContent: MCQ.defaultContent,
  Editor: MCQ.MultipleChoiceEditor,
  Player: MCQ.MultipleChoicePlayer,
  evaluate: MCQ.evaluate,
} as ChallengeTypePlugin);

registerChallengeType({
  meta: { id: 'fill_in_blank', label: 'Fill in the Blank', description: 'Type answers; exact/keyword match, multiple acceptable answers', icon: 'Type', category: 'quiz' },
  defaultContent: FillBlank.defaultContent,
  Editor: FillBlank.FillInBlankEditor,
  Player: FillBlank.FillInBlankPlayer,
  evaluate: FillBlank.evaluate,
} as ChallengeTypePlugin);

registerChallengeType({
  meta: { id: 'drag_the_words', label: 'Drag the Words', description: 'Fill sentences by dragging words into blanks', icon: 'GripVertical', category: 'interactive' },
  defaultContent: DragWords.defaultContent,
  Editor: DragWords.DragTheWordsEditor,
  Player: DragWords.DragTheWordsPlayer,
  evaluate: DragWords.evaluate,
} as ChallengeTypePlugin);

registerChallengeType({
  meta: { id: 'matching_pairs', label: 'Matching Pairs', description: 'Match items in two columns (e.g. Sensor → Detects distance)', icon: 'GitBranch', category: 'interactive' },
  defaultContent: Matching.defaultContent,
  Editor: Matching.MatchingPairsEditor,
  Player: Matching.MatchingPairsPlayer,
  evaluate: Matching.evaluate,
} as ChallengeTypePlugin);

registerChallengeType({
  meta: { id: 'short_answer', label: 'Short Answer', description: 'Free-text answer with acceptable answers list', icon: 'MessageSquare', category: 'quiz' },
  defaultContent: ShortAnswer.defaultContent,
  Editor: ShortAnswer.ShortAnswerEditor,
  Player: ShortAnswer.ShortAnswerPlayer,
  evaluate: ShortAnswer.evaluate,
} as ChallengeTypePlugin);

registerChallengeType({
  meta: { id: 'drag_drop', label: 'Drag and Drop', description: 'Drag items into correct target zones', icon: 'MousePointer2', category: 'interactive' },
  defaultContent: DragDrop.defaultContent,
  Editor: DragDrop.DragDropEditor,
  Player: DragDrop.DragDropPlayer,
  evaluate: DragDrop.evaluate,
} as ChallengeTypePlugin);

registerChallengeType({
  meta: { id: 'hotspot', label: 'Image Hotspot', description: 'Click the correct area on an image', icon: 'Crosshair', category: 'interactive' },
  defaultContent: Hotspot.defaultContent,
  Editor: Hotspot.HotspotEditor,
  Player: Hotspot.HotspotPlayer,
  evaluate: Hotspot.evaluate,
} as ChallengeTypePlugin);

registerChallengeType({
  meta: { id: 'sorting', label: 'Sequencing', description: 'Reorder items into the correct order', icon: 'ArrowUpDown', category: 'interactive' },
  defaultContent: Sorting.defaultContent,
  Editor: Sorting.SortingEditor,
  Player: Sorting.SortingPlayer,
  evaluate: Sorting.evaluate,
} as ChallengeTypePlugin);

registerChallengeType({
  meta: { id: 'flashcards', label: 'Flashcards', description: 'Front/back cards for memory reinforcement (Neural Recall)', icon: 'Layers', category: 'media' },
  defaultContent: Flashcards.defaultContent,
  Editor: Flashcards.FlashcardsEditor,
  Player: Flashcards.FlashcardsPlayer,
  evaluate: Flashcards.evaluate,
} as ChallengeTypePlugin);

// Stub types (coming soon)
[
  ['interactive_simulation', 'Interactive Simulation', 'Simulation-based question', 'other'],
  ['interactive_video', 'Interactive Video', 'Questions during video', 'media'],
  ['branching_scenario', 'Branching Scenario', 'Choose decisions', 'interactive'],
].forEach(([id, label, desc, cat]) => {
  registerChallengeType(createStubPlugin(id as any, label, desc, cat as any) as ChallengeTypePlugin);
});

export { ChallengeBuilder } from './ChallengeBuilder';
export { ChallengeRenderer } from './ChallengeRenderer';
export {
  getAllChallengeTypes,
  getChallengeType,
  getDefaultContent,
  evaluateResponse,
  registerChallengeType,
} from './registry';
export type { ChallengeType, ChallengeRecord, ChallengeContent, EvaluationResult } from './types';
