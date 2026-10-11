// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { StrictMode } from "react";
import type { Player, YouTubeAPI } from "../types";
import { useWatchPlayer } from "../hooks/useWatchPlayer";
import { PlayerCustomizationLab } from "../components/PlayerCustomizationLab";
import {
  CAPABILITY_MATRIX,
  CustomizationLimitations,
} from "../components/CustomizationLimitations";
import {
  DEFAULT_INITIALIZATION,
  DEFAULT_SETTINGS,
  presetSettings,
  type PlayerInitialization,
} from "../lib/playerConfig";
import { EMPTY_LIVE_STATE, runPlayerCommand } from "../lib/playerControls";
import { createSession } from "../lib/watchTracker";
import { persist, restore } from "../lib/storage";
vi.mock("../lib/youtubeApi", () => ({
  loadYouTubeAPI: () => Promise.resolve({ Player: MockPlayer }),
}));
const players: MockPlayer[] = [];
class MockPlayer implements Player {
  position = 0;
  state = -1;
  rate = 1;
  volume = 100;
  muted = false;
  destroyed = false;
  captions = false;
  captionSize = 0;
  constructor(
    _element: HTMLElement,
    public options: ConstructorParameters<YouTubeAPI["Player"]>[1],
  ) {
    players.push(this);
  }
  emit(state: number) {
    this.state = state;
    this.options.events.onStateChange({ target: this, data: state });
  }
  ready() {
    this.options.events.onReady({ target: this, data: 0 });
  }
  getCurrentTime() {
    return this.position;
  }
  getDuration() {
    return 100;
  }
  getPlaybackRate() {
    return this.rate;
  }
  getPlayerState() {
    return this.state;
  }
  getVideoUrl() {
    return "https://www.youtube.com/watch?v=M7lc1UVf-VE";
  }
  getAvailablePlaybackRates() {
    return [1, 2];
  }
  seekTo = vi.fn((p: number) => {
    this.position = p;
  });
  playVideo = vi.fn(() => this.emit(1));
  pauseVideo = vi.fn(() => this.emit(2));
  stopVideo = vi.fn(() => this.emit(0));
  setPlaybackRate = vi.fn((rate: number) => {
    this.rate = rate;
    this.options.events.onPlaybackRateChange({ target: this, data: rate });
  });
  mute() {
    this.muted = true;
  }
  unMute() {
    this.muted = false;
  }
  isMuted() {
    return this.muted;
  }
  getVolume() {
    return this.volume;
  }
  setVolume(v: number) {
    this.volume = v;
  }
  getOptions(module?: string) {
    return this.captions ? (module ? ["fontSize"] : ["captions"]) : [];
  }
  getOption() {
    return this.captionSize;
  }
  setOption(_module: string, _option: string, value: number | boolean) {
    this.captionSize = Number(value);
  }
  destroy() {
    this.destroyed = true;
    this.emit(0);
  }
}
beforeEach(() => {
  players.length = 0;
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
  });
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "Date", "performance"],
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function setup(init = DEFAULT_INITIALIZATION) {
  const hook = renderHook(
    ({ config }: { config: PlayerInitialization }) =>
      useWatchPlayer("a", "M7lc1UVf-VE", 90, config),
    { initialProps: { config: init }, wrapper: StrictMode },
  );
  hook.result.current.host.current = document.createElement("div");
  await act(async () => {
    await Promise.resolve();
  });
  act(() => players.at(-1)!.ready());
  return hook;
}
function advance(player: MockPlayer, position: number, milliseconds: number) {
  act(() => {
    player.position = position;
    vi.advanceTimersByTime(milliseconds);
  });
}
describe("player lifecycle and analytics", () => {
  it("restores the saved full-lecture position when leaving a segment after page reload", async () => {
    const seed = createSession("a", "M7lc1UVf-VE");
    seed.lastPositionSeconds = 40;
    seed.duration = 100;
    persist(window.localStorage, seed);
    const hook = await setup({
      settings: { ...DEFAULT_SETTINGS, startSeconds: 10, endSeconds: 15 },
      revision: 0,
      autoplayAuthorized: false,
    });
    await act(async () => {
      hook.rerender({
        config: {
          settings: DEFAULT_SETTINGS,
          revision: 1,
          autoplayAuthorized: false,
        },
      });
      await Promise.resolve();
    });
    expect(players.at(-1)!.options.playerVars.start).toBe(40);
    expect(hook.result.current.session.reachedEnd).toBe(false);
  });
  it("retains the open lecture session while entering and leaving a segment experiment", async () => {
    const hook = await setup();
    const first = players.at(-1)!;
    act(() => first.playVideo());
    advance(first, 1.5, 1500);
    const before = hook.result.current.session.totalPlaybackWallSeconds;
    await act(async () => {
      hook.rerender({
        config: {
          settings: { ...DEFAULT_SETTINGS, startSeconds: 10, endSeconds: 15 },
          revision: 1,
          autoplayAuthorized: false,
        },
      });
      await Promise.resolve();
    });
    const segment = players.at(-1)!;
    act(() => {
      segment.ready();
      segment.position = 10;
      segment.playVideo();
    });
    advance(segment, 15, 1500);
    act(() => segment.emit(0));
    expect(hook.result.current.session.totalPlaybackWallSeconds).toBe(before);
    expect(hook.result.current.session.reachedEnd).toBe(false);
    expect(hook.result.current.sessionActive).toBe(true);
    await act(async () => {
      hook.rerender({
        config: {
          settings: DEFAULT_SETTINGS,
          revision: 2,
          autoplayAuthorized: false,
        },
      });
      await Promise.resolve();
    });
    const restored = players.at(-1)!;
    act(() => {
      restored.ready();
      restored.position = Number(restored.options.playerVars.start ?? 0);
      restored.playVideo();
      hook.result.current.endSession();
    });
    expect(hook.result.current.session.seekCount).toBe(0);
    expect(hook.result.current.session.recentSessionSummaries).toHaveLength(1);
    expect(
      hook.result.current.session.recentSessionSummaries![0]
        .playbackWallSeconds,
    ).toBe(before);
  });
  it("keeps progress, position and one logical session across settings reloads", async () => {
    const seed = createSession("a", "M7lc1UVf-VE");
    seed.duration = 100;
    seed.watchedIntervals = [[0, 10]];
    seed.totalPlaybackWallSeconds = 10;
    seed.rateWallSeconds = { "1": 10 };
    persist(window.localStorage, seed);
    const hook = await setup();
    const first = players.at(-1)!;
    act(() => first.playVideo());
    advance(first, 1.5, 1500);
    expect(hook.result.current.sessionActive).toBe(true);
    const time = hook.result.current.session.totalPlaybackWallSeconds;
    await act(async () => {
      hook.rerender({
        config: {
          settings: presetSettings("classroom"),
          revision: 1,
          autoplayAuthorized: false,
        },
      });
      await Promise.resolve();
    });
    const second = players.at(-1)!;
    expect(first.destroyed).toBe(true);
    expect(second.options.playerVars.start).toBe(1);
    act(() => second.ready());
    expect(hook.result.current.session.totalPlaybackWallSeconds).toBe(time);
    expect(hook.result.current.session.lastPositionSeconds).toBe(1.5);
    expect(hook.result.current.session.reachedEnd).toBe(false);
    expect(hook.result.current.session.recentSessionSummaries).toBeUndefined();
    expect(hook.result.current.sessionActive).toBe(true);
    act(() => {
      second.position = 1;
      second.playVideo();
    });
    expect(hook.result.current.session.seekCount).toBe(0);
    act(() => hook.result.current.endSession());
    expect(hook.result.current.session.recentSessionSummaries).toHaveLength(1);
    expect(
      hook.result.current.session.recentSessionSummaries![0]
        .playbackWallSeconds,
    ).toBeCloseTo(1.5);
    expect(
      restore(window.localStorage, "a", "M7lc1UVf-VE").watchedIntervals,
    ).toEqual([[0, 10]]);
  });
  it("suspends segment playback, seeks and ENDED without affecting lecture evidence", async () => {
    const init = {
      settings: { ...DEFAULT_SETTINGS, startSeconds: 10, endSeconds: 20 },
      revision: 1,
      autoplayAuthorized: false,
    };
    const hook = await setup(init);
    const player = players.at(-1)!;
    act(() => {
      player.position = 10;
      player.playVideo();
    });
    advance(player, 11.5, 1500);
    act(() => {
      player.position = 20;
      player.emit(0);
      hook.result.current.endSession();
    });
    expect(hook.result.current.trackingSuspended).toBe(true);
    expect(hook.result.current.session.totalPlaybackWallSeconds).toBe(0);
    expect(hook.result.current.session.watchedIntervals).toEqual([]);
    expect(hook.result.current.session.reachedEnd).toBe(false);
    expect(hook.result.current.session.recentSessionSummaries).toBeUndefined();
  });
  it("API speed and seeking reuse the original tracker", async () => {
    const hook = await setup();
    const player = players.at(-1)!;
    act(() => hook.result.current.command({ type: "play" }));
    advance(player, 1.5, 1500);
    act(() => hook.result.current.command({ type: "rate", value: 2 }));
    advance(player, 2.5, 500);
    advance(player, 3.5, 500);
    expect(hook.result.current.session.rateWallSeconds["2"]).toBeCloseTo(0.5);
    act(() => hook.result.current.command({ type: "seek", value: 70 }));
    advance(player, 70, 500);
    expect(hook.result.current.session.seekCount).toBe(1);
    expect(
      hook.result.current.session.watchedIntervals.at(-1)![1],
    ).toBeLessThan(10);
  });
  it("stop does not treat an API stopped/ENDED state as lecture completion", async () => {
    const hook = await setup();
    act(() => {
      hook.result.current.command({ type: "play" });
      hook.result.current.command({ type: "stop" });
    });
    expect(hook.result.current.session.reachedEnd).toBe(false);
    expect(hook.result.current.session.recentSessionSummaries).toBeUndefined();
  });
  it("caption size is enabled only when the documented module is available", async () => {
    const hook = await setup();
    const player = players.at(-1)!;
    expect(hook.result.current.live.captionSizesAvailable).toBe(false);
    act(() => {
      player.captions = true;
      player.options.events.onApiChange({ target: player, data: 0 });
      hook.result.current.command({ type: "captionSize", value: 2 });
    });
    expect(player.captionSize).toBe(2);
  });
  it("runtime commands validate rates and use API volume/mute methods", () => {
    const player = new MockPlayer(document.createElement("div"), {
      videoId: "M7lc1UVf-VE",
      width: "100%",
      height: "100%",
      playerVars: {},
      events: {},
    });
    expect(() =>
      runPlayerCommand(player, { type: "rate", value: 3 }),
    ).toThrow();
    runPlayerCommand(player, { type: "volume", value: 120 });
    expect(player.volume).toBe(100);
    runPlayerCommand(player, { type: "mute" });
    expect(player.isMuted()).toBe(true);
    expect(() =>
      runPlayerCommand(player, { type: "captionSize", value: 1 }),
    ).toThrow();
  });
});
describe("accessible optional customization UI", () => {
  it("offers labelled settings, explicit apply, and disabled unavailable captions", () => {
    const onApply = vi.fn(() => true);
    render(
      <PlayerCustomizationLab
        settings={DEFAULT_SETTINGS}
        video="M7lc1UVf-VE"
        appliedVars={{ autoplay: 0 }}
        onApply={onApply}
        onClose={() => {}}
        previewWidth={null}
        onPreviewWidth={() => {}}
        live={EMPTY_LIVE_STATE}
        rates={[]}
        rate={null}
        command={() => {}}
        commandError=""
      />,
    );
    fireEvent.change(screen.getByLabelText("Preset"), {
      target: { value: "classroom" },
    });
    expect(
      (screen.getByLabelText(/Player language/) as HTMLSelectElement).value,
    ).toBe("ar");
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Apply and reload player" }),
    );
    expect(onApply).toHaveBeenCalledWith(presetSettings("classroom"));
    expect(
      (screen.getByLabelText(/Caption font size/) as HTMLSelectElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByLabelText("Layout preview")).toBeTruthy();
  });
  it("unavailable and deprecated features have no executable switches", () => {
    render(<CustomizationLimitations />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(
      CAPABILITY_MATRIX.some(
        ([feature, status]) =>
          feature === "Remove all related videos" && status === "Unavailable",
      ),
    ).toBe(true);
  });
});
