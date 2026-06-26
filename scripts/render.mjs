#!/usr/bin/env node
// Render a styled edit: hook overlay + optional music bed + optional subtitles, 1080x1920 h264.
//
// Text styling presets (defined in remotion/EditVideo.tsx — restyle them to taste):
//   plain (white hook w/ black outline) | box (white hook on a semi-transparent black box, for
//          bright/busy vertical clips) | pill (black on white pill, for bright/horizontal clips)
// Hook placement: --hook-position top (default) | center (short 2-3 word reveals)
//
// Usage:
//   node scripts/render.mjs --input work/raw.mp4 --output work/edit.mp4 [--preset plain] \
//     --hook "pov it's 6am..." [--hook-position top] [--hook-start 0] [--hook-end 3.5] \
//     [--caption "week 5 of 12." --caption-start 0 --caption-end 5] \
//     [--trim-start 4.2] [--trim-end 18] \
//     [--music assets/music/track.mp3] [--music-volume 0.35] [--video-volume 1] \
//     [--subtitles cues.json]    (JSON array of {text, startSec, endSec})

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { ROOT, die, arg, out } from "./lib.mjs";

const input = arg("input") || die("--input required");
const output = resolve(arg("output") || die("--output required"));
const preset = arg("preset", "plain");
if (!existsSync(input)) die(`input not found: ${input}`);

const id = `tmp-${Date.now().toString(36)}`;
const pub = join(ROOT, "remotion", "public", id);
mkdirSync(pub, { recursive: true });

try {
  // Remotion's Chromium can't decode HEVC — transcode iPhone/H.265 sources to h264 first
  const codec = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "csv=p=0", input], { encoding: "utf8" }).trim();
  const videoFile = `${id}/input.mp4`;
  const dest = join(ROOT, "remotion", "public", videoFile);
  if (codec === "hevc" || codec === "h265") {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", input, "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "copy", dest]);
  } else {
    cpSync(input, dest);
  }

  let music = null;
  const musicPath = arg("music");
  if (musicPath) {
    if (!existsSync(musicPath)) die(`music not found: ${musicPath}`);
    const musicFile = `${id}/music${extname(musicPath)}`;
    cpSync(musicPath, join(ROOT, "remotion", "public", musicFile));
    music = { file: musicFile, volume: parseFloat(arg("music-volume", "0.35")) };
  }

  const hookText = arg("hook");
  const captionText = arg("caption");
  const subsPath = arg("subtitles");
  const props = {
    videoFile,
    trimStartSec: parseFloat(arg("trim-start", "0")),
    trimEndSec: arg("trim-end") ? parseFloat(arg("trim-end")) : null,
    // endSec null = text persists until the end of the clip (the default for hooks)
    hook: hookText
      ? { text: hookText, startSec: parseFloat(arg("hook-start", "0")), endSec: arg("hook-end") ? parseFloat(arg("hook-end")) : null }
      : null,
    hookPosition: arg("hook-position", "top"), // "top" (top third) | "center" (dead center)
    caption: captionText
      ? { text: captionText, startSec: parseFloat(arg("caption-start", "0")), endSec: arg("caption-end") ? parseFloat(arg("caption-end")) : null }
      : null,
    preset,
    music,
    videoVolume: parseFloat(arg("video-volume", "1")),
    subtitles: subsPath ? JSON.parse(readFileSync(subsPath, "utf8")) : [],
  };

  const propsFile = join(pub, "props.json");
  writeFileSync(propsFile, JSON.stringify(props));

  execFileSync(
    "npx",
    ["remotion", "render", "remotion/index.ts", "EditVideo", output, `--props=${propsFile}`, "--public-dir=remotion/public", "--codec=h264", "--crf=18", "--overwrite"],
    { cwd: ROOT, stdio: "inherit" }
  );
  out(`rendered ${output}`);
} finally {
  rmSync(pub, { recursive: true, force: true });
}
