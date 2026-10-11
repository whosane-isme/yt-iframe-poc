import type { StorageLike } from "./storage";
import {
  DEFAULT_SETTINGS,
  validateSettings,
  type PlayerSettings,
} from "./playerConfig";
export const PLAYER_SETTINGS_KEY = "yt-analytics:player-settings:v1";
export function restorePlayerSettings(storage: StorageLike): PlayerSettings {
  try {
    const raw = storage.getItem(PLAYER_SETTINGS_KEY);
    const value = raw ? JSON.parse(raw) : null;
    if (validateSettings(value)) {
      const result = { ...DEFAULT_SETTINGS };
      for (const key of Object.keys(result) as (keyof PlayerSettings)[])
        Object.assign(result, { [key]: value[key] });
      return result;
    }
  } catch {
    /* Use defaults when storage cannot be read. */
  }
  return { ...DEFAULT_SETTINGS };
}
export function savePlayerSettings(
  storage: StorageLike,
  s: PlayerSettings,
): boolean {
  if (!validateSettings(s)) return false;
  try {
    storage.setItem(PLAYER_SETTINGS_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
