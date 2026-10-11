import type { PlayerSettings as Settings } from "../lib/playerConfig";
type Choice = [string, string];
function Setting({
  label,
  value,
  options,
  onChange,
  note,
  limited = false,
}: {
  label: string;
  value: string;
  options: Choice[];
  onChange: (value: string) => void;
  note: string;
  limited?: boolean;
}) {
  return (
    <label className="setting-field">
      <span>
        {label}{" "}
        <small
          className={`support-label ${limited ? "limited" : ""}`}
          title={
            limited
              ? "Supported, with the limitation described below."
              : "Documented YouTube parameter."
          }
        >
          {limited ? "Limited" : "Official"}
        </small>
      </span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
      <small>{note}</small>
    </label>
  );
}
const languages: Choice[] = [
  ["", "Automatic"],
  ["ar", "Arabic"],
  ["en", "English"],
];
const boolean: Choice[] = [
  ["true", "Enabled"],
  ["false", "Disabled"],
];
export function PlayerSettings({
  value,
  onChange,
}: {
  value: Settings;
  onChange: (s: Settings) => void;
}) {
  const change = <K extends keyof Settings>(key: K, newValue: Settings[K]) =>
    onChange({ ...value, preset: "custom", [key]: newValue });
  const bool = (
    key:
      | "controls"
      | "fullscreen"
      | "annotations"
      | "autoplay"
      | "loop"
      | "keyboard"
      | "inline"
      | "sameChannel"
      | "captions",
    label: string,
    note: string,
    options: Choice[] = boolean,
    limited = false,
  ) => (
    <Setting
      key={key}
      label={label}
      value={String(value[key])}
      options={options}
      onChange={(v) => change(key, v === "true")}
      note={note}
      limited={limited}
    />
  );
  return (
    <>
      <div className="settings-grid">
        <Setting
          label="Player language"
          value={value.language}
          options={languages}
          onChange={(v) => change("language", v as Settings["language"])}
          note="Interface text; caption choice may follow user preferences."
          limited
        />
        <Setting
          label="Progress bar color"
          value={value.color}
          options={[
            ["red", "Red"],
            ["white", "White"],
          ]}
          onChange={(v) => change("color", v as Settings["color"])}
          note="Affects YouTube’s progress bar when visible."
        />
        {bool(
          "controls",
          "Native control bar",
          "Hidden controls remove native seeking, speed, captions and other interactions.",
        )}
        {bool(
          "fullscreen",
          "Fullscreen button",
          "fs=0 hides the native fullscreen button.",
        )}
        {bool(
          "annotations",
          "Video annotations",
          "Does not remove cards, recommendations or every overlay.",
          [
            ["true", "Default"],
            ["false", "Disabled (iv_load_policy=3)"],
          ],
          true,
        )}
        {bool(
          "autoplay",
          "Experimental autoplay",
          "Only this Apply action can authorize it; browser rules may still block playback.",
          [
            ["false", "Off"],
            ["true", "On for this Apply"],
          ],
          true,
        )}
        {bool(
          "loop",
          "Single-video loop",
          "Uses loop=1 plus playlist set to this video ID.",
          boolean,
          true,
        )}
        {bool(
          "keyboard",
          "YouTube keyboard shortcuts",
          "External lab controls remain keyboard-accessible.",
        )}
        {bool(
          "inline",
          "Inline playback on iOS",
          "playsinline=1 requests inline playback; 0 requests fullscreen. Device/WebView support varies.",
          boolean,
          true,
        )}
        {bool(
          "sameChannel",
          "Related videos",
          "rel=0 limits suggestions to the same channel. It does not remove suggestions.",
          [
            ["false", "Normal"],
            ["true", "Same channel (rel=0)"],
          ],
          true,
        )}
        {bool(
          "captions",
          "Default captions",
          "A requested caption track must exist; no captions are created.",
          [
            ["false", "YouTube / user preference"],
            ["true", "On when available"],
          ],
          true,
        )}
        <Setting
          label="Preferred caption language"
          value={value.captionLanguage}
          options={languages}
          onChange={(v) =>
            change("captionLanguage", v as Settings["captionLanguage"])
          }
          note="A preference, not a guarantee of a matching track."
          limited
        />
      </div>
      <details className="advanced-settings">
        <summary>Advanced · playback segment experiment</summary>
        <p className="muted">
          Full lecture is the default. Any start/end restriction suspends
          lecture analytics and session finalization until you return to full
          playback. Positions use seconds from the beginning; keyframes can
          shift the requested start.
        </p>
        <div className="runtime-grid">
          <label>
            Start seconds
            <input
              type="number"
              min="0"
              step="1"
              value={value.startSeconds}
              onChange={(e) => change("startSeconds", Number(e.target.value))}
            />
          </label>
          <label>
            End seconds (optional)
            <input
              type="number"
              min={value.startSeconds + 1}
              step="1"
              value={value.endSeconds ?? ""}
              onChange={(e) =>
                change(
                  "endSeconds",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...value,
                preset: "custom",
                startSeconds: 0,
                endSeconds: null,
              })
            }
          >
            Return to full lecture
          </button>
        </div>
      </details>
    </>
  );
}
