/** A local-calendar date key, formatted as YYYY-MM-DD. */
export type DateKey = `${number}-${number}-${number}`;

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Format a Date in the user's local calendar rather than UTC. */
export function localDateKey(date: Date = new Date()): DateKey {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('A valid Date is required to create a local date key.');
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` as DateKey;
}

/** True only for real calendar dates (for example, 2025-02-29 is rejected). */
export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string') return false;
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const local = new Date(year, month - 1, day);
  return local.getFullYear() === year && local.getMonth() === month - 1 && local.getDate() === day;
}

/**
 * Add whole local-calendar days. This never uses UTC conversion, so a selected
 * day remains stable around local midnight and daylight-saving transitions.
 */
export function addDays(dateKey: DateKey, days: number): DateKey {
  if (!isDateKey(dateKey)) throw new Error(`Invalid date key: ${String(dateKey)}.`);
  if (!Number.isInteger(days)) throw new Error('Day offset must be a whole number.');
  const [year, month, day] = dateKey.split('-').map(Number);
  return localDateKey(new Date(year, month - 1, day + days));
}

/** Compare validated date keys in calendar order. */
export function compareDateKeys(left: DateKey, right: DateKey): number {
  if (!isDateKey(left) || !isDateKey(right)) throw new Error('Both values must be valid date keys.');
  return left.localeCompare(right);
}

/**
 * Prefer a stored local key. Older records did not have one; their ISO timestamp
 * is deliberately interpreted in local time as a non-destructive legacy fallback.
 */
export function entryDateKey(record: { dateKey?: unknown; timestamp?: unknown }): DateKey | undefined {
  if (isDateKey(record.dateKey)) return record.dateKey;
  if (typeof record.timestamp !== 'string') return undefined;
  const timestamp = new Date(record.timestamp);
  return Number.isNaN(timestamp.getTime()) ? undefined : localDateKey(timestamp);
}

/** Return records belonging to one local calendar date, including legacy records. */
export function recordsForDate<T extends { dateKey?: unknown; timestamp?: unknown }>(records: readonly T[], dateKey: DateKey): T[] {
  if (!isDateKey(dateKey)) throw new Error(`Invalid date key: ${String(dateKey)}.`);
  return records.filter((record) => entryDateKey(record) === dateKey);
}
