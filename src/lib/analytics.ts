import type { Interval, WatchSession } from "../types";
export function mergeIntervals(
  intervals: Interval[],
  duration: number,
): Interval[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const sorted = intervals
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .map(([a, b]): Interval => [Math.max(0, a), Math.min(duration, b)])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  const result: Interval[] = [];
  for (const interval of sorted) {
    const last = result.at(-1);
    if (last && interval[0] <= last[1])
      last[1] = Math.max(last[1], interval[1]);
    else result.push([...interval]);
  }
  return result;
}
export function metrics(session: WatchSession, threshold = 90) {
  const covered = mergeIntervals(
    session.watchedIntervals,
    session.duration,
  ).reduce((sum, [a, b]) => sum + b - a, 0);
  const percentage =
    session.duration > 0 ? (covered / session.duration) * 100 : 0;
  return {
    covered,
    percentage,
    threshold,
    completed:
      session.duration > 0 && percentage >= threshold && session.reachedEnd,
  };
}
export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "Not available";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}
export function ranges(session: WatchSession) {
  const result: { start: number; end: number; watched: boolean }[] = [];
  let cursor = 0;
  for (const [a, b] of mergeIntervals(
    session.watchedIntervals,
    session.duration,
  )) {
    if (a > cursor) result.push({ start: cursor, end: a, watched: false });
    result.push({ start: a, end: b, watched: true });
    cursor = b;
  }
  if (cursor < session.duration)
    result.push({ start: cursor, end: session.duration, watched: false });
  return result;
}
