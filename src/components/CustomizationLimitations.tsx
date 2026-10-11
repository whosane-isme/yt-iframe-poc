import { DOCS } from "../lib/playerConfig";
export const CAPABILITY_MATRIX = [
  [
    "Same-channel suggestions",
    "Limited",
    "rel=0; related videos still appear.",
  ],
  ["Remove all related videos", "Unavailable", "No standard embed option."],
  ["Hide Share button", "Unavailable", "No individual button parameter."],
  ["Hide channel or video title", "Unavailable", "No modern parameter."],
  [
    "Remove YouTube branding",
    "Unavailable",
    "No supported branding-removal option.",
  ],
  ["Hide advertisements", "Unavailable", "No standard customization option."],
  ["modestbranding / showinfo", "Deprecated", "Ignored by modern embeds."],
  [
    "theme / autohide / controls=2",
    "Deprecated",
    "Old behavior is no longer supported.",
  ],
  [
    "Navigation outside the iframe",
    "Official",
    "Separate lecture links and API controls may sit beside the player.",
  ],
  [
    "Player for Education",
    "Separate offering",
    "Available through supported educational integrations, not a generic playerVars switch.",
  ],
] as const;
export function CustomizationLimitations() {
  return (
    <>
      <details className="lab-research">
        <summary>Distraction Control — What’s Actually Possible?</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {CAPABILITY_MATRIX.map(([feature, status, note]) => (
                <tr key={feature}>
                  <td>{feature}</td>
                  <td>
                    <span className="badge">{status}</span>
                  </td>
                  <td>{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          The lab keeps the iframe intact: no overlays, cropping, advertisement
          blocking or interference with YouTube links.{" "}
          <a href={DOCS.parameters} target="_blank" rel="noreferrer">
            Parameter reference
          </a>{" "}
          ·{" "}
          <a href={DOCS.minimum} target="_blank" rel="noreferrer">
            Embed requirements
          </a>{" "}
          ·{" "}
          <a href={DOCS.policies} target="_blank" rel="noreferrer">
            Developer policies
          </a>{" "}
          ·{" "}
          <a href={DOCS.education} target="_blank" rel="noreferrer">
            Player for Education
          </a>
        </p>
      </details>
      <details className="lab-research">
        <summary>How extensions like UnTrap work</summary>
        <p className="muted">
          Browser extensions can run content scripts on permitted YouTube pages.
          They modify the page DOM, inject styles and use MutationObserver to
          handle new content. This lets them hide navigation, comments,
          recommendations or Shorts. Website JavaScript cannot access a
          cross-origin YouTube iframe’s DOM. The IFrame API exposes documented
          commands and events instead.
        </p>
        <p className="muted">
          Research references:{" "}
          <a
            href="https://github.com/KishanKokal/Untrapped"
            target="_blank"
            rel="noreferrer"
          >
            Untrapped
          </a>{" "}
          ·{" "}
          <a
            href="https://github.com/Techs0n/youtube-freedom"
            target="_blank"
            rel="noreferrer"
          >
            YouTube Freedom
          </a>{" "}
          ·{" "}
          <a
            href="https://github.com/Defconn4/YouTube-Declutter"
            target="_blank"
            rel="noreferrer"
          >
            YouTube Declutter
          </a>
          . No extension code or permissions are included here.
        </p>
      </details>
    </>
  );
}
