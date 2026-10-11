import { useEffect, useRef, useState } from "react";
import type { Player, SessionBaseline, Tracker, WatchSession } from "../types";
import { loadYouTubeAPI } from "../lib/youtubeApi";
import {
  createSession,
  observe,
  recordEvent,
  stateLabels,
} from "../lib/watchTracker";
import { persist, restore } from "../lib/storage";
import {
  beginSession,
  checkpoint,
  CHECKPOINT_INTERVAL_MS,
  finalizeSession,
} from "../lib/watchSummary";
import {
  DEFAULT_INITIALIZATION,
  isSegmentExperiment,
  playerVars,
  type PlayerInitialization,
} from "../lib/playerConfig";
import {
  EMPTY_LIVE_STATE,
  readLiveState,
  runPlayerCommand,
  type PlayerCommand,
} from "../lib/playerControls";
const errors: Record<number, string> = {
  2: "Invalid video ID or player parameter.",
  5: "HTML5 playback failed. Try another browser.",
  100: "Video is private, removed, or unavailable.",
  101: "This video does not allow embedding.",
  150: "This video does not allow embedding.",
  153: "YouTube could not identify this client. Use localhost or HTTPS and allow the Referer header.",
};
function saved(student: string, video: string) {
  try {
    return restore(window.localStorage, student, video);
  } catch {
    return createSession(student, video);
  }
}
export function useWatchPlayer(
  student: string,
  video: string,
  threshold = 90,
  initialization: PlayerInitialization = DEFAULT_INITIALIZATION,
) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const [session, setSession] = useState<WatchSession>(() =>
    saved(student, video),
  );
  const tracker = useRef<Tracker>({ session, previous: null });
  const [status, setStatus] = useState("Loading API");
  const [rate, setRate] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [rates, setRates] = useState<number[]>([]);
  const resumePosition = useRef(tracker.current.session.lastPositionSeconds);
  const flushRef = useRef<() => void>(() => {});
  const logicalSession = useRef<SessionBaseline | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const thresholdRef = useRef(threshold);
  thresholdRef.current = threshold;
  const endSessionRef = useRef<() => void>(() => {});
  const reloadPosition = useRef<number | null>(
    isSegmentExperiment(initialization.settings)
      ? session.lastPositionSeconds
      : null,
  );
  const sampleRef = useRef<() => void>(() => {});
  const [live, setLive] = useState(EMPTY_LIVE_STATE);
  const [commandError, setCommandError] = useState("");
  const [appliedVars, setAppliedVars] = useState<
    Record<string, string | number>
  >({});
  const trackingSuspended = isSegmentExperiment(initialization.settings);
  const stopRequested = useRef(false);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    let ready = false;
    let pendingInitialPlayback = true;
    let dirty = false;
    let lastSave = performance.now();
    let local: Player | null = null;
    setError("");
    setStatus("Loading API");
    setLive(EMPTY_LIVE_STATE);
    const publish = () => {
      if (active) setSession(tracker.current.session);
      dirty = true;
    };
    const flush = () => {
      if (!dirty) return;
      tracker.current.session = checkpoint(
        tracker.current.session,
        thresholdRef.current,
      );
      try {
        const ok = persist(window.localStorage, tracker.current.session);
        if (active) setStorageError(!ok);
        if (ok) dirty = false;
      } catch {
        if (active) setStorageError(true);
      }
      lastSave = performance.now();
    };
    flushRef.current = flush;
    const sample = () => {
      if (!local || !ready) return;
      setLive(readLiveState(local));
      setRate(local.getPlaybackRate());
      // Segment previews never enter lecture observations or completion calculations.
      if (trackingSuspended) {
        tracker.current.previous = null;
        return;
      }
      if (pendingInitialPlayback) {
        tracker.current.previous = null;
        const duration = local.getDuration();
        if (
          Number.isFinite(duration) &&
          duration > 0 &&
          duration !== tracker.current.session.duration
        ) {
          tracker.current.session = { ...tracker.current.session, duration };
          publish();
        }
        return;
      }
      const beforeSeek = tracker.current.session.seekCount;
      if (!logicalSession.current) tracker.current.previous = null;
      tracker.current = observe(tracker.current, {
        position: local.getCurrentTime(),
        duration: local.getDuration(),
        rate: local.getPlaybackRate(),
        state: local.getPlayerState(),
        mono: performance.now(),
        visible: document.visibilityState === "visible",
      });
      if (!logicalSession.current) tracker.current.previous = null;
      setRate(local.getPlaybackRate());
      publish();
      if (tracker.current.session.seekCount > beforeSeek) flush();
    };
    sampleRef.current = sample;
    const finish = (reason: "manual_end" | "video_ended") => {
      if (!logicalSession.current) return;
      tracker.current.session = finalizeSession(
        tracker.current.session,
        logicalSession.current,
        reason,
        new Date().toISOString(),
        thresholdRef.current,
      );
      logicalSession.current = null;
      tracker.current.previous = null;
      setSessionActive(false);
      publish();
      flush();
    };
    endSessionRef.current = () => {
      if (!logicalSession.current || trackingSuspended) return;
      sample();
      finish("manual_end");
      local?.pauseVideo();
    };
    const event = (type: string, details = "") => {
      if (!local) return;
      tracker.current.session = recordEvent(
        tracker.current.session,
        type,
        local.getCurrentTime(),
        local.getPlaybackRate(),
        details,
      );
      publish();
    };
    const poll = () => {
      if (!active || !ready || !local) return;
      sample();
      if (performance.now() - lastSave >= CHECKPOINT_INTERVAL_MS) flush();
      timer = setTimeout(poll, local.getPlayerState() === 1 ? 500 : 1500);
    };
    const visibility = () => {
      if (!active) return;
      tracker.current.previous = null;
      if (!trackingSuspended)
        event(
          "visibility",
          document.visibilityState === "visible"
            ? "Tab visible; new observation baseline."
            : "Tab hidden; coverage suspended.",
        );
      flush();
    };
    const leaving = () => flush();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", leaving);
    window.addEventListener("analytics:flush", leaving);
    loadYouTubeAPI()
      .then((api) => {
        if (!active || !host.current) return;
        const mount = document.createElement("div");
        host.current.replaceChildren(mount);
        setStatus("Loading player");
        const vars = playerVars(
          initialization.settings,
          video,
          window.location.origin,
          initialization.autoplayAuthorized,
          reloadPosition.current,
          tracker.current.session.duration,
        );
        setAppliedVars(vars);
        local = new api.Player(mount, {
          videoId: video,
          width: "100%",
          height: "100%",
          playerVars: vars,
          events: {
            onReady: (e) => {
              if (!active) return;
              clearTimeout(readyTimer);
              local = e.target;
              player.current = local;
              ready = true;
              setStatus("Ready");
              setRates(local.getAvailablePlaybackRates());
              sample();
              if (!trackingSuspended)
                event(
                  "ready",
                  "Official IFrame API ready. " + local.getVideoUrl(),
                );
              poll();
            },
            onStateChange: (e) => {
              if (!active || !ready) return;
              if (trackingSuspended) {
                setStatus(stateLabels[e.data] ?? "Unknown");
                sample();
                return;
              }
              if (e.data === 1) {
                stopRequested.current = false;
                if (pendingInitialPlayback) {
                  tracker.current.previous = null;
                  pendingInitialPlayback = false;
                }
              }
              if (e.data === 1 && !logicalSession.current) {
                logicalSession.current = beginSession(
                  tracker.current.session,
                  crypto.randomUUID(),
                  new Date().toISOString(),
                );
                tracker.current.previous = null;
                setSessionActive(true);
              }
              sample();
              setStatus(stateLabels[e.data] ?? "Unknown");
              if (e.data === 0 && !stopRequested.current)
                tracker.current.session = {
                  ...tracker.current.session,
                  reachedEnd: true,
                };
              event(
                e.data === 0 && stopRequested.current
                  ? "stopped"
                  : (stateLabels[e.data]?.toLowerCase() ?? "state"),
                `YouTube state ${e.data}`,
              );
              if (e.data === 0 && !stopRequested.current) finish("video_ended");
              if (e.data !== 1) flush();
            },
            onPlaybackRateChange: (e) => {
              if (!active || !ready) return;
              sample();
              tracker.current.previous = null;
              setRate(e.data);
              if (!trackingSuspended)
                event("rate", `Playback rate changed to ${e.data}×`);
              flush();
            },
            onError: (e) => {
              if (!active) return;
              clearTimeout(readyTimer);
              clearTimeout(timer);
              tracker.current.previous = null;
              setStatus("Error");
              setError(errors[e.data] ?? `YouTube error ${e.data}`);
              if (!trackingSuspended)
                event("error", errors[e.data] ?? `Code ${e.data}`);
              flush();
            },
            onAutoplayBlocked: () => {
              if (!active) return;
              setStatus("Playback blocked");
              if (!trackingSuspended)
                event("autoplay-blocked", "Press play in the YouTube player.");
            },
            onApiChange: () => {
              if (active && ready && local) setLive(readLiveState(local));
            },
          },
        });
        player.current = local;
        readyTimer = setTimeout(() => {
          if (active && !ready) {
            setStatus("Error");
            setError(
              "Player did not respond. Check network access, browser extensions, and embedding availability.",
            );
          }
        }, 20000);
      })
      .catch((e) => {
        if (active) {
          setError(String(e.message));
          setStatus("Error");
        }
      });
    return () => {
      if (ready && local) {
        sample();
        if (!trackingSuspended && !pendingInitialPlayback)
          reloadPosition.current = local.getCurrentTime();
      }
      flush();
      active = false;
      clearTimeout(timer);
      clearTimeout(readyTimer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", leaving);
      window.removeEventListener("analytics:flush", leaving);
      player.current = null;
      local?.destroy();
      tracker.current.previous = null;
    };
  }, [student, video, retry, initialization]);
  useEffect(() => {
    tracker.current.session = checkpoint(tracker.current.session, threshold);
    setSession(tracker.current.session);
    try {
      setStorageError(!persist(window.localStorage, tracker.current.session));
    } catch {
      setStorageError(true);
    }
  }, [threshold]);
  const reset = () => {
    player.current?.pauseVideo();
    tracker.current = {
      session: createSession(student, video),
      previous: null,
    };
    resumePosition.current = 0;
    logicalSession.current = null;
    setSessionActive(false);
    tracker.current.session = checkpoint(
      tracker.current.session,
      thresholdRef.current,
    );
    setSession(tracker.current.session);
    try {
      setStorageError(!persist(window.localStorage, tracker.current.session));
    } catch {
      setStorageError(true);
    }
  };
  const resume = () => {
    const p = player.current;
    if (!p) return;
    tracker.current.previous = null;
    tracker.current.session = recordEvent(
      tracker.current.session,
      "resume",
      resumePosition.current,
      p.getPlaybackRate(),
      "Explicit resume to saved position; skipped range is not credited.",
    );
    setSession(tracker.current.session);
    p.seekTo(resumePosition.current, true);
    p.playVideo();
  };
  const command = (action: PlayerCommand) => {
    const p = player.current;
    if (!p || !live.ready) return;
    try {
      sampleRef.current();
      if (action.type === "stop") stopRequested.current = true;
      if (action.type === "play") stopRequested.current = false;
      runPlayerCommand(p, action);
      if (action.type === "stop") tracker.current.previous = null;
      setLive(readLiveState(p));
      setCommandError("");
    } catch (e) {
      setCommandError(
        e instanceof Error ? e.message : "Player command failed.",
      );
    }
  };
  return {
    host,
    session,
    status,
    rate,
    error,
    storageError,
    rates,
    reset,
    resume,
    resumePosition: resumePosition.current,
    retry: () => setRetry((n) => n + 1),
    flush: () => flushRef.current(),
    sessionActive,
    endSession: () => endSessionRef.current(),
    live,
    command,
    commandError,
    appliedVars,
    trackingSuspended,
  };
}
