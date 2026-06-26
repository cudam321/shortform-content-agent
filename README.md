# Short-Form Content Agent

An autonomous agent that runs a network of short-form video accounts: it pulls raw footage from a
Dropbox vault, understands each clip (ffprobe + extracted frames + local whisper transcription),
edits a distinct 1080x1920 variation per account (hook overlay, word-level captions, music — via
[Remotion](https://remotion.dev)), QCs the output, posts through the [Zernio](https://zernio.com)
API to TikTok (and optionally Instagram Reels / YouTube Shorts), and improves itself weekly from
analytics.

## Claude Code is the runtime

There's no server and no daemon. **The agent _is_ [Claude Code](https://claude.com/claude-code)
running in this folder.** The pieces:

- `CLAUDE.md` — the operating manual (hard rules + the pipeline).
- `.claude/skills/*/SKILL.md` — the routines (daily post, weekly review, amplification).
- `scripts/*.mjs` — the tools (Zernio, Dropbox, video analysis, render).
- `remotion/` — the edit composition (hook presets, captions, music mix).
- `accounts/`, `context/`, `knowledge/`, `state/` — config, grounding, playbooks, and memory.

You drive it by asking Claude Code to run a skill (e.g. "run the daily posts"), or by scheduling it.

## Requirements

- **Node.js 18+** (uses the built-in `fetch`).
- **ffmpeg / ffprobe** on `PATH` (video probing, frame extraction, transcoding).
- **[whisper.cpp](https://github.com/ggml-org/whisper.cpp)** (`whisper-cli`) + a model
  (e.g. `ggml-small.en.bin` in `models/`) for transcription. Optional but recommended — talking
  clips need captions. See `cloud-setup.sh` for an automated install.
- A **[Zernio](https://zernio.com) account** with your social accounts connected, and an API key.
- A **Dropbox app** (or access token) for the footage vault.
- Fonts: none are bundled — drop your own into `remotion/public/fonts/` (see its README).

## Setup (one time)

1. `npm install` (Remotion is large; the first install pulls a headless Chromium).
2. `cp .env.example .env` and fill in:
   - `ZERNIO_API_KEY` — from zernio.com/dashboard/api-keys (connect your accounts in Zernio first).
   - Dropbox credentials (refresh token recommended — run `node scripts/dropbox-auth.mjs url`) and
     your vault folder paths (`DROPBOX_RAW_FOLDER` / `DROPBOX_EDITED_FOLDER`).
   - `TIMEZONE` — default IANA timezone for scheduling (e.g. `UTC`, `Europe/London`).
3. `cp accounts/accounts.example.yaml accounts/accounts.yaml` and fill in your accounts.
   Run `npm run accounts` to print each account's `accountId` from Zernio and paste them in.
4. `cp context/context.example.md context/context.md` and describe who/what you're making content for.
5. Create the Dropbox folders (`/vault/raw`, `/vault/edited` by default) and drop raw footage in `raw`.
6. Add cleared music to `assets/music/` (see its README) and your fonts to `remotion/public/fonts/`.

## Running

- **Daily run:** ask Claude Code `run the daily posts` (the `daily-post` skill), or automate it:
  - local cron, e.g.: `0 9 * * * cd /path/to/shortform-content-agent && claude -p "/daily-post" --permission-mode acceptEdits`
  - or use Claude Code's `/schedule` for a cloud routine.
- **Amplification (optional):** `run the IG trial reels` / `run the YT shorts` — repost your best
  TikTok winners to Instagram / YouTube (no re-render).
- **Weekly review:** `review the week` (the `weekly-review` skill) — pulls analytics, writes
  `state/learnings.md`, evolves account styles.

## Layout

| path | what |
|---|---|
| `CLAUDE.md` | agent operating manual + hard rules |
| `context/context.example.md` | grounding template (who/what this is for) |
| `accounts/accounts.example.yaml` | account roster template: lanes, voices, presets, windows |
| `knowledge/` | marketing + editing playbooks (evolved weekly) |
| `scripts/` | zernio, dropbox, analyze-video, intake, render CLIs |
| `remotion/` | the edit composition (hook presets `plain`/`box`/`pill`, captions, music mix) |
| `cloud-setup.sh` | installs ffmpeg + whisper.cpp + the model for a VPS/cloud routine |
| `state/` | persistent memory (ledger, learnings, catalog) — gitignored locally, synced on cloud runs |
| `work/` | scratch space (downloads, frames, renders) — gitignored |

## Manual pipeline example

```bash
node scripts/dropbox.mjs list
node scripts/dropbox.mjs download "/vault/raw/clip.mp4" work/clip.mp4
node scripts/analyze-video.mjs work/clip.mp4          # then LOOK at work/clip/contact-sheet.jpg
node scripts/render.mjs --input work/clip.mp4 --output work/edit.mp4 \
  --hook "the part nobody filmed" --caption "week 5 of 12." --trim-start 12 --trim-end 26 \
  --preset plain --subtitles work/clip/cues.json
node scripts/dropbox.mjs upload work/edit.mp4 "/vault/edited/edit.mp4"
node scripts/dropbox.mjs share "/vault/edited/edit.mp4"
node scripts/zernio.mjs post --account-id <id> --caption "week 5 of 12." \
  --video-url "<link>" --schedule 2026-06-11T21:00:00 --tz UTC
```

## Safety

This tool posts to live social accounts and calls paid/third-party APIs. Use
`node scripts/zernio.mjs post ... --dry-run` to inspect the request body without posting. Keep
`.env`, `accounts/accounts.yaml`, and `state/` out of version control (already gitignored).

## License

MIT — see [LICENSE](LICENSE).
