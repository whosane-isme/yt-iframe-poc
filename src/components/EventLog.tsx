import type { WatchSession } from "../types";
import { formatTime } from "../lib/analytics";
export function EventLog({ session }: { session: WatchSession }) {
  return (
    <section className="panel event-panel">
      <div className="section-heading">
        <h2>Playback event log</h2>
        <span className="badge">{session.events.length} events</span>
      </div>
      <p className="muted">Most recent first · latest 200 retained</p>
      {session.events.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Position</th>
                <th>Speed</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {session.events.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.timestamp).toLocaleTimeString()}</td>
                  <td>
                    <span className={`event-tag ${e.type}`}>{e.type}</span>
                  </td>
                  <td>{formatTime(e.positionSeconds)}</td>
                  <td>{e.playbackRate}×</td>
                  <td>{e.details || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          No player events yet.
          <br />
          <span className="muted">
            Load and play a video to start collecting real observations.
          </span>
        </div>
      )}
    </section>
  );
}
