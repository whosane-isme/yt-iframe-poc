# YT IFrame Analytics Lab

A working frontend proof of concept for student-level lecture watch analytics on a free educational platform for students in Iraq. YouTube hosts and streams videos; this application collects observed playback through the official IFrame Player API. No API key, YouTube Data API, backend, paid hosting, or authentication provider is required.

**ملخص بالعربية:** هذا المشروع يوضح إمكانية استخدام يوتيوب لاستضافة المحاضرات مجاناً، مع تتبع تشغيل الطالب داخل موقعنا: وقت التشغيل، الأجزاء المشاهدة، القفز بين المقاطع، وسرعة التشغيل. بيانات كل طالب ومحاضرة منفصلة ومحفوظة محلياً. هذه البيانات لا تثبت انتباه الطالب، وليست نظاماً آمناً أو جاهزاً للإنتاج.

## Stack and features

Vite, React, strict TypeScript, Tailwind CSS, Lucide React, Vitest, and versioned localStorage. The dashboard has an official YouTube player with its normal branding and controls; three simulated student identities; validated URL/video ID input; live coverage, wall time, position, speed, inferred seeks, rate history, completion, timeline range inspection, event history, saved-position resume, reset, and readable JSON export. It contains no fabricated analytics.

## Run locally

Use Node.js 22.12+ or Node.js 24 LTS and npm.

```sh
git clone git@github.com:whosane-isme/yt-iframe-poc.git
cd yt-iframe-poc
npm ci
npm run dev
```

Open the URL Vite prints, normally http://127.0.0.1:5173/yt-iframe-poc/. Serve the application over HTTP/HTTPS; opening index.html through file:// will not work properly. The initial documentation sample is M7lc1UVf-VE and never autoplays.

```sh
npm test
npm run build
npm run preview
```

The build performs strict TypeScript checking before generating dist/. Unit tests cover the independent engine, interval calculations, URL validation and persistence; they do not automate actual YouTube playback.

## Using the dashboard

Select Student A, press the normal YouTube play button, and observe live metrics. Paste an embeddable YouTube URL or raw 11-character ID to change lectures. Supported formats include watch, youtu.be, embed, Shorts, and live URLs. Private, removed, region-restricted, age-restricted, and embedding-disabled videos may not play.

Changing students or videos destroys the old player, flushes pending telemetry, and creates a fresh non-autoplay player for the selected context. Each student/video pair has a separate cumulative record. Returning to it restores its analytics; **Resume saved position** explicitly seeks and starts playback. The current position resets to what the newly cued player reports, while the prior position remains available through Resume for that page visit. Reset selected progress clears that pair; Clear local data clears only this application's namespaced records. Destructive actions use a confirmation dialog.

Download JSON exports the selected record, merged intervals, seek events, rate history/time by speed, coverage and completion calculations, implementation version, and export timestamp. All timestamps are ISO UTC; the visible log displays local time. No data is transmitted to an application server.

## What is measured

Direct API signals: ready, state changes (playing, paused, buffering, ended, cued), playback rate changes, errors and autoplay blocking. API getters provide playback position, duration, rate, state, available rates and video URL. API support: https://developers.google.com/youtube/iframe_api_reference

Calculated/inferred metrics: seeks, watched intervals, unique coverage, wall-clock playback time by speed, and application completion. There is no native seek event. The API does not identify the logged-in student or prove attention.

The independent engine compares monotonic elapsed time, previous/current position, state, visibility and rate. Visible playback is sampled every 500 ms; idle metadata/position is sampled every 1500 ms to discover duration and paused seeks. Expected advancement is elapsed time × previous rate, with a tolerance of max(0.35 seconds, 30% of expected advancement). Plausible positive advancement credits only the observed interval, and wall time is capped at the smaller of elapsed time and advancement/rate. Stationary observations earn no time. State-transition observations can credit a plausible final playing tail before pause/buffering, but subsequent paused/buffering intervals cannot contribute. Rate transitions break the baseline conservatively.

Large jumps or backward changes infer seeks and never credit the skipped range. Gaps over three seconds receive no credit. Hidden tabs receive no credit, and visibility transitions break the baseline. This intentionally undercounts some playback, including legitimate background viewing. Small seeks within tolerance may be missed; multiple seeks between samples may be combined or missed. Playback around ads, network stalls, rapid seeks and transitions may be undercounted. Only finite positive known durations support credited coverage; initially zero duration is retried through polling. This POC targets finite recorded lectures, not live streams.

Intervals are merged and clamped to duration. Watching 0–120 seconds, skipping to 420, then watching to 480 gives 180 seconds / 30% of a 600-second lecture. Rewatching 0–120 adds wall time but keeps unique coverage at 120 seconds. At 2×, one wall second can cover two video seconds. Jumping straight to the end never credits the entire lecture.

**Reached end** means YouTube emitted ENDED. **Completed** requires the configured unique coverage threshold (default 90%) AND reached end. Threshold options are 80%, 90%, 95% and 100%; changing the rule only recomputes completion and does not alter observations. A 100% threshold can be difficult to reach because observation-based tracking is conservative.

## Persistence and retention

Records use `yt-analytics:v1:<studentId>:<videoId>`. Writes are batched approximately every 20 seconds, with checkpoints on pause, inferred seek, rate changes, finalization, context cleanup, visibility changes, and pagehide. Sudden process termination can lose the final pending observations. Storage quota or browser restrictions are reported in the UI. Corrupt records are discarded. Event history keeps the latest 200 events, rate history 200 changes, and seek details 500 seeks; seek count, merged coverage and time-by-rate remain cumulative. Multiple tabs are not coordinated and can overwrite the same record; use one tab for this POC. Browser/device data is not shared, and clearing browser storage removes progress.

## Manual browser test checklist

1. Select Student A and play for a minute. Coverage and wall time should grow only during plausible visible playback.
2. Pause for ten seconds, resume, and trigger buffering if possible. Paused/buffering time must not grow.
3. Use YouTube's own seek bar to skip forward. Confirm an inferred seek and a gray gap; inspect ranges. Seek backward and replay; unique coverage must not double-count.
4. Change speed to 2× with YouTube's controls. Confirm a rate event and roughly twice the content advancement per wall second.
5. Reload, reselect the same pair and use Resume saved position. Verify saved coverage and wall time persist.
6. Select Student B, then return to A. Verify independent metrics and no playback leaking into another identity, including rapid switching.
7. Change video IDs, play, then return to the first video. Confirm separate saved progress.
8. Let a short video finish naturally. Verify reached end, and completion only if coverage meets the rule. Separately skip directly near the end and let it end: insufficient coverage must remain incomplete.
9. Background the tab for at least ten seconds and return. Hidden playback must not bridge into covered content.
10. Load an unavailable/private video (a syntactically valid ID does not guarantee availability) and a video known to forbid embedding. Check actionable errors 100/101/150; error 153 explains origin/referrer identification. Block the API request and retry to verify loading errors.
11. Export JSON, inspect interval and completion values, reset the pair, and clear all demo data. Test on mobile and check range inspection, controls and horizontal event-table scrolling.

Real YouTube playback requires an internet connection and browser permission to access YouTube. Ad blockers, tracking protections, network restrictions, region rules and video-owner settings can prevent playback. Autoplay-blocked is supported when emitted by the API. No overlays cover the player, advertisements are not hidden, and ordinary links to YouTube remain available. The player preserves a minimum 200px height on small screens. Embedded player requirements: https://developers.google.com/youtube/terms/required-minimum-functionality

## GitHub Pages deployment

Vite uses `/yt-iframe-poc/` as its base. The included `.github/workflows/pages.yml` runs npm ci, unit tests, strict checking/build, uploads dist/, and deploys through the official Pages actions on pushes to main or manual dispatch.

In the GitHub repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**. Enable Actions and allow the workflow's Pages/id-token permissions if repository policy restricts them. Then push to main or run the workflow manually. The expected URL is https://whosane-isme.github.io/yt-iframe-poc/ after a successful deployment. Pages must be enabled before configure-pages/deploy can succeed. The GitHub Pages environment may require approval under repository policy.

For a renamed repository update Vite's base; for root/custom-domain hosting use `/`. Test embeds over the final HTTPS origin. The player includes `origin: window.location.origin`; the page uses strict-origin-when-cross-origin, which sends the origin to YouTube. Do not add `no-referrer` headers/meta or otherwise suppress client identification, as this can cause YouTube error 153.

## Future backend integration

Keep the tracking engine and replace localStorage with a batching transport. Conceptual endpoints (not implemented):

- `POST /api/lectures/:lectureId/watch-events`
- `GET /api/lectures/:lectureId/progress`
- `GET /api/instructor/lecture-analytics`

Real authentication supplies student identity; the backend must not trust a student ID submitted in JSON. Send bounded batches with event IDs, session IDs, context, sequencing and implementation version; retry safely and deduplicate. Validate authorization, lecture/video mapping, rates, positions, chronology and plausible transitions. The backend should compute authoritative progress from accepted observations rather than trusting client percentages. Client events are manipulable even with server validation; they do not establish attention or secure proof of watching. Production needs concurrency handling, retention policy, aggregation, monitoring, privacy notices and review of applicable YouTube policies.

Viewing directly on YouTube or outside this website cannot be attributed by this tracker. Unlisted videos are discoverable by anyone holding the link and are not access control. YouTube may show ads and related content; availability and embedding remain controlled by YouTube and video owners. Inform students about collected identifiers, player events, progress and retention. Never put secrets or privileged credentials in the frontend. This demo uses fictional profiles and local browser data rather than real authentication or a database.

## Automatic Watch Summary (tracking version 1.1.0)

Watch Summary extends the existing analytics panel with a deterministic prose report, wall-time-weighted average speed, explicit coverage-threshold status and last observed update. Existing position, coverage, time and seek metrics stay in their original locations. A separate Viewing sessions panel shows the latest finalized session, its speed distribution and a compact history. No runtime AI, language model, API key or paid dependency is involved: TypeScript templates describe calculated evidence with fixed wording. Unknown duration or insufficient speed evidence is displayed as **Not available**.

### Checkpoint vs final summary

The live report updates with existing player observations. A cumulative checkpoint is persisted approximately every **20 seconds**, plus significant events: pause, inferred seek, playback-rate change, ENDED, explicit End Session, threshold changes, context switching, visibility changes and pagehide. Loading also saves an initial derived checkpoint. These are batched records, not synchronous writes on each 500ms observation.

Pause does **not** end a logical session. The first PLAYING event starts one with a fresh UUID and a baseline of cumulative wall time, coverage, seeks and rate totals. **End Session** samples the final plausible tail, finalizes once, and pauses the player. YouTube **ENDED** automatically finalizes an open session. Clearing the active baseline plus a session-ID check prevents repeated ENDED/rerenders from duplicating a summary. Playback after finalization begins another session; cumulative progress remains intact. A session may have zero newly covered content when it replays earlier material.

Session-only time, inferred seeks and rate distribution are differences from the baseline, not cumulative totals. Newly covered content is the increase in merged cumulative coverage during that session. Session summaries explicitly label cumulative coverage and completion **after** the session. Reached-end and completion refer to cumulative lecture evidence; a later manual session can therefore finish with an already-completed lecture. Historical summaries preserve the threshold and completion result at finalization. Live progress uses the current dashboard threshold (the existing selector defaults to 90% after reload).

Switching contexts, reloading, and browser close checkpoint progress but do not synthesize a finalized session or a third ending reason. An unfinished logical session is abandoned at context teardown; the next playback starts a new baseline. Logical baselines are in memory only. Pagehide and visibility checkpointing are best effort: an abrupt process kill can lose pending updates (roughly up to the periodic interval under ordinary conditions), and browser close cannot guarantee finalization. Previously saved cumulative progress still restores on another visit/day.

### Records, compatibility and retention

The existing versioned `yt-analytics:v1:<student>:<video>` key is extended additively with `progressSummary` and `recentSessionSummaries`. This is one record per student/video, with no second raw-event store or session-by-session interval duplication. Legacy records without these fields restore their existing totals and merged intervals; the next checkpoint adds the summary. Invalid optional summary entries are discarded while valid cumulative progress is retained; the cumulative summary is recomputed from aggregates rather than trusted as a separate source of truth. Restored history is validated, deduplicated and capped at ten.

Keep: merged cumulative watched intervals, cumulative wall time and per-rate seconds, seek count, reached-end evidence, a derived cumulative checkpoint, latest **10** finalized session summaries, and existing bounded histories (200 playback events, 200 rate changes, 500 seek details). Discard: older finalized summaries and raw log entries beyond these limits. Discarding history does not subtract cumulative totals. A historical session stores aggregates only, never a complete copy of watched intervals or raw events. The legacy WatchSession.sessionId is the cumulative record identifier; each finalized logical session has its own UUID.

JSON export retains existing fields and adds `cumulativeProgressSummary`, `latestFinalizedSessionSummary` (null if none), `recentSessionHistory`, completion calculation, export timestamp and tracking version. The report cannot establish attention, learning or secure proof of viewing. Existing background-gap, seek-inference, unavailable-duration, quota and multi-tab limitations still apply.

### Future PostgreSQL integration

Use a `lecture_progress` table with a unique `(student_id, lecture_id)` key and columns such as `watched_intervals JSONB`, `coverage_percentage`, `total_playback_seconds`, `seek_count`, `playback_rate_seconds JSONB`, `last_position_seconds`, `reached_end`, `completed`, and `updated_at`. A separate session-summary table can use unique session IDs plus retention policy. Map authenticated students and authorized lectures server-side, validate and deduplicate batches, and recompute authoritative progress from accepted evidence.

An individual JSON file per playback event is unnecessary: batched transport plus aggregate progress avoids large numbers of tiny files, redundant copies and expensive read/merge operations. If production auditing requires raw events, store them in a separate retention-controlled event table; the aggregate progress row remains the source for dashboard queries. Client summaries are not trusted evidence, even when saved to PostgreSQL.

### Summary-specific manual checks

1. Play, change speed, seek and pause. Confirm the live prose uses actual values and pause leaves the session open.
2. Click End Session twice: the button disables and exactly one new finalized summary remains. Reload to verify it persists.
3. Play again and replay a covered section. Finalize: session wall time increases, new coverage can be zero, cumulative coverage is not doubled.
4. Watch a new section and finalize. Compare session time/new coverage with cumulative lecture totals.
5. Switch students and videos and confirm separate history. Return after reload to the same pair.
6. Play through the end and separately seek near the end. Both can finalize with video_ended, but only sufficient cumulative coverage satisfies completion.
7. Generate more than ten sessions: history retains ten, cumulative metrics retain all accepted observations.

Unit tests cover deterministic summaries at 1x/2x, replay and seek behavior, distinct session/cumulative metrics, completion and repeated finalization, rate weighting, bounded history, student/video isolation, legacy/corrupt storage restoration and unavailable values.
