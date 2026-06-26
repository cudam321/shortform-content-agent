---
name: daily-post
description: Daily content run — pick raw videos from the Dropbox vault, edit one distinct variation per account, QC, and post/schedule via Zernio. Use when asked to "run the daily posts", "post today's content", or on the daily schedule.
---

# Daily Post Run

Produce and schedule `defaults.posts_per_day` posts per account (see `accounts/accounts.yaml`;
ramping toward `posts_per_day_target`). Quality over quota — if footage can't support the volume,
post fewer and say so. See CLAUDE.md hard rules.

## 0. Sync state
- Local: `git pull` first. Cloud (routine): the fresh clone is current; run `npm ci` if
  node_modules is missing. ffmpeg/whisper-cli/`$WHISPER_MODEL` come from the environment setup; if
  absent, report it — don't rebuild mid-run.

## 1. Load state
- Read `context/context.md`, `accounts/accounts.yaml`, `knowledge/editing.md`,
  `knowledge/marketing.md`, `state/learnings.md`, `state/ledger.json`.
- Note today's date and anything special (recurring events from context.md → lean into them).

## 1b. First run only: verify the Zernio API — don't assume
If `accounts.yaml` has empty `zernio_account_id` fields, or this is the first post ever:
- `node scripts/zernio.mjs accounts` and inspect the RAW response. Confirm actual field names
  (id vs accountId vs platformAccountId, etc.) before using them.
- Map each real account/handle to a lane in `accounts.yaml` and fill in the ids.
- Before the first real post, verify the payload shape: check `node scripts/zernio.mjs get /posts`
  for existing posts' structure; if anything differs from what `scripts/zernio.mjs post` sends, fix
  the script first. You can also preview any post with `--dry-run` (prints the body, posts nothing).
- After the first post, fetch it back (`get /posts/...`) to confirm it landed before doing the rest.

## 2. Scan the vault — catalog first, recency first
- `node scripts/dropbox.mjs list` — only the configured vault folder is in scope; the rest of the
  Dropbox is off-limits.
- **Any file not in `state/vault-catalog.json` gets intaken first** — run `node scripts/intake.mjs`,
  then classify (subject via frames, content via transcript), rename, score, catalog. Never edit an
  uncataloged clip. Junk → a `rejected/` folder.
- **Inbox (root) first, newest `modified` first** — root clips are new/un-posted by definition. Only
  when the inbox can't cover all accounts, fall back to `used/` for variation re-edits (fewest ledger
  uses + best past performance first). Vault empty → report and ask the human.
- Cross-check the ledger for per-account usage of each raw (one variant per account per raw, max).

## 2b. Build the day plan (accounts × slots)
- Slots = `defaults.posting_slots` + each account's `slot_offset_minutes`, count = `posts_per_day`.
- Assign a (raw clip or long-clip segment) × account pair to each slot. Constraints: an account never
  gets a raw it already posted (ledger); variants of the same raw go to DIFFERENT slots (never
  simultaneous); long clips (>60s) yield multiple non-overlapping segments — each can serve each
  account once.
- Write the plan first (account, slot, raw, segment, hook angle), THEN execute. If supply runs short,
  fill the most important slots first (each account's `posting_window` is its prime slot) and report
  the shortfall.

## 3. Per planned post (loop over the day plan)
1. **Match clip to lane.** Use each account's `lane` in `accounts.yaml`. Don't force a clip into the
   wrong lane.
2. **Download & understand.** `node scripts/dropbox.mjs download <path> work/<name>.mp4`, then
   `node scripts/analyze-video.mjs work/<name>.mp4`. **Read the contact sheet and frames with your
   own eyes.** Identify the peak moment, best first frame, and audio quality before deciding anything.
3. **Design the edit** in the account's voice (editing.md). **Trim to remove only dead weight,
   preserving full context**: talking/story clips keep the COMPLETE thought (no length cap); spectacle
   clips stay tight (~7-20s, open on the peak). Cut only at clean boundaries. Then: hook text in the
   account's voice, **lowercase by default / ALL CAPS for news**. Preset per the decision guide
   (`plain`, `box` for bright/busy vertical, `pill` for horizontal/blurred), placement top third or
   `--hook-position center` for short reveals, **reactive spoken captions for every talking clip** —
   `cues.json` is already short ~3-word phrase chunks; shift it to the trim window → `--subtitles`.
   Use `cues-sentences.json` only to choose the trim. Music: original audio first; low bed from
   `assets/music/` under talking clips only.
4. **Render.** `node scripts/render.mjs --input ... --output work/<account>-<date>.mp4 --preset
   <plain|box|pill> --hook "..." [--hook-position center] [--subtitles cues.json] [--caption "..."]
   --trim-start ... --trim-end ...` (+ music flags if used).
5. **QC gate** (editing.md): re-run `analyze-video.mjs` on the render, look at the frames, check safe
   zones / first frame / audio / duration, then the hook check. Fail → fix or swap clip. Do not post
   slop.
6. **Write the caption** in account voice + 3-5 niche hashtags. Caption's job is comments.
7. **Publish.** Upload: `node scripts/dropbox.mjs upload work/<file> $DROPBOX_EDITED_FOLDER/<file>`,
   get a PERMANENT URL: `node scripts/dropbox.mjs share <dropboxPath>` (temp `link` URLs die in ~4h,
   which kills posts scheduled further out). If `share` fails (missing sharing scope), fall back to
   `link` but then schedule that post within 3h and note the constraint. Then:
   `node scripts/zernio.mjs post --account-id <id> --caption "..." --video-url "<url>" --schedule
   <ISO local> --tz <tz>`.
8. **Ledger + cleanup, immediately.** Append to `state/ledger.json`: date, account key, raw source +
   segment, edit summary (trim/hook/preset/music), caption, zernio post id/response, scheduled time.
   Then DELETE the local render (the master is in Dropbox `edited/`). Move the raw to `used/` only
   when the ledger shows every account has posted its variant.

## 4. Wrap up
- Confirm ledger entries match the day plan (or document exactly why fewer — and what footage is
  needed).
- Clean ALL local video files now (`rm -rf work/raw work/out/*.mp4` and extracted frames). Local
  disk holds NO video between runs — Dropbox `edited/` is the archive. Keep only the tiny text
  artifacts (`summary.json`, `cues.json`, transcripts) for the weekly review. NEVER touch anything
  outside the project's `work/` directory.
- Run report: (1) vault intake header — "N new clips cataloged" + a ranked list of top new arrivals;
  (2) posts created per account (clip, hook, scheduled time); (3) skips/failures and why; vault
  supply outlook (days of fresh material left at current volume).
- **Commit state**: `git add state/ tasks/ accounts/ && git commit -m "state: daily run $(date +%F)"
  && git push` (cloud runs MUST do this or the ledger is lost with the sandbox).

## Failure handling
- Zernio post fails → retry once; if still failing, save the render + caption in the ledger as
  `status: "failed"` so tomorrow's run can retry, and surface the error in the report.
- Media URLs must outlive the schedule: Zernio fetches the video at PUBLISH time, not at creation.
  Use permanent `share` links; temp `link` only for <3h horizons.
