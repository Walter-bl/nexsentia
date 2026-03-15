/**
 * Date helper for seed data.
 *
 * All hardcoded dates in seed data were authored around 2026-02-08.
 * This helper shifts them so the most recent data always appears "recent"
 * relative to whenever the seeder actually runs.
 */

const BASE_DATE = new Date('2026-02-08T00:00:00Z');

const offsetMs = Date.now() - BASE_DATE.getTime();

/**
 * Shift a hardcoded seed date so it stays relative to "now".
 * Accepts a Date, ISO string, or date-like string.
 */
export function shiftDate(date: string | Date): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  return new Date(d.getTime() + offsetMs);
}

/**
 * Same as shiftDate but returns null/undefined when input is null/undefined.
 */
export function shiftDateNullable(date: string | Date | null | undefined): Date | null | undefined {
  if (date === null) return null;
  if (date === undefined) return undefined;
  return shiftDate(date);
}
