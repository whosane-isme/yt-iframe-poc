import { useState } from "react";
import { Play, Pause, Square, Volume2, VolumeX } from "lucide-react";
import type { LivePlayerState, PlayerCommand } from "../lib/playerControls";
import { formatTime } from "../lib/analytics";
export function LivePlayerControls({
  live,
  rates,
  rate,
  command,
  error,
}: {
  live: LivePlayerState;
  rates: number[];
  rate: number | null;
  command: (action: PlayerCommand) => void;
  error: string;
}) {
  const [timestamp, setTimestamp] = useState("0");
  return (
    <section className="live-controls">
      <h3>
        Live Player Controls <span className="badge">Runtime · no reload</span>
      </h3>
      <fieldset disabled={!live.ready}>
        <legend className="sr-only">Official API playback controls</legend>
        <div className="control-buttons">
          <button type="button" onClick={() => command({ type: "play" })}>
            <Play size={14} />
            Play
          </button>
          <button type="button" onClick={() => command({ type: "pause" })}>
            <Pause size={14} />
            Pause
          </button>
          <button type="button" onClick={() => command({ type: "stop" })}>
            <Square size={14} />
            Stop
          </button>
          <button
            type="button"
            onClick={() =>
              command({ type: "seek", value: Math.max(0, live.position - 10) })
            }
          >
            −10 sec
          </button>
          <button
            type="button"
            onClick={() => command({ type: "seek", value: live.position + 10 })}
          >
            +10 sec
          </button>
          <button
            type="button"
            onClick={() => command({ type: live.muted ? "unmute" : "mute" })}
          >
            {live.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}{" "}
            {live.muted ? "Unmute" : "Mute"}
          </button>
        </div>
        <div className="runtime-grid">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              command({ type: "seek", value: Number(timestamp) });
            }}
          >
            <label htmlFor="jump-time">Jump to seconds</label>
            <div className="inline-field">
              <input
                id="jump-time"
                type="number"
                min="0"
                step="0.1"
                required
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
              />
              <button type="submit">Jump</button>
            </div>
          </form>
          <div>
            <label htmlFor="live-rate">Playback speed</label>
            <select
              id="live-rate"
              value={rate ?? ""}
              onChange={(e) =>
                command({ type: "rate", value: Number(e.target.value) })
              }
            >
              <option value="" disabled>
                Not available
              </option>
              {rates.map((r) => (
                <option key={r} value={r}>
                  {r}×
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="live-volume">Volume · {live.volume}%</label>
            <input
              id="live-volume"
              type="range"
              min="0"
              max="100"
              value={live.volume}
              onChange={(e) =>
                command({ type: "volume", value: Number(e.target.value) })
              }
            />
          </div>
        </div>
      </fieldset>
      <p className="muted">
        {live.ready
          ? `${formatTime(live.position)} / ${live.duration > 0 ? formatTime(live.duration) : "Not available"}`
          : "Waiting for the player."}{" "}
        Stop cancels loading and may change player state; pause keeps the
        current playback position. Neither finalizes a session. Quality
        selection stays in YouTube’s native controls.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
