/**
 * Auto-generated student usernames: [Adjective][Noun][10-99]
 */

export const USERNAME_ADJECTIVES = [
  'Cosmic', 'Stellar', 'Nova', 'Bold', 'Swift',
  'Bright', 'Spark', 'Hyper', 'Turbo', 'Laser',
  'Neon', 'Apex', 'Flux', 'Volt', 'Solar',
  'Lunar', 'Orbit', 'Pulse', 'Vortex', 'Echo',
] as const;

export const USERNAME_NOUNS = [
  'Builder', 'Coder', 'Maker', 'Thinker', 'Solver',
  'Hacker', 'Creator', 'Pioneer', 'Explorer', 'Engineer',
  'Designer', 'Inventor', 'Ranger', 'Scout', 'Pilot',
  'Captain', 'Agent', 'Cadet', 'Operator', 'Commander',
] as const;

function randomFrom<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

function randomDigits(): number {
  return Math.floor(Math.random() * 90) + 10;
}

/** Build one candidate username (PascalCase, no spaces). */
export function buildStudentUsername(): string {
  return `${randomFrom(USERNAME_ADJECTIVES)}${randomFrom(USERNAME_NOUNS)}${randomDigits()}`;
}

/** Retry up to 5 times, then append timestamp suffix. */
export async function generateUniqueStudentUsername(
  exists: (username: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = buildStudentUsername();
    if (!(await exists(candidate))) return candidate;
  }
  const fallback = `${buildStudentUsername()}${Date.now().toString().slice(-4)}`;
  if (!(await exists(fallback))) return fallback;
  return `${buildStudentUsername()}${Date.now()}`;
}
