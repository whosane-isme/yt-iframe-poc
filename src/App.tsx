import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Download,
  RotateCcw,
  Trash2,
  Play,
  ChevronRight,
  GraduationCap,
  Radio,
} from "lucide-react";
import { useWatchPlayer } from "./hooks/useWatchPlayer";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { WatchTimeline } from "./components/WatchTimeline";
import { EventLog } from "./components/EventLog";
import { TestingGuide } from "./components/TestingGuide";
import { parseVideoId } from "./lib/youtubeUrl";
import { formatTime, metrics } from "./lib/analytics";
import { clearAll } from "./lib/storage";
import { TRACKING_VERSION } from "./lib/watchTracker";
import { checkpoint, progressSummary } from "./lib/watchSummary";
import { SessionSummaries } from "./components/SessionSummaries";
const students = [
  { id: "student-a", name: "Student A" },
  { id: "student-b", name: "Student B" },
  { id: "student-c", name: "Student C" },
];
function Workspace({
  student,
  video,
  threshold,
  setThreshold,
}: {
  student: string;
  video: string;
  threshold: number;
  setThreshold: (n: number) => void;
}) {
  const tracking = useWatchPlayer(student, video, threshold);
  const { session } = tracking;
  const download = () => {
    tracking.flush();
    const data = {
      implementationVersion: TRACKING_VERSION,
      exportedAt: new Date().toISOString(),
      student: students.find((s) => s.id === student),
      ...checkpoint(session, threshold),
      cumulativeProgressSummary: progressSummary(session, threshold),
      latestFinalizedSessionSummary:
        session.recentSessionSummaries?.[0] ?? null,
      recentSessionHistory: session.recentSessionSummaries ?? [],
      coverage: metrics(session, threshold),
      completionCalculation: {
        ...metrics(session, threshold),
        rule: "unique coverage >= threshold AND YouTube ENDED",
      },
      notice:
        "Client-side telemetry, not secure proof of viewing or attention.",
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${student}-${video}-analytics.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <div className="workspace-grid">
        <div className="lecture-column">
          <section className="panel player-panel">
            <div className="section-heading">
              <h2>
                <Play size={17} /> Lecture player
              </h2>
              <span
                className={`player-status ${tracking.status.toLowerCase().replaceAll(" ", "-")}`}
              >
                <i />
                {tracking.status}
              </span>
            </div>
            <div ref={tracking.host} className="player-host" />
            {tracking.error && (
              <div className="error" role="alert">
                {tracking.error}
                <button onClick={tracking.retry}>Retry player</button>
              </div>
            )}
            <div className="lecture-caption">
              <div>
                <span className="eyebrow">YOUTUBE LECTURE</span>
                <h3>
                  {video === "M7lc1UVf-VE"
                    ? "YouTube IFrame API · sample video"
                    : `Lecture ${video}`}
                </h3>
                <span className="muted">Video ID: {video}</span>
              </div>
              <a
                href={`https://www.youtube.com/watch?v=${video}`}
                target="_blank"
                rel="noreferrer"
              >
                Open on YouTube <ArrowUpRight size={15} />
              </a>
            </div>
            <div className="player-stats">
              <div>
                <label>Current position</label>
                <strong>
                  {formatTime(session.lastPositionSeconds)}{" "}
                  <span>
                    /{" "}
                    {session.duration > 0 ? formatTime(session.duration) : "—"}
                  </span>
                </strong>
              </div>
              <div>
                <label>Playback speed</label>
                <strong>
                  {tracking.rate === null
                    ? "Not available"
                    : `${tracking.rate}×`}
                </strong>
              </div>
              <div>
                <label>Tracking identity</label>
                <strong>{students.find((s) => s.id === student)?.name}</strong>
              </div>
            </div>
            {tracking.resumePosition > 0 && (
              <button className="resume" onClick={tracking.resume}>
                <RotateCcw size={14} /> Resume saved position ·{" "}
                {formatTime(tracking.resumePosition)}
              </button>
            )}
            <small className="muted available-rates">
              Available player rates:{" "}
              {tracking.rates.length
                ? tracking.rates.map((r) => `${r}×`).join(" · ")
                : "Not available"}
            </small>
          </section>
          <WatchTimeline session={session} />
        </div>
        <AnalyticsDashboard
          session={session}
          threshold={threshold}
          setThreshold={setThreshold}
          studentName={students.find((s) => s.id === student)?.name ?? student}
        />
      </div>
      <SessionSummaries
        history={session.recentSessionSummaries ?? []}
        active={tracking.sessionActive}
        onEnd={tracking.endSession}
      />
      {tracking.storageError && (
        <div className="error" role="alert">
          Local storage is unavailable or full. Progress may not survive a
          refresh. Export JSON to keep a copy.
        </div>
      )}
      <div className="log-actions">
        <div>
          <Radio size={15} />
          <span>Recording actual player events</span>
        </div>
        <div>
          <button
            onClick={() => {
              if (window.confirm("Reset progress for this student and video?"))
                tracking.reset();
            }}
          >
            <RotateCcw size={15} /> Reset selected progress
          </button>
          <button className="primary" onClick={download}>
            <Download size={15} /> Download JSON
          </button>
        </div>
      </div>
      <EventLog session={session} />
      <TestingGuide />
    </>
  );
}
export default function App() {
  const [student, setStudent] = useState("student-a");
  const [video, setVideo] = useState("M7lc1UVf-VE");
  const [input, setInput] = useState("M7lc1UVf-VE");
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState(0);
  const [threshold, setThreshold] = useState(90);
  const clear = () => {
    if (
      !window.confirm(
        "Clear all locally saved analytics for all demo students and videos?",
      )
    )
      return;
    try {
      window.dispatchEvent(new Event("analytics:flush"));
      clearAll(window.localStorage);
      setGeneration((n) => n + 1);
    } catch {
      setError(
        "Local data could not be cleared. Check browser storage permissions.",
      );
    }
  };
  return (
    <div className="app-shell">
      <header>
        <div className="brand">
          <div className="brand-icon">
            <Activity />
          </div>
          <div>
            <strong>YT IFrame Analytics Lab</strong>
            <span>Student watch tracking proof of concept</span>
          </div>
        </div>
        <div className="header-actions">
          <span className="badge">
            <i className="amber-bg" /> Frontend-only POC
          </span>
          <button onClick={clear}>
            <Trash2 size={15} /> Clear local data
          </button>
        </div>
      </header>
      <main>
        <div className="breadcrumb">
          <GraduationCap size={15} /> Learning platform{" "}
          <ChevronRight size={13} /> <span>Analytics lab</span>
        </div>
        <div className="page-heading">
          <div>
            <span className="eyebrow">PLAYBACK INTELLIGENCE</span>
            <h1>See how a lecture is watched.</h1>
            <p>
              Real YouTube playback. Student-level observations. Zero video
              hosting costs.
            </p>
          </div>
          <span className="device-badge">
            <i /> Saved on this device
          </span>
        </div>
        <section className="panel context-bar">
          <div className="student-input">
            <label htmlFor="student">Simulated student</label>
            <select
              id="student"
              value={student}
              onChange={(e) => setStudent(e.target.value)}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <small>Demo identity · no authentication</small>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const id = parseVideoId(input);
              if (!id) {
                setError("Enter a valid YouTube URL or 11-character video ID.");
                return;
              }
              setError("");
              setVideo(id);
            }}
          >
            <label htmlFor="video">Lecture URL or video ID</label>
            <div className="video-field">
              <input
                id="video"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="https://youtube.com/watch?v=…"
              />
              <button className="primary" type="submit">
                Load video <ArrowUpRight size={15} />
              </button>
            </div>
            <small>
              Supports watch links, youtu.be, embed, Shorts, and video IDs
            </small>
          </form>
        </section>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <Workspace
          key={`${student}:${video}:${generation}`}
          student={student}
          video={video}
          threshold={threshold}
          setThreshold={setThreshold}
        />
        <footer>
          <span>Built for learning. Measured with care.</span>
          <a
            href="https://developers.google.com/youtube/iframe_api_reference"
            target="_blank"
            rel="noreferrer"
          >
            Official YouTube API documentation <ArrowUpRight size={13} />
          </a>
        </footer>
      </main>
    </div>
  );
}
