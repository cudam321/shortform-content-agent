---
name: ig-trial-reels
description: Daily add-on — promote the best-performing TikTok clips to Instagram Trial Reels on your one configured Instagram main account. Use when asked to "post the trial reels", "promote best clips to instagram", "run the IG trial reels", or on the daily schedule (after daily-post).
---

# Instagram Trial Reels Run

Repost the **best-performing, on-brand** TikTok clips as **Instagram Trial Reels** on your main IG
account. Trial Reels show to non-followers first and auto-graduate to followers if they perform
(`graduationStrategy: SS_PERFORMANCE`). This is an amplification routine: it reuses clips ALREADY
rendered and posted to TikTok — it never re-renders. **Quality over quota** — post fewer than 3 if
fewer qualify. See CLAUDE.md hard rules.

Target: the `amplification.instagram_main` account in `accounts/accounts.yaml` (the ONLY non-TikTok
account this routine may post to). Graduation: `SS_PERFORMANCE`. Cadence: **up to 3/day**.

## 0. Sync state
- Local: `git pull` first. Cloud (routine): fresh clone is current; `npm ci` if node_modules is
  missing.
- Run this LATER in the day than `daily-post` so the prior day's TikTok posts have accumulated
  real analytics.

## 1. Load state
- Read `CLAUDE.md`, `accounts/accounts.yaml`, `knowledge/editing.md` + `knowledge/marketing.md`
  (the on-brand bar), `state/ledger.json`, and `state/ig-trial-ledger.json` (what's already been
  reposted to IG — never repost the same raw clip twice).

## 1b. First run only: verify the Zernio API — don't assume
- `node scripts/zernio.mjs accounts` and confirm the Instagram account (`platform: "instagram"`,
  the right username, `isActive: true`). Use the real `accountId`.
- Inspect an existing IG post for the payload shape:
  `node scripts/zernio.mjs get "/posts?platform=instagram&limit=3"`.
- Before any real post, `node scripts/zernio.mjs post ... --dry-run` and confirm the body matches:
  `platforms[0].platformSpecificData = { contentType: "reels", trialParams: { graduationStrategy:
  "SS_PERFORMANCE" } }`.
- After the FIRST real trial reel, fetch it back (`get /posts/<id>`) and confirm `trialParams` +
  `contentType` landed BEFORE scheduling the rest.

## 2. Pull the performance data
- The **ledger** (`state/ledger.json`, `{ posts: [...] }`) is the candidate universe — every TikTok
  post you made, with `raw`, `edited_file`, `edit` (hook), `zernio_post_id`, `tiktok_url`. We can
  only repost clips that have an `edited_file` master.
- `node scripts/zernio.mjs analytics --query "platform=tiktok&limit=50&page=N"` — response is
  `{ overview, posts, pagination, accounts }`. **Paginate over all `pagination.pages`** to cover
  the whole backlog.
- **Join key**: ledger `zernio_post_id` === analytics post `latePostId` (verify this against your
  data — fetch a sample and confirm). Fallback: ledger `tiktok_url` video id ===
  `platforms[].platformPostId`. Metric: `views` (primary), then `engagementRate` / `shares` /
  `comments` / `likes`.

## 3. Rank & select (up to 3, backlog drain)
1. Join each ledger TikTok post to its analytics row → attach `views`.
2. **Dedup by `raw`**: group all account variants of the same raw clip; keep only the highest-views
   variant (we want 3 distinct pieces of content, not 3 edits of one).
3. **Exclude** any `raw` already in `state/ig-trial-ledger.json`.
4. Rank the deduped set by `views` (tiebreak `engagementRate`, then `shares`) — an ALL-TIME backlog
   drain, best-first.
5. Walk best-first, apply the on-brand QC gate (step 4), keep the first **up to 3** that PASS. Fewer
   pass → post fewer and say so.

## 4. On-brand QC per candidate (strict — main account)
A clip must clear ALL of these or it's skipped:
- **Has a repostable master.** Skip if the ledger entry has no `edited_file`.
- **Has a real, on-brand hook.** Skip if the ledger `edit` shows no custom hook (e.g. "no new text",
  "as-is").
- **House-style compliant.** Lint the hook text against `knowledge/editing.md` (case, banned words,
  punctuation, ≤1 emoji).
- **Looks right.** `node scripts/dropbox.mjs share "<edited_file>"` (permanent URL), then download +
  `analyze-video.mjs` and view a frame: hook present, placed/styled correctly, legible.
- **Reel media spec** (ffprobe): **1080×1920, H.264, duration 3-90s.** Skip clips >90s (Instagram
  Reels hard limit).

## 5. Caption — main voice (fresh, not the TikTok caption)
- Write a NEW caption in the main account's voice (`accounts.yaml`). End on a reply-driving beat.
- No view-count / "fan favorite" meta captions — that's off-brand for the main account.
- 3-5 niche hashtags. The on-brand hook is already baked into the video.

## 6. Post the trial reel
- Stagger the up-to-3 across IG-appropriate slots. Use the PERMANENT share URL (Zernio fetches media
  at publish time, not at creation):
```
node scripts/zernio.mjs post --platform instagram --account-id <ig_main_id> \
  --caption "..." --video-url "<permanent dl.dropboxusercontent URL>" \
  --trial-reel --graduation SS_PERFORMANCE --schedule <ISO local> --tz <tz>
```

## 7. Ledger + cleanup + commit
- Append each reposted clip to `state/ig-trial-ledger.json`: `{ date, raw, source_account,
  source_tiktok_post_id, source_views, edited_file, ig_video_url, ig_zernio_post_id, caption,
  graduationStrategy, scheduled, status }`.
- Delete any local QC files (`rm work/ig-*.mp4` + frames).
- **Commit state** (cloud MUST, even on partial failure): `git add state/ && git commit -m
  "ig-trial: $(date +%F) run" && git push`.

## 8. Run report
- Reels posted (source clip + raw + source views + scheduled slot + graduationStrategy).
- Candidates skipped and why (already promoted / no hook / >90s / off-brand).
- Backlog depth left — flag when supply is thin so you don't reach for weak clips to hit 3.

## Failure handling
- Zernio post fails → retry once; if still failing, record the candidate as `status: "failed"` so
  tomorrow retries it, and surface the error.
- Always use a permanent `share` link; Zernio fetches the video at PUBLISH time.
