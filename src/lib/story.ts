/**
 * STEMverse Earth Recovery narrative — shared copy for student-facing UI.
 * The STEM Cadet lands on Earth; The Great Surge blacks out every learning sector.
 */

export const STORY = {
  learnerRole: 'STEM Cadet',
  learnerShort: 'Cadet',
  guideName: 'STEMbot',
  surgeName: 'The Great Surge',
  tagline: 'Land. Learn. Restore.',
} as const;

export const STORY_LOGIN = {
  headline: 'Your mission starts on Earth.',
  body: `You are a ${STORY.learnerRole} — fresh from the stars, you have just touched down on Earth. ${STORY.surgeName} ripped through the planet and wiped power from every learning sector. Move from sector to sector, complete missions, and bring each zone back online.`,
} as const;

export const STORY_GALAXY = {
  title: 'Earth Recovery Map',
  subtitle: `${STORY.surgeName} blacked out the sectors below. Walk your Cadet onto a zone, enter it, and restore power one mission at a time.`,
  briefingTitle: 'Recovery briefing',
  briefingFallback:
    'Complete each mission objective to strengthen this sector’s relay. Finished missions unlock the next checkpoint on your path.',
  coreLabel: 'Mission Control',
  coreSyncLabel: 'grid restored',
  controlsLabel: 'Recovery map',
  moveHint: 'Use WASD or arrows to move your Cadet, then enter a sector',
  moveOnto: 'Move onto a sector to begin recovery',
  entering: 'Entering sector…',
  starterBadge: 'First blackout',
  explorerLabel: 'Cadet',
} as const;

export const STORY_BRIEFING_BANNER = {
  title: 'Transmission received, Cadet.',
  body: `You have landed on Earth. ${STORY.surgeName} wiped every learning sector. Dark City is the first blackout zone — enter it from the map and start restoring power.`,
  dismiss: 'Begin recovery',
};

export function galaxySystemAlert(opts: {
  sectorsCount: number;
  needsProfile: boolean;
  hasActiveMission: boolean;
  starterSectorName?: string | null;
}): string {
  const { sectorsCount, needsProfile, hasActiveMission, starterSectorName } = opts;
  if (sectorsCount === 0) return 'Scanning Earth sectors…';
  if (needsProfile) return 'Cadet profile incomplete — finish setup to receive sector relays';
  if (!hasActiveMission) {
    const first = starterSectorName || 'Dark City';
    return `${STORY.surgeName} detected — ${first} is offline. Start your recovery there.`;
  }
  return 'Recovery in progress — complete your active mission to strengthen the relay';
}

export function sectorStatusLabel(status: string, masteryPercent: number): string {
  if (status === 'locked') return 'Offline — surge damage';
  if (masteryPercent >= 100) return 'Relay restored';
  if (masteryPercent > 0) return 'Power returning';
  return 'Recovery zone active';
}

export function sectorBadgeLabel(): string {
  return `Earth Recovery · ${STORY.learnerShort} mission`;
}

export function lockedSectorTitle(name: string, requiredLevel: number): string {
  return `${name} — offline after ${STORY.surgeName}. Reach level ${requiredLevel} or restore prior sectors.`;
}

export const STORY_BRIEFING_DISMISS_KEY = 'stemverse_story_briefing_dismissed';
