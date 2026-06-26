#!/usr/bin/env node
// Vault intake — mechanical phase. For every video in the vault root not yet in the
// catalog: download → ffprobe → one labeled frame → whisper transcript → DELETE local
// file immediately (only one clip on disk at a time). Emits work/intake/records.jsonl;
// the agent then classifies/ranks and applies renames via dropbox.mjs.
//
// Usage: node scripts/intake.mjs [--limit N]

import { execFileSync, execSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ROOT, arg, loadEnv, out } from "./lib.mjs";

loadEnv();
const limit = parseInt(arg("limit", "999"), 10);
const dir = join(ROOT, "work", "intake");
mkdirSync(join(dir, "frames"), { recursive: true });

const recordsFile = join(dir, "records.jsonl");
const done = new Set();
if (existsSync(recordsFile))
  for (const l of readFileSync(recordsFile, "utf8").split("\n"))
    if (l.trim()) done.add(JSON.parse(l).path);

// catalog'd files are also done
const catalogFile = join(ROOT, "state", "vault-catalog.json");
if (existsSync(catalogFile))
  for (const e of JSON.parse(readFileSync(catalogFile, "utf8")).clips ?? []) done.add(e.path);

const list = JSON.parse(execFileSync("node", [join(ROOT, "scripts/dropbox.mjs"), "list"], { encoding: "utf8" }));
const files = list.filter((e) => e.path && /\.(mp4|mov|m4v)$/i.test(e.path) && !done.has(e.path)).slice(0, limit);
console.error(`${files.length} clips to intake`);

const model = join(ROOT, "models", "ggml-small.en.bin");
let idx = done.size;
for (const f of files) {
  const tmp = join(dir, "tmp.mp4");
  const wav = join(dir, "tmp.wav");
  const rec = { idx, path: f.path, size_mb: f.size_mb };
  try {
    execFileSync("node", [join(ROOT, "scripts/dropbox.mjs"), "download", f.path, tmp], { stdio: "ignore" });
    const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", tmp], { encoding: "utf8" }));
    const v = probe.streams.find((s) => s.codec_type === "video") || {};
    rec.duration_s = +parseFloat(probe.format.duration).toFixed(1);
    rec.w = v.width; rec.h = v.height; rec.vertical = v.width < v.height;
    const t = Math.max(0.5, rec.duration_s * 0.4);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(t), "-i", tmp, "-frames:v", "1", "-vf", "scale=320:-2", join(dir, "frames", `${idx}.jpg`)]);
    // transcribe first 120s max
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-t", "120", "-ar", "16000", "-ac", "1", wav]);
    execFileSync("whisper-cli", ["-m", model, "-f", wav, "-oj", "-of", join(dir, "tmp"), "-np"], { stdio: "ignore" });
    const tj = JSON.parse(readFileSync(join(dir, "tmp.json"), "utf8"));
    rec.transcript = (tj.transcription || []).map((s) => s.text.trim()).filter(Boolean).join(" ").slice(0, 900);
  } catch (e) {
    rec.error = String(e).slice(0, 200);
  } finally {
    rmSync(tmp, { force: true }); rmSync(wav, { force: true }); rmSync(join(dir, "tmp.json"), { force: true });
  }
  appendFileSync(recordsFile, JSON.stringify(rec) + "\n");
  console.error(`[${idx}] ${f.path.split("/").pop().slice(0, 60)} ${rec.duration_s ?? "ERR"}s`);
  idx++;
}
out(`intake complete: ${files.length} processed -> ${recordsFile}`);
