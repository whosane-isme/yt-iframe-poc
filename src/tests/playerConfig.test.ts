import { describe, it, expect } from "vitest";
import {
  DEFAULT_SETTINGS,
  PRESETS,
  PREVIEW_WIDTHS,
  initialPosition,
  playerVars,
  presetSettings,
  validateSettings,
} from "../lib/playerConfig";
import {
  PLAYER_SETTINGS_KEY,
  restorePlayerSettings,
  savePlayerSettings,
} from "../lib/playerSettingsStorage";
import { persist, restore, clearAll, type StorageLike } from "../lib/storage";
import { createSession } from "../lib/watchTracker";
class Store implements StorageLike {
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
describe("official player configuration", () => {
  it("uses safe educational defaults", () => {
    const vars = playerVars(
      DEFAULT_SETTINGS,
      "M7lc1UVf-VE",
      "https://example.org",
    );
    expect(vars).toMatchObject({
      autoplay: 0,
      controls: 1,
      fs: 1,
      playsinline: 1,
      disablekb: 0,
      rel: 1,
      color: "red",
    });
    expect(vars).not.toHaveProperty("hl");
    expect(vars).not.toHaveProperty("end");
  });
  it.each(PRESETS.map((p) => p.id))("applies valid preset %s", (preset) =>
    expect(validateSettings(presetSettings(preset))).toBe(true),
  );
  it("classroom requests Arabic and same-channel related videos", () =>
    expect(
      playerVars(
        presetSettings("classroom"),
        "M7lc1UVf-VE",
        "https://example.org",
      ),
    ).toMatchObject({ hl: "ar", rel: 0, controls: 1, autoplay: 0 }));
  it("accessibility requests captions and keeps native keyboard controls", () =>
    expect(
      playerVars(
        presetSettings("accessibility"),
        "M7lc1UVf-VE",
        "https://example.org",
      ),
    ).toMatchObject({ cc_load_policy: 1, disablekb: 0 }));
  it("minimal hides controls only with documented controls=0", () =>
    expect(
      playerVars(
        presetSettings("minimal"),
        "M7lc1UVf-VE",
        "https://example.org",
      ).controls,
    ).toBe(0));
  it("suppresses restored autoplay without transient consent", () => {
    const s = { ...DEFAULT_SETTINGS, autoplay: true };
    expect(playerVars(s, "M7lc1UVf-VE", "https://example.org").autoplay).toBe(
      0,
    );
    expect(
      playerVars(s, "M7lc1UVf-VE", "https://example.org", true).autoplay,
    ).toBe(1);
  });
  it("loops a single video using playlist and loop", () =>
    expect(
      playerVars(
        { ...DEFAULT_SETTINGS, loop: true },
        "M7lc1UVf-VE",
        "https://example.org",
      ),
    ).toMatchObject({ loop: 1, playlist: "M7lc1UVf-VE" }));
  it("generates supported appearance, caption and segment parameters", () => {
    const vars = playerVars(
      {
        ...DEFAULT_SETTINGS,
        color: "white",
        language: "en",
        captionLanguage: "ar",
        captions: true,
        annotations: false,
        keyboard: false,
        inline: false,
        fullscreen: false,
        startSeconds: 20,
        endSeconds: 50,
      },
      "M7lc1UVf-VE",
      "https://example.org",
    );
    expect(vars).toMatchObject({
      color: "white",
      hl: "en",
      cc_lang_pref: "ar",
      cc_load_policy: 1,
      iv_load_policy: 3,
      disablekb: 1,
      playsinline: 0,
      fs: 0,
      start: 20,
      end: 50,
    });
  });
  it("never generates deprecated or unavailable options", () => {
    const vars = playerVars(
      DEFAULT_SETTINGS,
      "M7lc1UVf-VE",
      "https://example.org",
    );
    for (const key of [
      "modestbranding",
      "showinfo",
      "autohide",
      "theme",
      "quality",
      "hideAds",
      "hideShare",
    ])
      expect(vars).not.toHaveProperty(key);
  });
  it("preserves reload position and clamps it away from the end", () => {
    expect(initialPosition(DEFAULT_SETTINGS, 23.8, 100)).toBe(23);
    expect(initialPosition(DEFAULT_SETTINGS, 100, 100)).toBe(99);
    expect(initialPosition(DEFAULT_SETTINGS, NaN, 100)).toBe(0);
    expect(
      initialPosition({ ...DEFAULT_SETTINGS, startSeconds: 10 }, 80, 100),
    ).toBe(10);
  });
  it("offers exact responsive widths without shrinking iframe via transform", () =>
    expect(PREVIEW_WIDTHS.map((p) => p.width)).toEqual([1280, 768, 390, 320]));
});
describe("separate preference persistence", () => {
  it("restores settings while leaving analytics intact", () => {
    const store = new Store();
    const session = createSession("a", "M7lc1UVf-VE");
    session.totalPlaybackWallSeconds = 10;
    persist(store, session);
    savePlayerSettings(store, presetSettings("classroom"));
    expect(restorePlayerSettings(store)).toEqual(presetSettings("classroom"));
    expect(restore(store, "a", "M7lc1UVf-VE").totalPlaybackWallSeconds).toBe(
      10,
    );
    clearAll(store);
    expect(restorePlayerSettings(store).preset).toBe("classroom");
  });
  it.each([
    "broken",
    "null",
    "{}",
    JSON.stringify({ ...DEFAULT_SETTINGS, controls: 2 }),
    JSON.stringify({ ...DEFAULT_SETTINGS, startSeconds: 20, endSeconds: 10 }),
  ])("recovers invalid stored settings %s", (raw) => {
    const store = new Store();
    store.setItem(PLAYER_SETTINGS_KEY, raw);
    expect(restorePlayerSettings(store)).toEqual(DEFAULT_SETTINGS);
  });
  it("strips unsupported properties from stored settings", () => {
    const store = new Store();
    store.setItem(
      PLAYER_SETTINGS_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, modestbranding: 1 }),
    );
    expect(restorePlayerSettings(store)).not.toHaveProperty("modestbranding");
  });
  it("rejects invalid writes and reports quota failures", () => {
    const store = new Store();
    expect(
      savePlayerSettings(store, { ...DEFAULT_SETTINGS, startSeconds: -1 }),
    ).toBe(false);
    store.setItem = () => {
      throw Error("Quota");
    };
    expect(savePlayerSettings(store, DEFAULT_SETTINGS)).toBe(false);
  });
});
