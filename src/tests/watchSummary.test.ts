import { describe, it, expect } from "vitest";
import type { Tracker, WatchSession } from "../types";
import { createSession, observe } from "../lib/watchTracker";
import {
  beginSession,
  checkpoint,
  finalizeSession,
  progressSummary,
  readableSummary,
  weightedAverageSpeed,
} from "../lib/watchSummary";
import { persist, restore, storageKey, type StorageLike } from "../lib/storage";
const start = "2026-10-12T00:00:00Z",
  end = "2026-10-12T00:01:00Z";
function fresh() {
  return createSession("a", "M7lc1UVf-VE");
}
function sample(t: Tracker, p: number, mono: number, rate = 1) {
  return observe(t, {
    position: p,
    mono,
    rate,
    duration: 100,
    state: 1,
    visible: true,
  });
}
function play(session = fresh(), rate = 1, position = 0) {
  let t = sample({ session, previous: null }, position, 0, rate);
  for (let i = 1; i <= 20; i++)
    t = sample(t, position + i * 0.5 * rate, i * 500, rate);
  return t.session;
}
class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}
describe("automatic cumulative reports", () => {
  it("normalizes invalid thresholds and rejects completion for unknown duration", () => {
    expect(progressSummary(fresh(), NaN).completionThreshold).toBe(90);
    expect(
      progressSummary({ ...fresh(), duration: Infinity, reachedEnd: true }, 0)
        .completed,
    ).toBe(false);
  });
  it("summarizes normal observed playback", () => {
    const s = progressSummary(play());
    expect(s.uniqueWatchedSeconds).toBe(10);
    expect(s.coveragePercentage).toBe(10);
    expect(s.totalPlaybackWallSeconds).toBe(10);
    expect(s.lastPositionSeconds).toBe(10);
    expect(s.weightedAverageSpeed).toBe(1);
    expect(s.completed).toBe(false);
  });
  it("distinguishes 2x content from real world time", () => {
    const s = progressSummary(play(fresh(), 2));
    expect(s.uniqueWatchedSeconds).toBe(20);
    expect(s.totalPlaybackWallSeconds).toBe(10);
    expect(s.rateWallSeconds).toEqual({ "2": 10 });
    expect(s.weightedAverageSpeed).toBe(2);
  });
  it("forward seek adds no skipped content", () => {
    let t: Tracker = {
      session: play(),
      previous: {
        position: 10,
        mono: 10000,
        rate: 1,
        duration: 100,
        state: 1,
        visible: true,
      },
    };
    t = sample(t, 80, 10500);
    const s = progressSummary(t.session);
    expect(s.seekCount).toBe(1);
    expect(s.uniqueWatchedSeconds).toBe(10);
    expect(s.totalPlaybackWallSeconds).toBe(10);
  });
  it("rewatching increases time without increasing cumulative coverage", () => {
    const s = progressSummary(play(play()));
    expect(s.totalPlaybackWallSeconds).toBe(20);
    expect(s.uniqueWatchedSeconds).toBe(10);
  });
  it("weights speed by wall time, rather than number of changes", () =>
    expect(weightedAverageSpeed({ "1": 30, "2": 10 })).toBe(1.25));
  it("handles no valid speed evidence without NaN", () => {
    expect(weightedAverageSpeed({})).toBeNull();
    expect(
      weightedAverageSpeed({ "1": 0, "2": NaN, bad: 10, "3": -1 }),
    ).toBeNull();
    expect(weightedAverageSpeed({ "1": 5, bad: 10 })).toBe(1);
  });
  it("shows Not available for unknown duration and speed", () => {
    const s = progressSummary(fresh());
    expect(s.coveragePercentage).toBeNull();
    expect(s.durationSeconds).toBeNull();
    expect(readableSummary(s, "Student A")).toContain("Not available");
    expect(JSON.stringify(s)).not.toContain("NaN");
  });
  it("creates a calculated checkpoint while preserving merged intervals", () => {
    const source = play();
    const s = checkpoint(source, 95);
    expect(s.progressSummary?.completionThreshold).toBe(95);
    expect(s.watchedIntervals).toEqual(source.watchedIntervals);
    expect(s.recentSessionSummaries).toBeUndefined();
  });
  it("distinguishes threshold, reached end, and completion", () => {
    const s = { ...play(), watchedIntervals: [[0, 90]] as [number, number][] };
    expect(progressSummary(s).coverageThresholdSatisfied).toBe(true);
    expect(progressSummary(s).reachedEnd).toBe(false);
    expect(progressSummary(s).completed).toBe(false);
  });
});
describe("logical session finalization", () => {
  it("manual ending creates a partial summary", () => {
    const source = fresh();
    const base = beginSession(source, "one", start);
    const s = finalizeSession(play(source), base, "manual_end", end);
    expect(s.recentSessionSummaries?.[0]).toMatchObject({
      sessionId: "one",
      playbackWallSeconds: 10,
      newlyCoveredSeconds: 10,
      cumulativeCoveragePercentage: 10,
      completed: false,
      endingReason: "manual_end",
    });
  });
  it("ENDED with adequate coverage completes according to the rule", () => {
    const source = fresh();
    const s = {
      ...play(source),
      watchedIntervals: [[0, 90]] as [number, number][],
    };
    const result = finalizeSession(
      s,
      beginSession(source, "one", start),
      "video_ended",
      end,
    );
    expect(result.recentSessionSummaries?.[0]).toMatchObject({
      reachedEnd: true,
      coverageThresholdSatisfied: true,
      completed: true,
    });
  });
  it("ENDED without adequate coverage is still partial", () => {
    const source = fresh();
    const s = finalizeSession(
      play(source),
      beginSession(source, "one", start),
      "video_ended",
      end,
    );
    expect(s.recentSessionSummaries?.[0]).toMatchObject({
      reachedEnd: true,
      completed: false,
    });
  });
  it("repeated ENDED and manual ending cannot duplicate an ID", () => {
    const source = fresh();
    const base = beginSession(source, "one", start);
    const s = finalizeSession(play(source), base, "video_ended", end);
    expect(finalizeSession(s, base, "video_ended", end)).toBe(s);
    expect(finalizeSession(s, base, "manual_end", end)).toBe(s);
    expect(finalizeSession(s, null, "manual_end", end)).toBe(s);
  });
  it("subsequent sessions accumulate unique coverage using baseline deltas", () => {
    let s = fresh();
    s = finalizeSession(
      play(s),
      beginSession(s, "one", start),
      "manual_end",
      end,
    );
    const baseline = beginSession(s, "two", start);
    s = finalizeSession(play(s, 2, 20), baseline, "manual_end", end);
    const latest = s.recentSessionSummaries![0];
    expect(latest.playbackWallSeconds).toBe(10);
    expect(latest.newlyCoveredSeconds).toBe(20);
    expect(latest.rateWallSeconds).toEqual({ "2": 10 });
    expect(latest.cumulativeCoveredSeconds).toBe(30);
    expect(s.totalPlaybackWallSeconds).toBe(20);
    expect(s.recentSessionSummaries).toHaveLength(2);
  });
  it("session seek totals exclude older seeks", () => {
    const s = { ...play(), seekCount: 3 };
    const b = beginSession(s, "two", start);
    const finalized = finalizeSession(
      { ...s, seekCount: 5 },
      b,
      "manual_end",
      end,
    );
    expect(finalized.recentSessionSummaries![0].seekCount).toBe(2);
  });
  it("replayed content contributes zero newly covered seconds in the new session", () => {
    const s = play();
    const result = finalizeSession(
      play(s),
      beginSession(s, "two", start),
      "manual_end",
      end,
    );
    expect(result.recentSessionSummaries![0].newlyCoveredSeconds).toBe(0);
    expect(result.recentSessionSummaries![0].playbackWallSeconds).toBe(10);
  });
  it("retains only the most recent ten summaries without interval copies", () => {
    let s = fresh();
    for (let i = 0; i < 15; i++) {
      const b = beginSession(s, String(i), start);
      s = finalizeSession(play(s), b, "manual_end", end);
    }
    expect(s.recentSessionSummaries).toHaveLength(10);
    expect(s.recentSessionSummaries![0].sessionId).toBe("14");
    expect(s.recentSessionSummaries![9].sessionId).toBe("5");
    expect(s.totalPlaybackWallSeconds).toBe(150);
    expect(s.recentSessionSummaries![0]).not.toHaveProperty("watchedIntervals");
  });
  it("checkpointing a pause does not finalize a session", () => {
    const s = checkpoint(play());
    expect(s.recentSessionSummaries).toBeUndefined();
  });
});
describe("summary persistence and compatibility", () => {
  it("restores checkpoint and final summary on refresh", () => {
    const storage = new MemoryStorage();
    const source = fresh();
    const s = finalizeSession(
      play(source),
      beginSession(source, "one", start),
      "manual_end",
      end,
      95,
    );
    expect(persist(storage, s)).toBe(true);
    expect(restore(storage, "a", "M7lc1UVf-VE")).toEqual(s);
  });
  it("isolates different students and videos", () => {
    const storage = new MemoryStorage();
    const source = fresh();
    persist(
      storage,
      finalizeSession(
        play(source),
        beginSession(source, "one", start),
        "manual_end",
        end,
      ),
    );
    expect(restore(storage, "b", "M7lc1UVf-VE").totalPlaybackWallSeconds).toBe(
      0,
    );
    expect(
      restore(storage, "a", "different11").recentSessionSummaries,
    ).toBeUndefined();
  });
  it("preserves legacy v1 demo totals with no summary fields", () => {
    const storage = new MemoryStorage();
    const s = play();
    storage.setItem(storageKey("a", s.videoId), JSON.stringify(s));
    expect(restore(storage, "a", s.videoId)).toEqual(s);
    expect(
      checkpoint(restore(storage, "a", s.videoId)).progressSummary
        ?.uniqueWatchedSeconds,
    ).toBe(10);
  });
  it("discards corrupt summaries while preserving valid cumulative progress", () => {
    const storage = new MemoryStorage();
    const s = {
      ...play(),
      recentSessionSummaries: [{ sessionId: "broken" }],
      progressSummary: { completionThreshold: NaN },
    };
    storage.setItem(storageKey("a", s.videoId), JSON.stringify(s));
    const restored = restore(storage, "a", s.videoId);
    expect(restored.totalPlaybackWallSeconds).toBe(10);
    expect(restored.recentSessionSummaries).toEqual([]);
    expect(restored.progressSummary?.completionThreshold).toBe(90);
  });
  it("deduplicates restored session history", () => {
    const storage = new MemoryStorage();
    const source = fresh();
    const s = finalizeSession(
      play(source),
      beginSession(source, "one", start),
      "manual_end",
      end,
    );
    s.recentSessionSummaries!.push(s.recentSessionSummaries![0]);
    persist(storage, s);
    expect(
      restore(storage, "a", s.videoId).recentSessionSummaries,
    ).toHaveLength(1);
  });
});
