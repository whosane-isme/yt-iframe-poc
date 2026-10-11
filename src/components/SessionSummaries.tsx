import { History, Square } from "lucide-react";
import type { FinalSessionSummary } from "../types";
import { formatTime } from "../lib/analytics";
function rate(value: number | null) {
  return value === null ? "Not available" : `${value.toFixed(2)}×`;
}
function endedReason(s: FinalSessionSummary) {
  return s.endingReason === "video_ended" ? "Video ended" : "Manually ended";
}
export function SessionSummaries({
  history,
  active,
  onEnd,
}: {
  history: FinalSessionSummary[];
  active: boolean;
  onEnd: () => void;
}) {
  const latest = history[0];
  return (
    <section className="panel session-summaries">
      <div className="section-heading">
        <h2>
          <History size={17} /> Viewing sessions
        </h2>
        <button onClick={onEnd} disabled={!active}>
          <Square size={13} /> End Session
        </button>
      </div>
      <p className="muted">
        {active
          ? "Session open · pause saves a checkpoint and keeps this session open."
          : "No open session · playback starts a new session."}
      </p>
      {latest ? (
        <>
          <div className="final-heading">
            <h3>Latest finalized session</h3>
            <span className="badge">
              {endedReason(latest)} ·{" "}
              {latest.completed
                ? "Lecture completed"
                : "Partial lecture progress"}
            </span>
          </div>
          <p className="muted">
            {new Date(latest.startedAt).toLocaleString()} →{" "}
            {new Date(latest.endedAt).toLocaleString()}
          </p>
          <dl className="session-metrics">
            <div>
              <dt>Session playback time</dt>
              <dd>{formatTime(latest.playbackWallSeconds)}</dd>
            </div>
            <div>
              <dt>New content this session</dt>
              <dd>{latest.newlyCoveredSeconds.toFixed(1)} sec</dd>
            </div>
            <div>
              <dt>Session inferred seeks</dt>
              <dd>{latest.seekCount}</dd>
            </div>
            <div>
              <dt>Session average speed</dt>
              <dd>{rate(latest.weightedAverageSpeed)}</dd>
            </div>
            <div>
              <dt>Cumulative coverage after</dt>
              <dd>
                {latest.cumulativeCoveragePercentage === null
                  ? "Not available"
                  : `${latest.cumulativeCoveragePercentage.toFixed(1)}%`}
              </dd>
            </div>
            <div>
              <dt>Rule at finalization</dt>
              <dd>{latest.completionThreshold}% + reached end</dd>
            </div>
          </dl>
          <p className="muted">
            Session time by speed:{" "}
            {Object.keys(latest.rateWallSeconds).length
              ? Object.entries(latest.rateWallSeconds)
                  .map(([r, t]) => `${r}×: ${formatTime(t)}`)
                  .join(" · ")
              : "Not available"}
            . Completion reflects cumulative lecture evidence at finalization.
          </p>
          <details>
            <summary>
              Recent finalized sessions ({history.length} / 10 retained)
            </summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Ended</th>
                    <th>Reason</th>
                    <th>Session time</th>
                    <th>New content</th>
                    <th>Cumulative coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((s) => (
                    <tr key={s.sessionId}>
                      <td>{new Date(s.endedAt).toLocaleString()}</td>
                      <td>{endedReason(s)}</td>
                      <td>{formatTime(s.playbackWallSeconds)}</td>
                      <td>{s.newlyCoveredSeconds.toFixed(1)} sec</td>
                      <td>
                        {s.cumulativeCoveragePercentage === null
                          ? "Not available"
                          : `${s.cumulativeCoveragePercentage.toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <div className="empty">
          No finalized sessions yet.
          <br />
          <span className="muted">
            Play part of a lecture, then choose End Session or let the video
            end.
          </span>
        </div>
      )}
    </section>
  );
}
