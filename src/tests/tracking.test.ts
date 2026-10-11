import { describe, it, expect } from "vitest";
import type { Observation, Tracker } from "../types";
import { createSession, observe } from "../lib/watchTracker";
import { mergeIntervals, metrics } from "../lib/analytics";
import {
  persist,
  restore,
  clearAll,
  storageKey,
  type StorageLike,
} from "../lib/storage";
import { parseVideoId } from "../lib/youtubeUrl";
function initial(): Tracker {
  return { session: createSession("a", "M7lc1UVf-VE"), previous: null };
}
function sample(
  t: Tracker,
  position: number,
  mono: number,
  options: Partial<Observation> = {},
) {
  return observe(t, {
    position,
    mono,
    duration: 600,
    rate: 1,
    state: 1,
    visible: true,
    ...options,
  });
}
function play(rate = 1) {
  let t = sample(initial(), 0, 0, { rate });
  for (let i = 1; i <= 20; i++)
    t = sample(t, i * 0.5 * rate, i * 500, { rate });
  return t;
}
describe("observation engine", () => {
  it("credits continuous 1x playback", () => {
    const t = play();
    expect(metrics(t.session).covered).toBe(10);
    expect(t.session.totalPlaybackWallSeconds).toBe(10);
  });
  it("credits 2x content separately from wall time", () => {
    const t = play(2);
    expect(metrics(t.session).covered).toBe(20);
    expect(t.session.totalPlaybackWallSeconds).toBe(10);
    expect(t.session.rateWallSeconds["2"]).toBe(10);
  });
  it.each([2, 3])("does not credit paused/buffering state %s", (state) => {
    let t = sample(initial(), 0, 0, { state });
    t = sample(t, 0, 500, { state });
    expect(t.session.totalPlaybackWallSeconds).toBe(0);
    expect(metrics(t.session).covered).toBe(0);
  });
  it("does not credit a forward seek", () => {
    const t = sample(play(), 420, 10500);
    expect(t.session.seekCount).toBe(1);
    expect(metrics(t.session).covered).toBe(10);
    expect(t.session.seekEvents[0].details).toContain("Forward");
  });
  it("rewatching adds wall time but not duplicate coverage", () => {
    let t = sample(play(), 0, 10500);
    for (let i = 1; i <= 20; i++) t = sample(t, i * 0.5, 10500 + i * 500);
    expect(t.session.seekCount).toBe(1);
    expect(metrics(t.session).covered).toBe(10);
    expect(t.session.totalPlaybackWallSeconds).toBe(20);
  });
  it("rejects a large timer gap even if position looks plausible", () => {
    const t = sample(play(), 30, 30000);
    expect(metrics(t.session).covered).toBe(10);
    expect(t.session.events[0].type).toBe("gap");
  });
  it("rejects hidden playback and reestablishes a baseline", () => {
    let t = sample(play(), 10.5, 10500, { visible: false });
    t = sample(t, 11, 11000);
    expect(metrics(t.session).covered).toBe(10);
  });
  it("does not bridge a rate transition", () => {
    const t = sample(play(), 11, 10500, { rate: 2 });
    expect(metrics(t.session).covered).toBe(10);
  });
  it("detects seeks while paused", () => {
    let t = sample(initial(), 10, 0, { state: 2 });
    t = sample(t, 100, 500, { state: 2 });
    expect(t.session.seekCount).toBe(1);
    expect(t.session.totalPlaybackWallSeconds).toBe(0);
  });
  it("handles initially unknown and invalid duration", () => {
    let t = sample(initial(), 0, 0, { duration: 0 });
    t = sample(t, 0.5, 500, { duration: NaN });
    expect(metrics(t.session).percentage).toBe(0);
    t = sample(t, 1, 1000);
    expect(metrics(t.session).covered).toBe(0.5);
  });
  it("invalid observations break the baseline", () => {
    const t = sample(play(), NaN, 10500);
    expect(t.previous).toBeNull();
    expect(t.session.totalPlaybackWallSeconds).toBe(10);
  });
  it("does not credit stationary playing samples", () => {
    const t = sample(play(), 10, 10500);
    expect(t.session.totalPlaybackWallSeconds).toBe(10);
  });
});
describe("coverage and completion", () => {
  it("merges overlap and adjacency without mutating input", () => {
    const i: [number, number][] = [
      [0, 10],
      [8, 20],
      [20, 25],
    ];
    expect(mergeIntervals(i, 600)).toEqual([[0, 25]]);
    expect(i[0]).toEqual([0, 10]);
  });
  it("clamps to duration and drops invalid intervals", () =>
    expect(
      mergeIntervals(
        [
          [-10, 10],
          [90, 120],
          [120, 130],
          [NaN, 5],
          [7, 2],
        ],
        100,
      ),
    ).toEqual([
      [0, 10],
      [90, 100],
    ]));
  it.each([0, -1, NaN, Infinity])("rejects invalid duration %s", (d) =>
    expect(mergeIntervals([[0, 10]], d)).toEqual([]),
  );
  it("requires coverage AND ended", () => {
    const s = {
      ...initial().session,
      duration: 100,
      watchedIntervals: [[0, 90]] as [number, number][],
    };
    expect(metrics(s).completed).toBe(false);
    expect(metrics({ ...s, reachedEnd: true }).completed).toBe(true);
    expect(metrics({ ...s, reachedEnd: true }, 95).completed).toBe(false);
  });
  it("ENDED alone is not completion", () =>
    expect(
      metrics({
        ...initial().session,
        duration: 600,
        reachedEnd: true,
        lastPositionSeconds: 600,
      }).completed,
    ).toBe(false));
  it("matches a 10 minute lecture with a 5 minute skip", () => {
    const s = {
      ...initial().session,
      duration: 600,
      watchedIntervals: [
        [0, 120],
        [420, 480],
      ] as [number, number][],
    };
    expect(metrics(s).covered).toBe(180);
    expect(metrics(s).percentage).toBe(30);
  });
});
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
describe("persistence", () => {
  it("serializes and restores progress", () => {
    const storage = new MemoryStorage();
    const s = play().session;
    expect(persist(storage, s)).toBe(true);
    expect(restore(storage, s.studentId, s.videoId)).toEqual(s);
  });
  it("separates both student and video", () => {
    const storage = new MemoryStorage();
    persist(storage, play().session);
    expect(restore(storage, "b", "M7lc1UVf-VE").watchedIntervals).toEqual([]);
    expect(restore(storage, "a", "another1234").watchedIntervals).toEqual([]);
  });
  it("recovers corrupt or mismatched records", () => {
    const storage = new MemoryStorage();
    storage.setItem(storageKey("a", "v"), "broken");
    expect(restore(storage, "a", "v").events).toEqual([]);
    storage.setItem(storageKey("a", "v"), JSON.stringify(play().session));
    expect(restore(storage, "a", "v").videoId).toBe("v");
  });
  it("reports quota failures", () => {
    const storage = new MemoryStorage();
    storage.setItem = () => {
      throw Error("Quota");
    };
    expect(persist(storage, play().session)).toBe(false);
  });
  it("clears only app-owned keys", () => {
    const storage = new MemoryStorage();
    storage.setItem("other", "safe");
    persist(storage, play().session);
    clearAll(storage);
    expect(storage.length).toBe(1);
    expect(storage.getItem("other")).toBe("safe");
  });
});
describe("YouTube URL validation", () => {
  it.each([
    "M7lc1UVf-VE",
    "https://youtu.be/M7lc1UVf-VE?t=10",
    "https://youtube.com/watch?v=M7lc1UVf-VE",
    "https://www.youtube.com/embed/M7lc1UVf-VE",
    "https://m.youtube.com/shorts/M7lc1UVf-VE",
  ])("accepts %s", (input) => expect(parseVideoId(input)).toBe("M7lc1UVf-VE"));
  it.each([
    "bad",
    "https://evil.com/watch?v=M7lc1UVf-VE",
    "https://youtube.com.evil.com/embed/M7lc1UVf-VE",
    "javascript:M7lc1UVf-VE",
  ])("rejects %s", (input) => expect(parseVideoId(input)).toBeNull());
});
