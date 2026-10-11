import type {
  Observation,
  PlaybackEvent,
  Tracker,
  WatchSession,
} from "../types";
import { mergeIntervals } from "./analytics";
export const TRACKING_VERSION = "1.0.0";
export const stateLabels: Record<number, string> = {
  [-1]: "Unstarted",
  0: "Ended",
  1: "Playing",
  2: "Paused",
  3: "Buffering",
  5: "Cued",
};
export function createSession(
  studentId: string,
  videoId: string,
): WatchSession {
  const now = new Date().toISOString();
  return {
    sessionId: crypto.randomUUID(),
    studentId,
    videoId,
    startedAt: now,
    lastUpdatedAt: now,
    duration: 0,
    lastPositionSeconds: 0,
    totalPlaybackWallSeconds: 0,
    watchedIntervals: [],
    seekCount: 0,
    seekEvents: [],
    playbackRateHistory: [],
    rateWallSeconds: {},
    events: [],
    reachedEnd: false,
  };
}
export function recordEvent(
  session: WatchSession,
  type: string,
  position: number,
  rate: number,
  details = "",
): WatchSession {
  const event: PlaybackEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type,
    positionSeconds: position,
    playbackRate: rate,
    details,
  };
  return {
    ...session,
    lastUpdatedAt: event.timestamp,
    events: [event, ...session.events].slice(0, 200),
    seekEvents:
      type === "seek"
        ? [...session.seekEvents, event].slice(-500)
        : session.seekEvents,
    playbackRateHistory:
      type === "rate"
        ? [...session.playbackRateHistory, event].slice(-200)
        : session.playbackRateHistory,
  };
}
// Maximum credible gap is deliberately short: background/throttled playback is undercounted.
export function observe(tracker: Tracker, current: Observation): Tracker {
  if (
    ![current.position, current.mono, current.rate].every(Number.isFinite) ||
    current.position < 0 ||
    current.rate <= 0
  )
    return { ...tracker, previous: null };
  let s = {
    ...tracker.session,
    lastPositionSeconds: current.position,
    lastUpdatedAt: new Date().toISOString(),
  };
  if (Number.isFinite(current.duration) && current.duration > 0) {
    s.duration = current.duration;
    s.watchedIntervals = mergeIntervals(s.watchedIntervals, current.duration);
    s.lastPositionSeconds = Math.min(current.position, current.duration);
  }
  const p = tracker.previous;
  if (p && p.visible && current.visible) {
    const elapsed = (current.mono - p.mono) / 1000;
    const delta = current.position - p.position;
    const expected = elapsed * p.rate;
    const tolerance = Math.max(0.35, expected * 0.3);
    if (elapsed > 3) {
      s = recordEvent(
        s,
        "gap",
        current.position,
        current.rate,
        "Sampling gap; no playback credited.",
      );
    } else if (elapsed > 0) {
      const playing = p.state === 1;
      const plausible =
        playing && delta > 0 && Math.abs(delta - expected) <= tolerance;
      const discontinuity =
        delta < -0.35 || delta > (playing ? expected + tolerance : 0.75);
      if (discontinuity) {
        s = recordEvent(
          { ...s, seekCount: s.seekCount + 1 },
          "seek",
          current.position,
          current.rate,
          `${delta >= 0 ? "Forward" : "Backward"}: ${p.position.toFixed(1)}s → ${current.position.toFixed(1)}s (inferred)`,
        );
      } else if (plausible && s.duration > 0 && p.rate === current.rate) {
        const wall = Math.min(elapsed, delta / p.rate);
        s = {
          ...s,
          totalPlaybackWallSeconds: s.totalPlaybackWallSeconds + wall,
          watchedIntervals: mergeIntervals(
            [...s.watchedIntervals, [p.position, current.position]],
            s.duration,
          ),
          rateWallSeconds: {
            ...s.rateWallSeconds,
            [p.rate]: (s.rateWallSeconds[p.rate] ?? 0) + wall,
          },
        };
      }
    }
  }
  return { session: s, previous: current };
}
