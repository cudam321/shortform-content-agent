---
name: yt-shorts
description: Daily add-on — promote the best-performing TikTok clips to YouTube Shorts on your one configured YouTube main channel. Use when asked to "post the youtube shorts", "promote best clips to youtube", "run the YT shorts", or on the daily schedule (after daily-post).
---

# YouTube Shorts Run

Repost the **best-performing, on-brand** TikTok clips as **YouTube Shorts** on your main YouTube
channel. This is the YouTube sibling of `ig-trial-reels` (no trial mode — YouTube has none). It
reuses clips ALREADY rendered and posted to TikTok — it never re-renders. **Quality over quota** —
post fewer than 3 if fewer qualify. See CLAUDE.md hard rules.

Target: the `amplification.youtube_main` channel in `accounts/accounts.yaml`. Cadence: **up to
3/day**. YouTube classifies a video as a **Short automatically** when it's vertical (9:16) and
≤3 min — no flag needed. Your masters are 1080×1920 and short, so they post as Shorts.

## 0. Sync state
- Local: `git pull` first. Cloud (routine): fresh clone is current; `npm ci` if node_modules is
  missing.
- Run LATER in the day than `daily-post` so the prior day's TikTok posts have accumulated analytics.

## 1. Load state
- Read `CLAUDE.md`, `accounts/accounts.yaml`, `knowledge/editing.md` + `knowledge/marketing.md`,
  `state/ledger.json`, and `state/yt-shorts-ledger.json` (never repost the same raw clip to YT
  twice). NB: the YT ledger is INDEPENDENT of the IG ledger — a clip already on Instagram is still
  eligible for YouTube (different audience).

## 1b. First run only: verify the Zernio API — don't assume
- `node scripts/zernio.mjs accounts` and confirm the YouTube account (`platform: "youtube"`, the
  right username, `isActive: true`). If the channel is suspended, uploads 403 — surface it and stop.
- Before any real post, `node scripts/zernio.mjs post ... --dry-run` and confirm the body:
  `platforms[0].platformSpecificData = { title, visibility: "public", madeForKids: false }`,
  `content` = description.
- After the FIRST real Short, fetch it back (`get /posts/<id>`) and confirm the title/visibility
  landed BEFORE doing the rest.

## 2. Pull the performance data
- The **ledger** (`state/ledger.json`, `{ posts: [...] }`) is the candidate universe. We can only
  repost clips that have an `edited_file` master.
- `node scripts/zernio.mjs analytics --query "platform=tiktok&limit=50&page=N"` — response is
  `{ overview, posts, pagination, accounts }`; **paginate over all `pagination.pages`**.
- **Join key**: ledger `zernio_post_id` === analytics post `latePostId` (verify against your data).
  Fallback: ledger `tiktok_url` video id === `platforms[].platformPostId`. Metric: `views` (primary),
  then `engagementRate` / `shares` / `comments` / `likes`.

## 3. Rank & select (up to 3, backlog drain)
1. Join each ledger TikTok post to its analytics row → attach `views`.
2. **Dedup by `raw`**: keep only the highest-views variant of each raw clip.
3. **Exclude** any `raw` already in `state/yt-shorts-ledger.json`.
4. Rank the deduped set by `views` (tiebreak `engagementRate`, then `shares`) — ALL-TIME backlog
   drain, best-first.
5. Walk best-first, apply the on-brand QC gate (step 4), keep the first **up to 3** that PASS.

## 4. On-brand QC per candidate (strict — main channel)
A clip must clear ALL of these or it's skipped:
- **Has a repostable master.** Skip if the ledger entry has no `edited_file`.
- **Has a real, on-brand hook.** Skip if the ledger `edit` shows no custom hook.
- **House-style compliant.** Lint the hook text against `knowledge/editing.md`.
- **Looks right.** `node scripts/dropbox.mjs share "<edited_file>"` (permanent URL), then download +
  `analyze-video.mjs` and view a frame.
- **Short media spec** (ffprobe): **1080×1920, H.264, vertical 9:16, duration ≤3 min** (so YouTube
  classifies it as a Short).

## 5. Title + description — main voice
- **Title** (≤100 chars, required): a tight, on-brand line — usually the clip's hook or a close
  variant — in the main channel's voice. No view-count meta.
- **Description** (the `--caption`, becomes the YouTube description): a fresh main-voice line ending
  on a reply-driving beat. Add `#Shorts` + 3-5 niche tags. No view-count / "fan favorite" meta.

## 6. Post the Short
- Stagger the up-to-3 across slots. Use the PERMANENT share URL (Zernio uploads media at publish
  time):
```
node scripts/zernio.mjs post --platform youtube --account-id <yt_main_id> \
  --title "..." --caption "<description> #Shorts ..." \
  --video-url "<permanent dl.dropboxusercontent URL>" \
  --visibility public --schedule <ISO local> --tz <tz>
```

## 7. Ledger + cleanup + commit
- Append each posted clip to `state/yt-shorts-ledger.json`: `{ date, raw, source_account,
  source_tiktok_post_id, source_views, edited_file, yt_video_url, yt_zernio_post_id, title,
  description, visibility, scheduled, status }`.
- Delete local QC files (`rm work/yt-*.mp4` + frames).
- **Commit state** (cloud MUST): `git add state/ && git commit -m "yt-shorts: $(date +%F) run" &&
  git push`.

## 8. Run report
- Shorts posted (source clip + raw + source views + scheduled slot + title).
- Candidates skipped and why (already on YT / no hook / no master / off-brand).
- Backlog depth left — flag when supply is thin.

## Failure handling
- Zernio post fails → retry once; if still failing, record the candidate as `status: "failed"` so
  tomorrow retries it, and surface the error.
- If the channel is suspended (403) or missing the YouTube scope, stop and surface it.
- Always use a permanent `share` link; Zernio uploads at PUBLISH time.
