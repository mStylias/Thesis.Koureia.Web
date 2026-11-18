import { TimeConstraints, TimeRange, TimeSlot, TimeValue } from './time-picker.types';

const MINUTES_PER_DAY = 24 * 60;

/** Parses common 24-hour input (`9`, `930`, `9:30`) into minutes. */
export function parseTime(value: string): number | undefined {
  const trimmed = value.trim();
  const match = /^(\d{1,2})(?::?(\d{2}))?$/.exec(trimmed);
  if (!match) {
    return undefined;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2] || '0');
  if (hours > 23 || minutes > 59) {
    return undefined;
  }
  return hours * 60 + minutes;
}

export function formatTime(minutes: number): TimeValue {
  const safeMinutes = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
}

export function normalizeTime(value: string): TimeValue | undefined {
  const minutes = parseTime(value);
  return minutes === undefined ? undefined : formatTime(minutes);
}

/** Supports both ordinary and overnight half-open ranges. */
function inRange(minutes: number, range: TimeRange): boolean {
  const start = parseTime(range.start);
  const end = parseTime(range.end);
  if (start === undefined || end === undefined) {
    return false;
  }
  if (start === end) {
    return false;
  }
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

export function isTimeAllowed(value: string, constraints: TimeConstraints = {}): boolean {
  const minutes = parseTime(value);
  if (minutes === undefined) {
    return false;
  }
  const normalized = formatTime(minutes);
  const min = constraints.min ? parseTime(constraints.min) : undefined;
  const max = constraints.max ? parseTime(constraints.max) : undefined;

  if (min !== undefined && minutes < min) {
    return false;
  }
  if (max !== undefined && minutes > max) {
    return false;
  }
  if (
    constraints.validTimes?.length &&
    !constraints.validTimes.some((time) => normalizeTime(time) === normalized)
  ) {
    return false;
  }
  if (
    constraints.includedRanges?.length &&
    !constraints.includedRanges.some((range) => inRange(minutes, range))
  ) {
    return false;
  }
  if (constraints.excludedRanges?.some((range) => inRange(minutes, range))) {
    return false;
  }
  return !constraints.excludedTimes?.some((time) => normalizeTime(time) === normalized);
}

export function createTimeSlots(
  interval: number,
  constraints: TimeConstraints = {},
): readonly TimeSlot[] {
  const min = parseTime(constraints.min ?? '00:00') ?? 0;
  const max = parseTime(constraints.max ?? '23:59') ?? MINUTES_PER_DAY - 1;
  // Slots are whole minutes, so a sub-minute interval floors to one — not
  // to zero, which would make the candidate array length Infinity.
  const step = Number.isFinite(interval) && interval > 0 ? Math.max(1, Math.floor(interval)) : 30;

  const candidates = constraints.validTimes?.length
    ? constraints.validTimes
        .map(normalizeTime)
        .filter((time): time is string => time !== undefined)
        .map(parseTime)
        .filter((time): time is number => time !== undefined && time >= min && time <= max)
    : Array.from(
        { length: Math.max(0, Math.floor((max - min) / step) + 1) },
        (_, index) => min + index * step,
      );

  return [...new Set(candidates)]
    .sort((a, b) => a - b)
    .map((minutes) => {
      const value = formatTime(minutes);
      return { value, disabled: !isTimeAllowed(value, constraints) };
    });
}
