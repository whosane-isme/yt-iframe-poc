# YT IFrame Analytics Lab

A frontend POC for an educational platform in Iraq. YouTube hosts the lectures; this app records playback observed on our website and shows progress per simulated student and video.

Built with React, TypeScript, Vite, Tailwind CSS, Lucide and Vitest. No backend, API key or AI service. Progress and player preferences live in the browser.

## Run

Use Node.js 24 LTS and npm.

```sh
git clone git@github.com:whosane-isme/yt-iframe-poc.git
cd yt-iframe-poc
npm ci
npm run dev
```

Open http://127.0.0.1:5173/yt-iframe-poc/. The initial video is YouTube's documentation sample, `M7lc1UVf-VE`. Initial loads never autoplay, including when saved preferences request autoplay.

```sh
npm test          # unit, hook and component tests
npm run build    # strict TypeScript check, then dist/
npm run preview  # serve the production build
```

Serve over HTTP or HTTPS, not `file://`. YouTube requires network access and a working embed; private, removed, restricted or embedding-disabled videos may fail. Error messages cover API/network failures and YouTube errors including 100, 101, 150 and 153.

## Watch tracking

Select Student A, B or C and play a video. The URL field accepts watch, youtu.be, embed, Shorts and raw video IDs. Progress stays separate for each student/video pair. Reload restores the selected pair; Resume saved position starts playback explicitly.

| Metric             | Meaning                                                 |
| ------------------ | ------------------------------------------------------- |
| Current position   | The API's current playback position                     |
| Playback wall time | Observed time playing; includes repeated viewing        |
| Unique coverage    | Union of credited video intervals; repeats count once   |
| Inferred seeks     | Position changes inconsistent with normal playback      |
| Reached end        | A YouTube ENDED event during full-lecture playback      |
| Completed          | Coverage meets the chosen threshold **and** reached end |

The tracker samples visible playback about every 500ms and idle position about every 1500ms. It compares position advancement with monotonic elapsed time × playback rate, using a tolerance of max(0.35 seconds, 30%). Plausible advancement credits an interval; backward jumps and large forward jumps leave gaps. Paused, buffering, stationary and hidden playback earns no time. Gaps over three seconds and rate transitions break continuity conservatively.

For a ten-minute lecture, playing 0:00–2:00, skipping to 7:00, then playing to 8:00 covers about three minutes (30%). Rewatching a covered section adds wall time without adding unique coverage. Skipping to the end cannot credit the skipped content.

Watch Summary uses TypeScript templates and a wall-time-weighted average speed. Unknown duration or insufficient speed evidence shows “Not available.” No language model is involved.

**Pause saves a checkpoint and keeps the session open.** End Session or YouTube ENDED finalizes it once. Later playback starts a new session. Session time, seeks and speed distribution are differences from the starting totals; newly covered content is the increase in cumulative coverage. Historical completion records the cumulative lecture result and threshold at finalization. The threshold defaults to 90% after reload.

## Player Customization Lab

Click **Customize Player** beside the player. The panel is optional. Select a preset or edit settings, then choose **Apply and reload player**. Reset buttons change the draft; Apply activates it. Draft and actual initialization objects are shown separately.

| Preset                   | Configuration                                                                  |
| ------------------------ | ------------------------------------------------------------------------------ |
| YouTube Default          | Native controls, standard suggestions, autoplay off; inline mobile playback on |
| Classroom Focus          | Arabic interface, native controls, same-channel suggestions                    |
| Accessibility            | Native controls and keyboard shortcuts; captions requested when available      |
| Minimal Supported Player | Native controls hidden; external API controls stay available                   |
| Custom                   | Individually edited supported settings                                         |

All exposed `playerVars` changes require iframe recreation:

| Setting             | Parameter / values                                                   |
| ------------------- | -------------------------------------------------------------------- |
| Interface language  | `hl`: automatic, `ar`, `en`                                          |
| Progress bar        | `color`: `red`, `white`                                              |
| Native controls     | `controls`: `1` / `0`                                                |
| Fullscreen button   | `fs`: `1` / `0`                                                      |
| Annotations         | Default / `iv_load_policy=3`; does not remove cards or every overlay |
| Autoplay            | `autoplay`: `0` / `1`; consent applies to this Apply action only     |
| Single-video loop   | `loop=1` with `playlist=<videoId>`                                   |
| Keyboard shortcuts  | `disablekb`: `0` / `1`                                               |
| iOS inline playback | `playsinline`: `1` / `0`; device and WebView support varies          |
| Related videos      | `rel`: `1` / `0`; zero limits suggestions to the same channel        |
| Default captions    | User preference / `cc_load_policy=1`                                 |
| Caption language    | `cc_lang_pref`: automatic, `ar`, `en`; track availability varies     |
| Playback segment    | Optional integer `start` and `end`, measured from video start        |

Reloading saves progress, retains the open session, destroys the old player and clears the observation baseline. The next player requests the previous position where practical; integer start times and keyframes can shift it. Playback stays paused unless the Apply action explicitly requests autoplay. Browser restrictions can still block autoplay.

**Start/end experiments suspend lecture analytics and session finalization.** They cannot mark a full lecture complete. Return to full-lecture settings to continue tracking. The earlier full-lecture position and progress are retained.

Live Player Controls use the official API for play, pause, stop, seek, rate, mute and volume. Rates come from `getAvailablePlaybackRates()`. Stop cancels playback/loading and can change player state; it does not finalize a session. Caption font size (-1 through 3) uses the documented captions module after `onApiChange`; the control is disabled when unavailable. These runtime controls do not reload the iframe or persist playback preferences. Quality selection remains in YouTube's native controls.

The width preview uses the same player at 1280, 768, 390 or 320px, capped by available space. It preserves at least 200 × 200px and uses 16:9 where space permits. It is a layout check, not an Android/iOS emulator. Test real devices too. Form labels, keyboard focus, touch-friendly controls and reduced-motion styling are included. Hiding native controls removes some useful interactions; keep them enabled for students.

Copy playerVars and Download customization JSON export the draft, actual applied parameters, preset and documentation links.

## Embed limits and research

The lab cannot remove related videos, Share, video titles, channel attribution, branding or ads. `modestbranding`, `showinfo`, `theme`, `autohide` and `controls=2` are deprecated. None is generated or offered as a working switch. Player for Education is a separate educational integration, not a playerVars setting available to any website.

Browser extensions such as [Untrapped](https://github.com/KishanKokal/Untrapped), [YouTube Freedom](https://github.com/Techs0n/youtube-freedom) and [YouTube Declutter](https://github.com/Defconn4/YouTube-Declutter) use permitted content scripts, DOM changes and styles on YouTube pages. Some use MutationObserver for dynamic content. Ordinary website JavaScript cannot modify the cross-origin iframe DOM. This app includes none of their injection code or extension permissions.

The player is never obscured, cropped or replaced to hide recommendations. Its links and branding remain available. Official references:

- [Player parameters](https://developers.google.com/youtube/player_parameters)
- [IFrame API](https://developers.google.com/youtube/iframe_api_reference)
- [Required minimum functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)
- [Developer policies](https://developers.google.com/youtube/terms/developer-policies)
- [Player for Education](https://support.google.com/youtube/answer/18481571)

## Storage and export

| Key                                 | Contents                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `yt-analytics:v1:<student>:<video>` | Cumulative intervals/totals, checkpoint, bounded event and session history |
| `yt-analytics:player-settings:v1`   | Applied player preferences, separate from analytics                        |
| `yt-analytics:context:v1`           | Last selected student/video                                                |

Checkpoints save about every 20 seconds and on pause, seek, rate change, finalization, threshold change, context switch, visibility change and pagehide. Old progress records remain compatible. Retention: 200 events, 200 rate changes, 500 seek details and 10 finalized session summaries. Older detail is discarded without subtracting cumulative totals. Historical summaries contain aggregates, not copies of all intervals.

Download JSON exports the selected analytics, cumulative summary, latest finalized session, recent history, completion calculation, timestamp and tracking version. Reset selected progress clears that pair; Clear local data clears all student analytics while retaining preferences. Exported timestamps are UTC; UI times use the browser's locale.

Closing or reloading checkpoints progress but does not finalize an unfinished session. Unexpected termination can lose pending updates, and multiple tabs can overwrite the same record. Storage is local to one browser/device; quota failures are shown. Viewing outside this website is not tracked. Small seeks, ads and throttled timers can reduce accuracy; hidden playback is intentionally uncredited. This tracker targets recorded lectures, not live streams.

## Verification checklist

1. Play, pause, seek forward/backward and change speed. Check coverage gaps and separate wall time.
2. End a session, replay covered content and finalize again. Compare session totals with cumulative totals; reload and confirm history survives.
3. Switch students and videos. Confirm isolated progress, then reload the selected pair.
4. Apply Classroom Focus, white/red progress bars, language and caption preferences. Confirm the actual iframe parameters and no extra session or lost coverage.
5. Try Minimal, close the lab and use the external controls. Check speed, seeking, mute, volume and keyboard access.
6. Try a start/end segment. Confirm analytics remain unchanged and completion is suspended. Return to full playback.
7. Check 390/320px previews and real mobile browsers. Test caption availability and fullscreen/inline behavior on actual devices.
8. Play a short video to its end; separately skip near the end. ENDED should finalize both, but inadequate coverage stays incomplete. Background the tab and test an unavailable video.
9. Export both JSON files. Reload with autoplay saved: playback must not start automatically.

Unit tests mock the player where needed. They do not prove that every YouTube setting behaves identically on all videos or browsers.

## GitHub Pages

In repository **Settings → Pages**, choose **GitHub Actions** as the source. Push to `main` or run the Pages workflow manually. It installs dependencies, runs tests, builds and deploys `dist/`.

Vite's base is `/yt-iframe-poc/`. After a successful deployment, the URL is https://whosane-isme.github.io/yt-iframe-poc/. Repository policy may require Pages permissions or environment approval. For a renamed repository or custom domain, update `base`.

Keep `origin: window.location.origin` and the page's `strict-origin-when-cross-origin` referrer policy. Suppressing the Referer can cause YouTube error 153.

## Production integration

Replace localStorage with authenticated, batched event transport. Validate authorization, timestamps, rates and positions; deduplicate event/session IDs and compute accepted progress on the server. Suggested endpoints:

- `POST /api/lectures/:lectureId/watch-events`
- `GET /api/lectures/:lectureId/progress`
- `GET /api/instructor/lecture-analytics`

In PostgreSQL, use `lecture_progress` with unique `(student_id, lecture_id)`, merged intervals JSONB, coverage, playback seconds, seek count, rate-seconds JSONB, position, reached-end/completed flags and updated timestamp. Keep session history in a separate table with retention. A JSON file per playback event adds unnecessary file-management work; batches and aggregate rows fit these queries better.

Client telemetry can be manipulated and does not measure attention or learning. Unlisted links are not access control. Tell students what is collected, define retention, and review YouTube's policies before production use. Loading the embed also sends data to YouTube.

## ملخص للفريق

المشروع يتتبع تشغيل المحاضرات داخل موقعنا، مع حفظ تقدم مستقل لكل طالب وفيديو. مختبر التخصيص يتيح تجربة إعدادات يوتيوب الرسمية مثل اللغة والترجمة والتحكم بالتشغيل. تغيير الإعدادات يحافظ على التقدم، وتجارب المقاطع لا تُحتسب كمشاهدة للمحاضرة كاملة. لا يمكن للموقع إزالة إعلانات يوتيوب أو تعديل محتوى الإطار الداخلي. البيانات محلية، ولا تثبت انتباه الطالب؛ النسخة الإنتاجية تحتاج تسجيل دخول وخادماً للتحقق من البيانات.
