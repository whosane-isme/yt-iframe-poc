import type { WatchSession } from "../types";
import { createSession } from "./watchTracker";
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
        typeof s.startedAt === "string" &&
        Number.isFinite(s.duration) &&
        s.duration >= 0 &&
        Number.isFinite(s.lastPositionSeconds) &&
        s.lastPositionSeconds >= 0 &&
        Number.isFinite(s.totalPlaybackWallSeconds) &&
        s.totalPlaybackWallSeconds >= 0 &&
        Number.isFinite(s.seekCount) &&
        Array.isArray(s.watchedIntervals) &&
        s.watchedIntervals.every(
          (i) => Array.isArray(i) && i.length === 2 && i.every(Number.isFinite),
        ) &&
        Array.isArray(s.events) &&
        Array.isArray(s.seekEvents) &&
        Array.isArray(s.playbackRateHistory) &&
        s.rateWallSeconds &&
        typeof s.rateWallSeconds === "object" &&
        Object.values(s.rateWallSeconds).every(
          (v) => Number.isFinite(v) && v >= 0,
        ) &&
        typeof s.reachedEnd === "boolean"
      )
        return s;
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
