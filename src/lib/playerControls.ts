import type { Player } from "../types";
export type PlayerCommand =
  | { type: "play" | "pause" | "stop" | "mute" | "unmute" }
  | { type: "seek" | "rate" | "volume" | "captionSize"; value: number };
export interface LivePlayerState {
  ready: boolean;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  captionSizesAvailable: boolean;
  captionSize: number | null;
}
export const EMPTY_LIVE_STATE: LivePlayerState = {
  ready: false,
  position: 0,
  duration: 0,
  volume: 100,
  muted: false,
  captionSizesAvailable: false,
  captionSize: null,
};
export function readLiveState(player: Player): LivePlayerState {
  const available =
    player.getOptions().includes("captions") &&
    player.getOptions("captions").includes("fontSize");
  const size = available ? player.getOption("captions", "fontSize") : null;
  return {
    ready: true,
    position: player.getCurrentTime(),
    duration: player.getDuration(),
    volume: player.getVolume(),
    muted: player.isMuted(),
    captionSizesAvailable: available,
    captionSize:
      typeof size === "number" && [-1, 0, 1, 2, 3].includes(size) ? size : null,
  };
}
export function runPlayerCommand(player: Player, command: PlayerCommand): void {
  switch (command.type) {
    case "play":
      player.playVideo();
      break;
    case "pause":
      player.pauseVideo();
      break;
    case "stop":
      player.stopVideo();
      break;
    case "mute":
      player.mute();
      break;
    case "unmute":
      player.unMute();
      break;
    case "seek":
      if (!Number.isFinite(command.value) || command.value < 0)
        throw Error("Enter a nonnegative timestamp in seconds.");
      player.seekTo(
        Math.max(
          0,
          player.getDuration() > 0
            ? Math.min(command.value, player.getDuration())
            : command.value,
        ),
        true,
      );
      break;
    case "rate":
      if (!player.getAvailablePlaybackRates().includes(command.value))
        throw Error("This playback speed is unavailable.");
      player.setPlaybackRate(command.value);
      break;
    case "volume":
      if (!Number.isFinite(command.value)) throw Error("Invalid volume.");
      player.setVolume(Math.max(0, Math.min(100, command.value)));
      break;
    case "captionSize":
      if (
        ![-1, 0, 1, 2, 3].includes(command.value) ||
        !readLiveState(player).captionSizesAvailable
      )
        throw Error("Caption font size is unavailable for this player.");
      player.setOption("captions", "fontSize", command.value);
      break;
  }
}
