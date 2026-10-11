import { FlaskConical, Info } from "lucide-react";
export function TestingGuide() {
  return (
    <>
      <section className="panel test-panel">
        <div className="section-heading">
          <h2>
            <FlaskConical size={18} /> How to test this POC
          </h2>
          <span className="badge">5 MINUTE WALKTHROUGH</span>
        </div>
        <div className="checklist">
          {[
            "Play for a minute. Watch coverage and wall time grow.",
            "Skip ahead. The skipped content stays gray.",
            "Choose 2× in YouTube settings. Coverage grows faster than wall time.",
            "Pause, reload, and resume your saved position.",
            "Switch students or videos. Each has separate progress.",
            "Jump to the end. Reached end does not mean completed.",
          ].map((text, i) => (
            <div key={text}>
              <span>{i + 1}</span>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
      <div className="telemetry-note">
        <Info size={18} />
        <p>
          Playback is evidence of player activity, not attention. This
          frontend-only demo stores telemetry on this device. Client-side data
          can be manipulated; unlisted YouTube links are not access control.
        </p>
      </div>
    </>
  );
}
