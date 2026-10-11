import { useEffect, useRef, useState } from "react";
import { Copy, Download, SlidersHorizontal, X } from "lucide-react";
import { PlayerSettings } from "./PlayerSettings";
import { CustomizationLimitations } from "./CustomizationLimitations";
import { LivePlayerControls } from "./LivePlayerControls";
import {
  DEFAULT_SETTINGS,
  DOCS,
  PRESETS,
  PREVIEW_WIDTHS,
  playerVars,
  presetSettings,
  validateSettings,
  type PlayerSettings as Settings,
  type PresetId,
} from "../lib/playerConfig";
import type { LivePlayerState, PlayerCommand } from "../lib/playerControls";
export interface LabProps {
  settings: Settings;
  video: string;
  appliedVars: Record<string, string | number>;
  onApply: (s: Settings) => boolean;
  onClose: () => void;
  previewWidth: number | null;
  onPreviewWidth: (n: number | null) => void;
  live: LivePlayerState;
  rates: number[];
  rate: number | null;
  command: (c: PlayerCommand) => void;
  commandError: string;
}
export function PlayerCustomizationLab(props: LabProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    heading.current?.scrollIntoView?.({ block: "start" });
  }, []);
  const [draft, setDraft] = useState(props.settings);
  const [message, setMessage] = useState("");
  const vars = playerVars(draft, props.video, window.location.origin, true);
  const valid = validateSettings(draft);
  const changed = JSON.stringify(draft) !== JSON.stringify(props.settings);
  const apply = () => {
    if (!valid) {
      setMessage(
        "Use whole nonnegative start seconds and an end greater than start.",
      );
      return;
    }
    const saved = props.onApply(draft);
    setMessage(
      saved
        ? "Applied. The player reloads; progress and open session are retained."
        : "Applied, but preferences could not be saved in this browser.",
    );
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(vars, null, 2));
      setMessage("Draft playerVars copied.");
    } catch {
      setMessage(
        "Clipboard unavailable. Select and copy the configuration below.",
      );
    }
  };
  const download = () => {
    const data = {
      schemaVersion: 1,
      preset: draft.preset,
      settings: draft,
      playerVars: vars,
      appliedPlayerVars: props.appliedVars,
      notes: [
        "playerVars changes require iframe recreation.",
        "Autoplay requires explicit Apply consent and is suppressed on page reload.",
        "Segment experiments suspend lecture tracking.",
        "Runtime playback/caption-size controls are not persisted.",
      ],
      documentation: DOCS,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "youtube-player-customization.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section
      className="panel customization-lab"
      id="player-customization-lab"
      aria-labelledby="lab-heading"
    >
      <div className="section-heading">
        <h2 id="lab-heading" ref={heading} tabIndex={-1}>
          <SlidersHorizontal size={18} />
          Player Customization Lab
        </h2>
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close customization lab"
        >
          <X size={16} />
        </button>
      </div>
      <p className="muted">
        Experiment on the actual player. Draft changes need Apply; live API
        controls take effect immediately.
      </p>
      <div className="preset-row">
        <label htmlFor="player-preset">
          Preset
          <select
            id="player-preset"
            aria-label="Preset"
            value={draft.preset}
            onChange={(e) => {
              const p = e.target.value as PresetId;
              setDraft(
                p === "custom"
                  ? { ...draft, preset: "custom" }
                  : presetSettings(p),
              );
            }}
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          {PRESETS.find((p) => p.id === draft.preset)?.description}
        </p>
      </div>
      <div className="section-heading lab-subheading">
        <h3>Player parameters</h3>
        <span className="badge">
          Initialization only · requires player reload
        </span>
      </div>
      <PlayerSettings value={draft} onChange={setDraft} />
      {!draft.controls && (
        <p className="lab-warning">
          Native controls are hidden. Students lose some YouTube interactions,
          including native caption and quality selection. External API controls
          stay available below the player, even when the lab is closed.
        </p>
      )}
      <div className="apply-row">
        <button
          type="button"
          className="primary"
          disabled={!valid}
          onClick={apply}
        >
          Apply and reload player
        </button>
        <button type="button" onClick={() => setDraft({ ...DEFAULT_SETTINGS })}>
          Reset to defaults
        </button>
        <button
          type="button"
          onClick={() => setDraft(presetSettings("classroom"))}
        >
          Reset to Classroom Focus
        </button>
        <span className="muted">
          {changed ? "Unapplied changes" : "Settings match applied preferences"}
        </span>
      </div>
      {!valid && (
        <p className="error" role="alert">
          End must be a whole number greater than start; start must be a
          nonnegative whole number.
        </p>
      )}
      <div className="responsive-tools">
        <label htmlFor="preview-width">
          Layout preview
          <select
            id="preview-width"
            aria-label="Layout preview"
            value={props.previewWidth ?? "auto"}
            onChange={(e) =>
              props.onPreviewWidth(
                e.target.value === "auto" ? null : Number(e.target.value),
              )
            }
          >
            <option value="auto">Available width</option>
            {PREVIEW_WIDTHS.map((p) => (
              <option key={p.width} value={p.width}>
                {p.label} · {p.width}px
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          Resizes the player and surrounding dashboard below; width is capped by
          available space. Minimum iframe size: 200 × 200px. This does not
          emulate Android or iOS.
        </p>
      </div>
      <LivePlayerControls
        live={props.live}
        rates={props.rates}
        rate={props.rate}
        command={props.command}
        error={props.commandError}
      />
      <label className="caption-font">
        Caption font size <span className="badge">Runtime · limited</span>
        <select
          aria-label="Caption font size"
          disabled={!props.live.ready || !props.live.captionSizesAvailable}
          value={props.live.captionSize ?? ""}
          onChange={(e) =>
            props.command({
              type: "captionSize",
              value: Number(e.target.value),
            })
          }
        >
          <option value="" disabled>
            Not available
          </option>
          {[
            [-1, "Smallest"],
            [0, "Default"],
            [1, "Larger"],
            [2, "Large"],
            [3, "Largest"],
          ].map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <small className="muted">
          {props.live.captionSizesAvailable
            ? "Documented captions.fontSize option is available. It changes captions when shown."
            : "The captions module/fontSize option is not available yet. A video may have no captions, or the module may not be loaded. Enable captions in YouTube and check again."}
        </small>
      </label>
      <details className="configuration-output">
        <summary>Inspect generated playerVars</summary>
        <div className="configuration-columns">
          <div>
            <h3>Draft configuration</h3>
            <pre>{JSON.stringify(vars, null, 2)}</pre>
          </div>
          <div>
            <h3>Actual initialization used</h3>
            <pre>{JSON.stringify(props.appliedVars, null, 2)}</pre>
          </div>
        </div>
        <p className="muted">
          A requested language, annotation or caption setting may have no
          visible effect if the player has nothing matching to display.
          Responsive size and YouTube preferences also affect presentation.
        </p>
      </details>
      <div className="control-buttons export-config">
        <button type="button" onClick={copy}>
          <Copy size={14} />
          Copy playerVars
        </button>
        <button type="button" onClick={download}>
          <Download size={14} />
          Download customization JSON
        </button>
        <a href={DOCS.api} target="_blank" rel="noreferrer">
          Official API reference
        </a>
      </div>
      <p className="lab-message" role="status">
        {message}
      </p>
      <CustomizationLimitations />
    </section>
  );
}
