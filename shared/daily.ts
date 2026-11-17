import { ANSWERS } from "./words";

export const PER_DAY = 10;
export const MAX_TRIES = 6;
export const POINTS = 10; // clue points per day, shared across all 10 words
export const LETTER_COST = 1;
export const DESC_COST = 3;
const MANILA_OFFSET_MS = 8 * 3600_000; // Asia/Manila is UTC+8 all year (no daylight saving)

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });

/** Today's date in Manila ("2026-11-18") and its day number (whole days since 1970). */
export function today(now = new Date()) {
  const date = fmt.format(now);
  const [y, m, d] = date.split("-").map(Number);
  return { date, day: Math.floor(Date.UTC(y, m - 1, d) / 86400000) };
}

/** Milliseconds until the next midnight in Manila. */
export function msUntilReset(now = Date.now()) {
  const { day } = today(new Date(now));
  return (day + 1) * 86400000 - MANILA_OFFSET_MS - now;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The 10 words for a day. The word list is shuffled the same way for everyone (seeded by the cycle number),
 * and each day takes the next 10 words, so no word repeats until the list has been used up. Then it reshuffles.
 */
export function wordsForDay(day: number): string[] {
  const list = [...ANSWERS].sort();
  const daysPerCycle = Math.max(1, Math.floor(list.length / PER_DAY));
  const cycle = Math.floor(day / daysPerCycle);
  const offset = day % daysPerCycle;
  const rnd = mulberry32(Math.imul(cycle + 1, 2654435761) ^ 0x9e3779b9);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(offset * PER_DAY, offset * PER_DAY + PER_DAY);
}
