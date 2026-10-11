import type { YouTubeAPI } from "../types";
let pending: Promise<YouTubeAPI> | null = null;
export function loadYouTubeAPI(): Promise<YouTubeAPI> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    const cleanup = () => {
      clearTimeout(timeout);
      window.onYouTubeIframeAPIReady = previous;
      script.onerror = null;
    };
    const fail = () => {
      cleanup();
      script.remove();
      pending = null;
      reject(
        new Error(
          "YouTube API could not load. Check your connection and retry.",
        ),
      );
    };
    const timeout = setTimeout(fail, 20000);
    window.onYouTubeIframeAPIReady = () => {
      cleanup();
      try {
        previous?.();
      } finally {
        if (window.YT?.Player) resolve(window.YT);
        else fail();
      }
    };
    script.onerror = fail;
    document.head.append(script);
  });
  return pending;
}
