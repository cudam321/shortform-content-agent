# Editing Playbook

The edit philosophy: **captions, hooks, music. Nothing fancy. No slop.** Restraint executed
precisely. This file is a living doc — the weekly-review skill should evolve it as real data
comes in.

## Understand before you cut (mandatory)
Run `node scripts/analyze-video.mjs <file>` and actually look at the frame strip in
`work/<name>/frames/`. Establish:
1. **What is this?** Who's in frame, where, what happens.
2. **The peak moment** — the payoff, the reaction, the visual hit. Note its timestamp.
3. **The best first frame** — the single most arresting 0.5s in the clip.
4. **The audio — listen, don't just look.** `analyze-video` transcribes speech (whisper) and
   writes a timed transcript. Pick trim points at sentence boundaries, open on the strongest
   line, end on a button line. Is the original audio an asset (crowd, voice, payoff) or dead weight?
5. **Orientation & quality** — resolution, vertical/horizontal, shake, exposure. Horizontal
   footage gets center-cropped to 9:16 by the renderer; confirm the subject survives the crop.

## Edit decisions per clip
- **Trim — preserve context, cut only dead weight.** Trim out false starts, rambling lead-ins,
  and dead tails — NOT to hit a length target. The kept window must stand on its own: a viewer
  with zero setup understands it. Cut only at clean sentence/visual boundaries, never mid-idea.
  - *Spectacle/moment clips* (no dialogue to follow): start at or 1-2s before the peak, ~7-20s,
    end on a frame that loops back into the start when possible.
  - *Talking/story clips*: keep the **COMPLETE unit of meaning** — the full setup -> payoff. Open
    a beat BEFORE the strongest line; end a beat AFTER the thought resolves. **No length cap** — a
    coherent 40s clip beats a chopped 15s one that loses context. When unsure, trim less.
- **Hook overlay**: in the account's voice (`accounts.yaml`), horizontally centered, persists the
  whole clip by default (set an early `--hook-end` only when the text fights the footage). **Text
  design IS content.** Spectacle/short hooks: <=4-8 words. POV/diary hooks: 2-4 balanced lines —
  read it out loud, fix awkward breaks. **lowercase by default; ALL CAPS only for news.** Placement:
  top third (default) or `--hook-position center` for short reveals; never glued to the edge.
- **Music**: only from `assets/music/`, only when original audio is weak, mixed under (original
  audio ducked, not killed, unless it's garbage).
- **Spoken captions (mandatory for talking clips)**: fed from `work/<name>/cues.json`
  (analyze-video output, time-shifted to the trim -> `--subtitles`). **These are REACTIVE captions —
  short ~3-word phrases that update constantly, NOT whole sentences.** A constantly-changing caption
  holds the viewer; a static multi-line block reads as a wall of text. analyze-video generates
  `cues.json` this way automatically. Use `cues-sentences.json` (or `summary.transcript`) to choose
  trims and the hook. A talking clip without captions is a QC failure. If transcription failed, fix
  that first — never guess captions.
  - Tune chunk size if needed: `analyze-video.mjs <clip> --caption-words N` (default 3).

## Safe zones (1080x1920, vertical platforms)
- Top ~200px: avoid (status bar / platform tabs).
- Bottom ~480px: avoid (caption, sound, username UI).
- Right ~130px: avoid (like/comment/share rail).
- Hook text lives in the band ~220-600px (top position) or dead center. The presets respect this.

## Text styling presets
All on-screen text uses one of the presets in `remotion/EditVideo.tsx` (restyle them once to set
your house look, then stay consistent):

| element | preset/flag | rule |
|---|---|---|
| hook | `--preset plain` (default) | bold, white, black outline, top third (or `--hook-position center`), lowercase default / CAPS for news |
| hook (bright/busy vertical clip) | `--preset box` | same white text + outline on a semi-transparent black rounded box; use sparingly |
| hook (bright/horizontal/blurred-bg clip) | `--preset pill` | black text on a white rounded pill, no outline |
| context caption | `--caption "..."` | bold, yellow #f4c70f, black outline, bottom third |

Pick a font once (see `remotion/public/fonts/README.md`) and don't invent new text styles per post.
If text isn't legible, move it (or step `plain` -> `box` -> `pill`) — don't restyle it.

## QC gate (must pass before posting)
1. Re-run frame extraction on the **rendered** file; look at the frames.
2. Text fully inside safe zones, legible at small size, on the right preset/color/placement.
   Centering is MEASURED, not eyeballed.
3. First frame is strong (not black, not mid-blur).
4. Audio: no clipping; music mix doesn't bury a vocal/payoff (check the loudness numbers).
5. Output is 1080x1920, ~30fps, h264, plays start to finish (ffprobe duration matches intent).
6. **Context check (talking/story clips):** does it make sense to someone who never saw the raw?
   No cold open mid-sentence, no cut before the point lands. If a stranger couldn't follow it,
   re-trim wider — this is the single most common trim failure.
7. Ask: "would this pass as a human-made post from this account?" If it feels like slop, re-edit
   or swap footage. Quality > quota.

## Variant matrix (one source clip -> up to one variant per account)
- Before editing, list prior variants of this source from the ledger (trim, hook, music used).
- A new variant must differ in at least 3 of {trim window/segment, hook text + angle, captions
  emphasis, music, speed/crop/framing} — and ALWAYS in hook + account voice.
- A variant must read as a different post a viewer could enjoy independently — not a recolor.
- Stagger: variants of the same source never go out at the same time slot across accounts.
