#!/usr/bin/env node
// Understand a video before editing it.
// Extracts: ffprobe metadata, a contact sheet + individual frames (for the agent to LOOK at),
// and audio loudness stats. Writes everything to work/<basename>/.
//
// Usage: node scripts/analyze-video.mjs <video> [--frames 12]

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { ROOT, die, arg, out } from "./lib.mjs";

const input = process.argv[2];
if (!input || input.startsWith("--")) die("usage: analyze-video.mjs <video> [--frames 12]");
const nFrames = parseInt(arg("frames", "12"), 10);

const name = basename(input).replace(/\.[^.]+$/, "");
const dir = join(ROOT, "work", name);
const framesDir = join(dir, "frames");
mkdirSync(framesDir, { recursive: true });

// --- metadata ---
const probe = JSON.parse(
  execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", input], { encoding: "utf8" })
);
const v = probe.streams.find((s) => s.codec_type === "video") || {};
const a = probe.streams.find((s) => s.codec_type === "audio");
const duration = parseFloat(probe.format.duration);
const [num, den] = (v.r_frame_rate || "0/1").split("/").map(Number);
const summary = {
  file: input,
  duration_s: +duration.toFixed(2),
  width: v.width,
  height: v.height,
  vertical: v.width < v.height,
  fps: den ? +(num / den).toFixed(2) : null,
  video_codec: v.codec_name,
  has_audio: !!a,
  audio_codec: a?.codec_name ?? null,
  size_mb: +(probe.format.size / 1e6).toFixed(1),
};

// --- frames: contact sheet + individual stills at even intervals ---
const interval = duration / nFrames;
const cols = 4;
const rows = Math.ceil(nFrames / cols);
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error", "-i", input,
  "-vf", `fps=1/${interval},scale=320:-2,tile=${cols}x${rows}`,
  "-frames:v", "1", join(dir, "contact-sheet.jpg"),
]);
for (let i = 0; i < nFrames; i++) {
  const t = (i + 0.5) * interval;
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-ss", t.toFixed(2), "-i", input,
    "-frames:v", "1", "-vf", "scale=540:-2", join(framesDir, `t${t.toFixed(1)}s.jpg`),
  ]);
}

// --- audio loudness (volumedetect logs to stderr) ---
let loudness = null;
if (a) {
  const stderr = execFileSync("sh", ["-c", `ffmpeg -i ${JSON.stringify(input)} -af volumedetect -f null - 2>&1 || true`], { encoding: "utf8" });
  const mean = stderr.match(/mean_volume: ([-\d.]+) dB/);
  const max = stderr.match(/max_volume: ([-\d.]+) dB/);
  loudness = { mean_db: mean ? +mean[1] : null, max_db: max ? +max[1] : null };
}
summary.loudness = loudness;

// --- transcription (listen, don't just look) ---
// Needs whisper-cli (whisper.cpp) + models/ggml-small.en.bin. Transcribes at WORD level
// (-ml 1 -sow → one word per segment with real timestamps), then produces two artifacts:
//   cues.json           → short ~3-word phrase chunks for REACTIVE subtitles that update
//                         constantly (the proven retention style; feed straight to --subtitles)
//   cues-sentences.json → sentence-level cues + the readable transcript, for the agent's
//                         trim/hook decisions (pick sentence boundaries, the strongest line)
const model = process.env.WHISPER_MODEL || join(ROOT, "models", "ggml-small.en.bin");
const whisperBin = process.env.WHISPER_BIN || "whisper-cli";
const wordsPerCue = parseInt(arg("caption-words", "3"), 10); // chunk size for reactive subtitles
let whisper = null;
try { execFileSync("which", [whisperBin]); whisper = whisperBin; } catch {}
if (a && whisper && existsSync(model)) {
  const wav = join(dir, "audio16k.wav");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", input, "-ar", "16000", "-ac", "1", wav]);
  // -ml 1 -sow: max segment length 1 + split-on-word → per-word segments with start/end offsets
  execFileSync(whisper, ["-m", model, "-f", wav, "-oj", "-of", join(dir, "transcript"), "-ml", "1", "-sow", "-np"], { stdio: "ignore" });
  const tj = JSON.parse(readFileSync(join(dir, "transcript.json"), "utf8"));
  const words = (tj.transcription || [])
    .map((s) => ({ text: s.text.trim(), from: s.offsets.from / 1000, to: s.offsets.to / 1000 }))
    .filter((w) => w.text && !/^\[.*\]$/.test(w.text)); // drop empties and [MUSIC]-style markers
  const join_ = (g) => g.map((w) => w.text).join(" ").replace(/\s+([,.!?])/g, "$1");
  const sentenceEnd = (t) => /[.!?]$/.test(t);

  // Reactive phrase cues: break on N words, a speech pause >0.5s, or sentence-ending punctuation.
  const phrases = [];
  let cur = [];
  for (const w of words) {
    const gap = cur.length ? w.from - cur[cur.length - 1].to : 0;
    if (cur.length && (cur.length >= wordsPerCue || gap > 0.5)) { phrases.push(cur); cur = []; }
    cur.push(w);
    if (sentenceEnd(w.text)) { phrases.push(cur); cur = []; }
  }
  if (cur.length) phrases.push(cur);
  const cues = phrases.map((g) => ({ text: join_(g), startSec: +g[0].from.toFixed(2), _lastTo: g[g.length - 1].to }));
  // Hold each cue until the next starts (no flicker between chunks), capped 0.8s past the last word.
  cues.forEach((c, i) => {
    const next = cues[i + 1];
    const end = next ? Math.min(next.startSec, c._lastTo + 0.8) : c._lastTo;
    c.endSec = +Math.max(end, c.startSec + 0.2).toFixed(2);
    delete c._lastTo;
  });
  writeFileSync(join(dir, "cues.json"), JSON.stringify(cues, null, 1));

  // Sentence-level cues for the readable transcript + trim decisions (break on punctuation or >0.8s gap).
  const sentences = [];
  let sent = [];
  for (const w of words) {
    const gap = sent.length ? w.from - sent[sent.length - 1].to : 0;
    if (sent.length && gap > 0.8) { sentences.push(sent); sent = []; }
    sent.push(w);
    if (sentenceEnd(w.text)) { sentences.push(sent); sent = []; }
  }
  if (sent.length) sentences.push(sent);
  const sentenceCues = sentences.map((g) => ({ text: join_(g), startSec: +g[0].from.toFixed(2), endSec: +g[g.length - 1].to.toFixed(2) }));
  writeFileSync(join(dir, "cues-sentences.json"), JSON.stringify(sentenceCues, null, 1));

  summary.transcript = sentenceCues.map((c) => `[${c.startSec}s] ${c.text}`).join("\n");
  summary.cues_file = join(dir, "cues.json");                       // reactive phrase cues → --subtitles
  summary.cues_sentences_file = join(dir, "cues-sentences.json");   // sentence cues → trim/hook decisions
} else if (a) {
  summary.transcript = null; // whisper-cli or model missing — agent must note it can't hear this clip
}

writeFileSync(join(dir, "summary.json"), JSON.stringify(summary, null, 2));
out({ ...summary, frames_dir: framesDir, contact_sheet: join(dir, "contact-sheet.jpg") });
