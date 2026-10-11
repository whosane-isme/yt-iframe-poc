import type {
  FinalSessionSummary,
  ProgressSummary,
  SessionBaseline,
  WatchSession,
} from "../types";
import { formatTime, metrics } from "./analytics";
export const CHECKPOINT_INTERVAL_MS = 20_000;
export const SESSION_HISTORY_LIMIT = 10;
export function weightedAverageSpeed(
  distribution: Record<string, number>,
): number | null {
  let seconds = 0,
    weighted = 0;
  for (const [key, time] of Object.entries(distribution)) {
    const rate = Number(key);
    if (
      Number.isFinite(rate) &&
      rate > 0 &&
      Number.isFinite(time) &&
      time > 0
    ) {
      seconds += time;
      weighted += rate * time;
    }
  }
  const average = weighted / seconds;
  return seconds > 0 && Number.isFinite(average) ? average : null;
}
export function progressSummary(
  session: WatchSession,
  threshold = 90,
): ProgressSummary {
  threshold = Number.isFinite(threshold)
    ? Math.min(100, Math.max(0, threshold))
    : 90;
  const m = metrics(session, threshold);
  const known = Number.isFinite(session.duration) && session.duration > 0;
  return {
    studentId: session.studentId,
    videoId: session.videoId,
    durationSeconds: known ? session.duration : null,
    uniqueWatchedSeconds: m.covered,
    coveragePercentage: known ? m.percentage : null,
    totalPlaybackWallSeconds: session.totalPlaybackWallSeconds,
    lastPositionSeconds: session.lastPositionSeconds,
    seekCount: session.seekCount,
    rateWallSeconds: { ...session.rateWallSeconds },
    weightedAverageSpeed: weightedAverageSpeed(session.rateWallSeconds),
    reachedEnd: session.reachedEnd,
    coverageThresholdSatisfied: known && m.percentage >= threshold,
    completionThreshold: threshold,
    completed: known && m.completed,
    lastUpdatedAt: session.lastUpdatedAt,
  };
}
export function checkpoint(
  session: WatchSession,
  threshold = 90,
): WatchSession {
  return { ...session, progressSummary: progressSummary(session, threshold) };
}
export function beginSession(
  session: WatchSession,
  sessionId: string,
  startedAt: string,
): SessionBaseline {
  return {
    sessionId,
    startedAt,
    playbackWallSeconds: session.totalPlaybackWallSeconds,
    coveredSeconds: metrics(session).covered,
    seekCount: session.seekCount,
    rateWallSeconds: { ...session.rateWallSeconds },
  };
}
export function finalizeSession(
  session: WatchSession,
  baseline: SessionBaseline | null,
  reason: FinalSessionSummary["endingReason"],
  endedAt: string,
  threshold = 90,
): WatchSession {
  if (
    !baseline ||
    session.recentSessionSummaries?.some(
      (s) => s.sessionId === baseline.sessionId,
    )
  )
    return session;
  if (reason === "video_ended") session = { ...session, reachedEnd: true };
  const progress = progressSummary(session, threshold);
  const distribution: Record<string, number> = {};
  for (const [rate, total] of Object.entries(session.rateWallSeconds)) {
    const delta = Math.max(0, total - (baseline.rateWallSeconds[rate] ?? 0));
    if (delta > 0) distribution[rate] = delta;
  }
  const summary: FinalSessionSummary = {
    sessionId: baseline.sessionId,
    studentId: session.studentId,
    videoId: session.videoId,
    startedAt: baseline.startedAt,
    endedAt,
    playbackWallSeconds: Math.max(
      0,
      session.totalPlaybackWallSeconds - baseline.playbackWallSeconds,
    ),
    newlyCoveredSeconds: Math.max(
      0,
      progress.uniqueWatchedSeconds - baseline.coveredSeconds,
    ),
    cumulativeCoveredSeconds: progress.uniqueWatchedSeconds,
    cumulativeCoveragePercentage: progress.coveragePercentage,
    seekCount: Math.max(0, session.seekCount - baseline.seekCount),
    rateWallSeconds: distribution,
    weightedAverageSpeed: weightedAverageSpeed(distribution),
    reachedEnd: progress.reachedEnd,
    coverageThresholdSatisfied: progress.coverageThresholdSatisfied,
    completionThreshold: progress.completionThreshold,
    completed: progress.completed,
    endingReason: reason,
  };
  return {
    ...session,
    progressSummary: progress,
    recentSessionSummaries: [
      summary,
      ...(session.recentSessionSummaries ?? []),
    ].slice(0, SESSION_HISTORY_LIMIT),
  };
}
export function readableSummary(
  summary: ProgressSummary,
  studentName: string,
): string {
  const coverage =
    summary.coveragePercentage === null
      ? "Not available"
      : `${summary.coveragePercentage.toFixed(1)}%`;
  const speed =
    summary.weightedAverageSpeed === null
      ? "Not available"
      : `${summary.weightedAverageSpeed.toFixed(2)}×`;
  return `${studentName}: unique lecture coverage is ${coverage}. Total observed playback time is ${formatTime(summary.totalPlaybackWallSeconds)}. ${summary.seekCount} inferred seek ${summary.seekCount === 1 ? "operation was" : "operations were"} detected. Average observed speed is ${speed}. ${summary.completed ? "The lecture meets the application completion rule." : `The lecture has not yet met the ${summary.completionThreshold}% coverage plus reached-end requirement.`}`;
}
