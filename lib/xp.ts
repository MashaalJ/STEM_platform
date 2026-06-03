/** XP → display level (1 XP per level step of 1000). */
export function xpToLevel(xp: number): number {
  return Math.max(1, Math.floor(Math.max(0, xp) / 1000) + 1);
}
