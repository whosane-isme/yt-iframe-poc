export type Interval = [number, number];
export interface PlaybackEvent {
  id: string;
  timestamp: string;
  type: string;
  positionSeconds: number;
  playbackRate: number;
  details: string;
}
export interface Observation {
  position: number;
  duration: number;
  rate: number;
  state: number;
  mono: number;
  visible: boolean;
}
export interface WatchSession {
  sessionId: string;
  studentId: string;
  videoId: string;
  startedAt: string;
  lastUpdatedAt: string;
  duration: number;
  lastPositionSeconds: number;
  totalPlaybackWallSeconds: number;
  watchedIntervals: Interval[];
  seekCount: number;
  seekEvents: PlaybackEvent[];
  playbackRateHistory: PlaybackEvent[];
  rateWallSeconds: Record<string, number>;
  events: PlaybackEvent[];
  reachedEnd: boolean;
  progressSummary?: ProgressSummary;
  recentSessionSummaries?: FinalSessionSummary[];
}
export interface ProgressSummary {
  studentId: string;
  videoId: string;
  durationSeconds: number | null;
  uniqueWatchedSeconds: number;
  coveragePercentage: number | null;
  totalPlaybackWallSeconds: number;
  lastPositionSeconds: number;
  seekCount: number;
  rateWallSeconds: Record<string, number>;
  weightedAverageSpeed: number | null;
  reachedEnd: boolean;
  coverageThresholdSatisfied: boolean;
  completionThreshold: number;
  completed: boolean;
  lastUpdatedAt: string;
}
// Only held in memory. A refresh starts a new logical session on next playback.
export interface SessionBaseline {
  sessionId: string;
  startedAt: string;
  playbackWallSeconds: number;
  coveredSeconds: number;
  seekCount: number;
  rateWallSeconds: Record<string, number>;
}
export interface FinalSessionSummary {
  sessionId: string;
  studentId: string;
  videoId: string;
  startedAt: string;
  endedAt: string;
  playbackWallSeconds: number;
  newlyCoveredSeconds: number;
  cumulativeCoveredSeconds: number;
  cumulativeCoveragePercentage: number | null;
  seekCount: number;
  rateWallSeconds: Record<string, number>;
  weightedAverageSpeed: number | null;
  reachedEnd: boolean;
  coverageThresholdSatisfied: boolean;
  completionThreshold: number;
  completed: boolean;
  endingReason: "video_ended" | "manual_end";
}
export interface Tracker {
  session: WatchSession;
  previous: Observation | null;
}
export interface Player {
  getCurrentTime(): number;
  getDuration(): number;
  getPlaybackRate(): number;
  getPlayerState(): number;
  getVideoUrl(): string;
  getAvailablePlaybackRates(): number[];
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  setPlaybackRate(rate: number): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getVolume(): number;
  setVolume(volume: number): void;
  getOptions(module?: string): string[];
  getOption(module: string, option: string): unknown;
  setOption(module: string, option: string, value: number | boolean): void;
  destroy(): void;
}
export interface PlayerEvent {
  target: Player;
  data: number;
}
export interface YouTubeAPI {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, string | number>;
      events: Record<string, (event: PlayerEvent) => void>;
    },
  ) => Player;
}
declare global {
  interface Window {
    YT?: YouTubeAPI;
    onYouTubeIframeAPIReady?: () => void;
  }
}
