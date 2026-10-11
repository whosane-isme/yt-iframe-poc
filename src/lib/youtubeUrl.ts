export function parseVideoId(input: string): string | null {
  const value = input.trim();
  const valid = (s: string | null) =>
    s && /^[A-Za-z0-9_-]{11}$/.test(s) ? s : null;
  if (valid(value)) return value;
  try {
    const u = new URL(value);
    if (!["https:", "http:"].includes(u.protocol)) return null;
    const host = u.hostname.toLowerCase();
    if (host === "youtu.be") return valid(u.pathname.split("/")[1]);
    if (
      ![
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
      ].includes(host)
    )
      return null;
    if (u.pathname === "/watch") return valid(u.searchParams.get("v"));
    const parts = u.pathname.split("/");
    return ["embed", "shorts", "live"].includes(parts[1])
      ? valid(parts[2])
      : null;
  } catch {
    return null;
  }
}
