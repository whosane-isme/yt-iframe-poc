import type { WatchSession } from "../types";
import { formatTime, ranges } from "../lib/analytics";
export function WatchTimeline({ session }: { session: WatchSession }) {
  const d = session.duration;
  return (
    <section className="panel timeline-panel">
      <div className="section-heading">
        <h2>Lecture coverage</h2>
        <span className="muted">CONTENT TIMELINE</span>
      </div>
      <p className="muted">
        Every green segment is observed playback. Gaps stay uncredited.
      </p>
      <div
        className="timeline"
        role="img"
        aria-label="Watched coverage timeline"
      >
        {d > 0 &&
          ranges(session).map((r) => (
            <span
              key={r.start}
              title={`${r.watched ? "Covered" : "Uncovered"}: ${formatTime(r.start)} – ${formatTime(r.end)}`}
              style={{
                left: `${(r.start / d) * 100}%`,
                width: `${((r.end - r.start) / d) * 100}%`,
              }}
              className={r.watched ? "watched" : "unwatched"}
            />
          ))}
        {d > 0 &&
          session.seekEvents.map((e) => (
            <i
              key={e.id}
              className="seek-marker"
              title={e.details}
              style={{
                left: `${Math.min(100, (e.positionSeconds / d) * 100)}%`,
              }}
            />
          ))}
        {d > 0 && (
          <i
            className="position-marker"
            style={{
              left: `${Math.min(100, (session.lastPositionSeconds / d) * 100)}%`,
            }}
          />
        )}
      </div>
      <div className="timeline-times">
        <span>00:00</span>
        <span>{d > 0 ? formatTime(d) : "Not available"}</span>
      </div>
      <div className="legend">
        <span>
          <i className="green-bg" />
          Covered
        </span>
        <span>
          <i className="gray-bg" />
          Uncovered
        </span>
        <span>
          <i className="amber-bg" />
          Inferred seek
        </span>
        <span>
          <i className="white-bg" />
          Current position
        </span>
      </div>
      <details>
        <summary>Inspect covered and uncovered ranges</summary>
        <div className="range-list">
          {d > 0 ? (
            ranges(session).map((r) => (
              <div key={r.start}>
                <span className={r.watched ? "green" : "muted"}>
                  {r.watched ? "Covered" : "Uncovered"}
                </span>
                <span>
                  {formatTime(r.start)} – {formatTime(r.end)}
                </span>
              </div>
            ))
          ) : (
            <p className="muted">Duration is not available yet.</p>
          )}
        </div>
      </details>
    </section>
  );
}
