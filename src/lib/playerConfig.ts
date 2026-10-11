export type PresetId =
  "default" | "classroom" | "accessibility" | "minimal" | "custom";
export interface PlayerSettings {
  preset: PresetId;
  language: "" | "ar" | "en";
  color: "red" | "white";
  controls: boolean;
  fullscreen: boolean;
  annotations: boolean;
  autoplay: boolean;
  loop: boolean;
  keyboard: boolean;
  inline: boolean;
  sameChannel: boolean;
  captions: boolean;
  captionLanguage: "" | "ar" | "en";
  startSeconds: number;
  endSeconds: number | null;
}
export interface PlayerInitialization {
  settings: PlayerSettings;
  revision: number;
  autoplayAuthorized: boolean;
}
export const DEFAULT_SETTINGS: PlayerSettings = {
  preset: "default",
  language: "",
  color: "red",
  controls: true,
  fullscreen: true,
  annotations: true,
  autoplay: false,
  loop: false,
  keyboard: true,
  inline: true,
  sameChannel: false,
  captions: false,
  captionLanguage: "",
  startSeconds: 0,
  endSeconds: null,
};
export const DEFAULT_INITIALIZATION: PlayerInitialization = {
  settings: DEFAULT_SETTINGS,
  revision: 0,
  autoplayAuthorized: false,
};
export const PRESETS: { id: PresetId; name: string; description: string }[] = [
  {
    id: "default",
    name: "YouTube Default",
    description:
      "Native controls and YouTube preferences. Autoplay off; mobile inline playback on.",
  },
  {
    id: "classroom",
    name: "Classroom Focus (Recommended)",
    description:
      "Arabic interface, native controls, and suggestions from the same channel.",
  },
  {
    id: "accessibility",
    name: "Accessibility",
    description:
      "Native controls and keyboard shortcuts; captions requested when available.",
  },
  {
    id: "minimal",
    name: "Minimal Supported Player",
    description:
      "Native controls hidden. External API controls remain available; some native features are lost.",
  },
  {
    id: "custom",
    name: "Custom",
    description: "Edit supported settings individually.",
  },
];
export function presetSettings(preset: PresetId): PlayerSettings {
  const settings = { ...DEFAULT_SETTINGS, preset };
  if (preset === "classroom")
    return { ...settings, language: "ar", sameChannel: true };
  if (preset === "accessibility") return { ...settings, captions: true };
  if (preset === "minimal") return { ...settings, controls: false };
  return settings;
}
export function validateSettings(value: unknown): value is PlayerSettings {
  if (!value || typeof value !== "object") return false;
  const s = value as PlayerSettings;
  return (
    PRESETS.some((p) => p.id === s.preset) &&
    ["", "ar", "en"].includes(s.language) &&
    ["red", "white"].includes(s.color) &&
    ["", "ar", "en"].includes(s.captionLanguage) &&
    [
      "controls",
      "fullscreen",
      "annotations",
      "autoplay",
      "loop",
      "keyboard",
      "inline",
      "sameChannel",
      "captions",
    ].every((k) => typeof s[k as keyof PlayerSettings] === "boolean") &&
    Number.isInteger(s.startSeconds) &&
    s.startSeconds >= 0 &&
    (s.endSeconds === null ||
      (Number.isInteger(s.endSeconds) && s.endSeconds > s.startSeconds))
  );
}
export function isSegmentExperiment(s: PlayerSettings) {
  return s.startSeconds > 0 || s.endSeconds !== null;
}
export function initialPosition(
  s: PlayerSettings,
  savedPosition: number | null,
  duration: number,
): number {
  if (isSegmentExperiment(s)) return s.startSeconds;
  if (savedPosition === null || !Number.isFinite(savedPosition)) return 0;
  return Math.floor(
    Math.max(
      0,
      duration > 0
        ? Math.min(savedPosition, Math.max(0, duration - 1))
        : savedPosition,
    ),
  );
}
// Autoplay consent is transient: restoring saved preferences never authorizes playback.
export function playerVars(
  s: PlayerSettings,
  video: string,
  origin: string,
  autoplayAuthorized = false,
  position: number | null = null,
  duration = 0,
): Record<string, string | number> {
  const vars: Record<string, string | number> = {
    origin,
    enablejsapi: 1,
    autoplay: s.autoplay && autoplayAuthorized ? 1 : 0,
    controls: s.controls ? 1 : 0,
    fs: s.fullscreen ? 1 : 0,
    color: s.color,
    disablekb: s.keyboard ? 0 : 1,
    playsinline: s.inline ? 1 : 0,
    rel: s.sameChannel ? 0 : 1,
    loop: s.loop ? 1 : 0,
  };
  if (s.language) vars.hl = s.language;
  if (!s.annotations) vars.iv_load_policy = 3;
  if (s.captions) vars.cc_load_policy = 1;
  if (s.captionLanguage) vars.cc_lang_pref = s.captionLanguage;
  if (s.loop) vars.playlist = video;
  const start = initialPosition(s, position, duration);
  if (start > 0) vars.start = start;
  if (s.endSeconds !== null) vars.end = s.endSeconds;
  return vars;
}
export const DOCS = {
  parameters: "https://developers.google.com/youtube/player_parameters",
  api: "https://developers.google.com/youtube/iframe_api_reference",
  minimum:
    "https://developers.google.com/youtube/terms/required-minimum-functionality",
  policies: "https://developers.google.com/youtube/terms/developer-policies",
  education: "https://support.google.com/youtube/answer/18481571",
};
export const PREVIEW_WIDTHS = [
  { label: "Desktop", width: 1280 },
  { label: "Tablet", width: 768 },
  { label: "Mobile", width: 390 },
  { label: "Small mobile", width: 320 },
] as const;
