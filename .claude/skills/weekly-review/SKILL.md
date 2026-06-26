---
name: weekly-review
description: Weekly self-assessment — pull analytics from Zernio for the last 7 days, diagnose what worked per account, write learnings, and evolve account styles and playbooks. Use when asked to "review the week", "check analytics", or on the weekly schedule.
---

# Weekly Review — Self-Assessment & Evolution

The agent gets better only through this loop. Be honest; the numbers outrank your taste.

## 1. Gather
- Read `state/ledger.json` for the last 7 days of posts.
- Pull analytics: `node scripts/zernio.mjs analytics` (explore available params with
  `node scripts/zernio.mjs get /analytics` variants; per-post metrics by post id where supported).
- Build a table per account: post → views, likes, comments, shares, watch/completion if available.

## 2. Diagnose (per account)
Use the metric ladder in `knowledge/marketing.md`:
- Best and worst post — what differed? (hook wording, first frame, length, music vs original audio,
  posting time, clip subject)
- Low views → hook/first-frame/timing problem. Engagement without reach growth → caption not driving
  comments. Strong follows-per-view → double down on that lane.
- Compare across accounts: is one lane structurally outperforming? Is any account drifting out of
  its voice?

## 3. Evolve (write it down — this is the self-improvement)
- **`state/learnings.md`**: append dated, testable rules ("hooks under 5 words outperform on
  highlights", "01:00 posts die — try 22:00"). Cross out prior rules the new data disproves.
- **`accounts/accounts.yaml`**: update `hook_style` / `caption_style` / `music` / `posting_window`
  where evidence is strong (2+ posts pointing the same way). Note the change + reason in learnings.md.
- **`knowledge/marketing.md` / `knowledge/editing.md`**: amend when a principle is confirmed or
  broken by real data.
- If a preset consistently underperforms, propose a concrete tweak to `remotion/EditVideo.tsx`
  (font size, position, scrim) and make it.

## 4. Report
Short summary for the human: per-account trend (up/flat/down), top post of the week and why, the 2-3
changes made for next week, and anything needing human input (footage gaps, music library needs,
account issues).

## 5. Commit
`git add state/ accounts/ knowledge/ && git commit -m "weekly review: $(date +%F)" && git push`
(cloud runs MUST commit or the learnings are lost).
