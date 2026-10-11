import { Clock3, ScanLine, SkipForward, CheckCircle2 } from "lucide-react";
import type { WatchSession } from "../types";
import { formatTime, metrics } from "../lib/analytics";
export function AnalyticsDashboard({
  session,
  threshold,
  setThreshold,
}: {
  session: WatchSession;
  threshold: number;
  setThreshold: (n: number) => void;
}) {
  const m = metrics(session, threshold);
  return (
    <section className="panel analytics">
      <div className="section-heading">
        <h2>Watch analytics</h2>
        <span className="live-dot">LIVE</span>
      </div>
      <p className="muted">Observed activity for this student & video</p>
      <div className="coverage-hero">
        <div
          className="ring"
          style={{
            background: `conic-gradient(var(--green) ${m.percentage}%, #252c35 0)`,
          }}
        >
          <div>
            <strong>
              {session.duration > 0 ? m.percentage.toFixed(1) : "—"}
              <small>%</small>
            </strong>
            <span>unique coverage</span>
          </div>
        </div>
        <p>
          {formatTime(m.covered)} covered{" "}
          <span className="muted">
            of{" "}
            {session.duration > 0
              ? formatTime(session.duration)
              : "unknown duration"}
          </span>
        </p>
      </div>
      <div className="metric-grid">
        <div>
          <Clock3 />
          <label>Wall-clock play time</label>
          <strong>{formatTime(session.totalPlaybackWallSeconds)}</strong>
          <small>Repeated viewing included</small>
        </div>
        <div>
          <ScanLine />
          <label>Unique content</label>
          <strong>
            {m.covered.toFixed(1)}
            <small> sec</small>
          </strong>
          <small>Repeated sections counted once</small>
        </div>
        <div>
          <SkipForward />
          <label>Inferred seeks</label>
          <strong>{session.seekCount}</strong>
          <small>Position discontinuities</small>
        </div>
        <div>
          <CheckCircle2 />
          <label>Reached end</label>
          <strong className={session.reachedEnd ? "green" : ""}>
            {session.reachedEnd ? "Yes" : "No"}
          </strong>
          <small>YouTube ENDED signal</small>
        </div>
      </div>
      <div className="completion">
        <div>
          <strong>{m.completed ? "Completed" : "In progress"}</strong>
          <span className="muted">Coverage rule</span>
        </div>
        <progress value={m.percentage} max={100} />
        <label className="threshold">
          Requires{" "}
          <select
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            aria-label="Completion coverage threshold"
          >
            <option value={80}>80%</option>
            <option value={90}>90%</option>
            <option value={95}>95%</option>
            <option value={100}>100%</option>
          </select>{" "}
          unique coverage + reached end
        </label>
      </div>
      <div className="speed-section">
        <h3>Time at each speed</h3>
        {Object.entries(session.rateWallSeconds).length ? (
          Object.entries(session.rateWallSeconds).map(([r, t]) => (
            <div className="speed-row" key={r}>
              <span>{r}×</span>
              <div className="speed-track">
                <i
                  style={{
                    width: `${session.totalPlaybackWallSeconds ? (t / session.totalPlaybackWallSeconds) * 100 : 0}%`,
                  }}
                />
              </div>
              <span>{formatTime(t)}</span>
            </div>
          ))
        ) : (
          <p className="muted">Play the lecture to record speed usage.</p>
        )}
        <small className="muted">
          {session.playbackRateHistory.length} retained rate changes
        </small>
      </div>
    </section>
  );
}
