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

Records use `yt-analytics:v1:<studentId>:<videoId>`. Writes are batched approximately every two seconds, with pending flushes on pause, context cleanup, visibility changes, and pagehide. Sudden process termination can lose the final pending observations. Storage quota or browser restrictions are reported in the UI. Corrupt records are discarded. Event history keeps the latest 200 events, rate history 200 changes, and seek details 500 seeks; seek count, merged coverage and time-by-rate remain cumulative. Multiple tabs are not coordinated and can overwrite the same record; use one tab for this POC. Browser/device data is not shared, and clearing browser storage removes progress.

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
