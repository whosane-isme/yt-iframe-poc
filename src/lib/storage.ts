import type { FinalSessionSummary, WatchSession } from "../types";
import { createSession } from "./watchTracker";
import { progressSummary, SESSION_HISTORY_LIMIT } from "./watchSummary";
const PREFIX = "yt-analytics:v1:";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  length: number;
}
export const storageKey = (student: string, video: string) =>
  `${PREFIX}${student}:${video}`;
const nonnegative = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const timestamp = (v: unknown): v is string =>
  typeof v === "string" && Number.isFinite(Date.parse(v));
function validFinal(
  value: unknown,
  student: string,
  video: string,
): value is FinalSessionSummary {
  if (!value || typeof value !== "object") return false;
  const s = value as FinalSessionSummary;
  return (
    typeof s.sessionId === "string" &&
    s.studentId === student &&
    s.videoId === video &&
    timestamp(s.startedAt) &&
    timestamp(s.endedAt) &&
    Date.parse(s.endedAt) >= Date.parse(s.startedAt) &&
    [
      s.playbackWallSeconds,
      s.newlyCoveredSeconds,
      s.cumulativeCoveredSeconds,
      s.seekCount,
    ].every(nonnegative) &&
    (s.cumulativeCoveragePercentage === null ||
      (nonnegative(s.cumulativeCoveragePercentage) &&
        s.cumulativeCoveragePercentage <= 100)) &&
    (s.weightedAverageSpeed === null ||
      (nonnegative(s.weightedAverageSpeed) && s.weightedAverageSpeed > 0)) &&
    !!s.rateWallSeconds &&
    typeof s.rateWallSeconds === "object" &&
    !Array.isArray(s.rateWallSeconds) &&
    Object.entries(s.rateWallSeconds).every(
      ([r, t]) => Number.isFinite(Number(r)) && Number(r) > 0 && nonnegative(t),
    ) &&
    typeof s.reachedEnd === "boolean" &&
    typeof s.completed === "boolean" &&
    typeof s.coverageThresholdSatisfied === "boolean" &&
    nonnegative(s.completionThreshold) &&
    s.completionThreshold <= 100 &&
    ["video_ended", "manual_end"].includes(s.endingReason)
  );
}
export function restore(
  storage: StorageLike,
  student: string,
  video: string,
): WatchSession {
  try {
    const raw = storage.getItem(storageKey(student, video));
    if (raw) {
      const s = JSON.parse(raw) as WatchSession;
      if (
        s.studentId === student &&
        s.videoId === video &&
        typeof s.sessionId === "string" &&
        timestamp(s.startedAt) &&
        timestamp(s.lastUpdatedAt) &&
        Number.isFinite(s.duration) &&
        s.duration >= 0 &&
        Number.isFinite(s.lastPositionSeconds) &&
        s.lastPositionSeconds >= 0 &&
        Number.isFinite(s.totalPlaybackWallSeconds) &&
        s.totalPlaybackWallSeconds >= 0 &&
        nonnegative(s.seekCount) &&
        Array.isArray(s.watchedIntervals) &&
        s.watchedIntervals.every(
          (i) => Array.isArray(i) && i.length === 2 && i.every(Number.isFinite),
        ) &&
        Array.isArray(s.events) &&
        Array.isArray(s.seekEvents) &&
        Array.isArray(s.playbackRateHistory) &&
        s.rateWallSeconds &&
        typeof s.rateWallSeconds === "object" &&
        !Array.isArray(s.rateWallSeconds) &&
        Object.entries(s.rateWallSeconds).every(
          ([rate, v]) =>
            Number.isFinite(Number(rate)) && Number(rate) > 0 && nonnegative(v),
        ) &&
        typeof s.reachedEnd === "boolean"
      ) {
        const restored: WatchSession = {
          ...s,
          events: s.events.slice(0, 200),
          seekEvents: s.seekEvents.slice(-500),
          playbackRateHistory: s.playbackRateHistory.slice(-200),
        };
        // Additive extension of the versioned v1 record: old progress needs no destructive migration.
        if (s.progressSummary)
          restored.progressSummary = progressSummary(
            restored,
            nonnegative(s.progressSummary.completionThreshold) &&
              s.progressSummary.completionThreshold <= 100
              ? s.progressSummary.completionThreshold
              : 90,
          );
        if (s.recentSessionSummaries !== undefined) {
          const ids = new Set<string>();
          restored.recentSessionSummaries = (
            Array.isArray(s.recentSessionSummaries)
              ? s.recentSessionSummaries
              : []
          )
            .filter((value): value is FinalSessionSummary => {
              if (
                !validFinal(value, student, video) ||
                ids.has(value.sessionId)
              )
                return false;
              ids.add(value.sessionId);
              return true;
            })
            .slice(0, SESSION_HISTORY_LIMIT);
        }
        return restored;
      }
    }
  } catch {
    /* Corrupt or inaccessible storage is treated as empty. */
  }
  return createSession(student, video);
}
export function persist(storage: StorageLike, session: WatchSession): boolean {
  try {
    storage.setItem(
      storageKey(session.studentId, session.videoId),
      JSON.stringify(session),
    );
    return true;
  } catch {
    return false;
  }
}
export function clearAll(storage: StorageLike) {
  const keys = Array.from({ length: storage.length }, (_, i) =>
    storage.key(i),
  ).filter((k): k is string => k !== null && k.startsWith(PREFIX));
  keys.forEach((k) => storage.removeItem(k));
}
