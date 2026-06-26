# Short-Form Marketing Playbook

Operating principles for short-form video. The weekly-review skill should evolve this file as real
data comes in — cross out what your numbers disprove. These are starting defaults, not laws.

## How short-form algorithms actually distribute
- They optimize **watch time and rewatch** first, then shares/comments/follows. Every decision
  serves retention.
- The first **0.5-1.5 seconds** decide everything. The hook is not just the text — it's the
  *frame + motion + text + sound* combined. Open on the most arresting moment you have, never on
  a buildup.
- Completion rate on short clips beats average watch time on long ones — but **only cut where
  there's nothing to lose.** Spectacle/moment clips: keep tight (~7-20s). Talking/story clips:
  **context beats brevity** — the trim must contain the COMPLETE thought (setup AND payoff). No
  hard length cap; a coherent 40s clip beats a punchy 15s one that makes no sense.
- Loops win: if the last frame cuts cleanly back to the first, you harvest rewatches.
- Native-feel beats produced-feel. Raw footage with one confident text overlay usually outperforms
  a heavily "branded edit." Anti-slop mostly means *restraint*.

## Hooks
- A hook makes one of four promises: **curiosity**, **status/identification** ("POV: you..."),
  **emotion**, or **spectacle** (no text needed — the footage IS the hook).
- Never just describe the video — add tension or context the footage can't show.
- One hook per video. Spectacle/short hooks <= 8 words; POV/diary hooks can run 2-4 lines when the
  line lands and the trim earns it. If a hook needs two sentences of *setup*, it's the wrong clip.
- **Specificity > generality.** Anchor every hook to a specific time, place, or moment.
- Keep a bank of hook patterns and reframe to the moment — never recycle the exact same template
  back-to-back across the network or days.

## Captions (the text box, not the overlay)
- The caption's job is **comments**, not information. Questions, hot takes, and unfinished thoughts
  drive replies; replies drive distribution. End on a genuine question or contestable take.
- But remember the binding constraint at small scale is usually **reach, not caption wording** —
  spend optimization energy on posting window, footage quality, and volume headroom before you
  A/B caption phrasing.
- 3-5 hashtags max, specific over broad. Hashtags are mild metadata, not magic.
- Per-account voice is law — see `accounts/accounts.yaml`.

## Sound
- Audio baked into the file is what ships (API posting can't attach native platform sounds), so
  **original audio is often your biggest asset** — crowd, voice, the real moment. Prefer it.
- When adding a music bed, use tracks from `assets/music/` only (cleared by you). Never rip
  trending copyrighted audio into a render — that risks mute/takedown on an API-posted video.

## Cadence & timing
- **On small accounts, volume and per-post reach are often INVERSELY related.** Flooding an
  account can flatten its distribution — the algorithm hands each post a similar small test
  audience and stops pushing winners. Do not raise `posts_per_day` to chase the target until
  reach holds steady at the current volume. When in doubt, post fewer/better, not more.
- 1+ post per account per day, staggered (see `posting_window` per account) so accounts don't
  dogpile the same hour.
- Post when your audience's active window starts.
- Series > one-offs: "week N of 12", "city N of 13" formats train return viewers.

## The network effect (multiple accounts)
- The accounts are **different shows on one network**, not copies. Same universe, different lanes.
- Never post identical edits across accounts (platforms may suppress duplicated content, and it
  reads as botting). Different source, or visibly different edit + different caption, always.

## Self-assessment metrics (weekly review)
Rank posts within each account by: completion proxy (views vs 3s views if available), then shares,
then comments, then likes. Diagnose per layer:
- Low views overall -> hook/first-frame problem or posting time.
- Views but no shares/comments -> content fine, caption gave nothing to react to.
- High follows per view -> lane is working; make more of exactly that.
Write conclusions to `state/learnings.md` as testable rules, not vibes.
