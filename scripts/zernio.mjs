#!/usr/bin/env node
// Zernio API gateway client. Docs: https://docs.zernio.com/llms-full.txt
//
// Usage:
//   node scripts/zernio.mjs accounts
//   node scripts/zernio.mjs post --account-id <id> --caption "text" --video-url <url> \
//        [--platform tiktok|instagram|youtube] [--schedule 2026-06-12T21:00:00 --tz UTC] \
//        (schedule timezone defaults to $TIMEZONE or UTC; pass --tz to override) \
//        [--privacy PUBLIC_TO_EVERYONE]                      (tiktok) \
//        [--trial-reel --graduation SS_PERFORMANCE|MANUAL]   (instagram trial reel) \
//        [--title "..." --visibility public --category 24]   (youtube; --title required, Short auto-detected) \
//        [--dry-run]                                         (print the request body, do NOT post)
//   node scripts/zernio.mjs analytics [--query "platform=tiktok&limit=50"]
//   node scripts/zernio.mjs get /any/path        (generic GET for exploring the API)

import { loadEnv, die, arg, out } from "./lib.mjs";

loadEnv();
const BASE = "https://zernio.com/api/v1";
const KEY = process.env.ZERNIO_API_KEY;
if (!KEY) die("ZERNIO_API_KEY not set (see .env.example)");

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) die(`${method} ${path} -> ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

const cmd = process.argv[2];

if (cmd === "accounts") {
  out(await api("GET", "/accounts"));
} else if (cmd === "post") {
  const accountId = arg("account-id") || die("--account-id required");
  const caption = arg("caption") ?? "";
  const videoUrl = arg("video-url") || die("--video-url required");
  const schedule = arg("schedule");
  const platform = arg("platform", "tiktok");
  const privacy = arg("privacy");
  const trialReel = arg("trial-reel") === true || arg("trial-reel") === "true";
  const graduation = arg("graduation", "SS_PERFORMANCE");
  const dryRun = arg("dry-run") === true || arg("dry-run") === "true";

  // Per-target options live INSIDE the platforms[] entry as platformSpecificData (Zernio docs:
  // every example nests it on the platform entry, NOT at the top level).
  const psd = {};
  if (platform === "tiktok" && privacy) psd.privacy = privacy;
  if (platform === "instagram") {
    psd.contentType = "reels"; // we only ever post Reels to IG
    if (trialReel) psd.trialParams = { graduationStrategy: graduation }; // shown to non-followers first
  }
  if (platform === "youtube") {
    // YouTube requires a title; Shorts are auto-detected from <=3min + 9:16 (no flag). content = description.
    psd.title = arg("title") || die("--title required for youtube");
    psd.visibility = arg("visibility", "public"); // public | unlisted | private
    psd.madeForKids = false;
    const category = arg("category");
    if (category) psd.categoryId = category;
  }
  const target = { platform, accountId };
  if (Object.keys(psd).length) target.platformSpecificData = psd;

  const body = {
    content: caption,
    platforms: [target],
    mediaItems: [{ type: "video", url: videoUrl }],
    ...(schedule
      ? { scheduledFor: schedule, timezone: arg("tz", process.env.TIMEZONE || "UTC") }
      : { publishNow: true }),
  };
  if (dryRun) out({ dryRun: true, request: { method: "POST", path: "/posts", body } });
  else out(await api("POST", "/posts", body));
} else if (cmd === "analytics") {
  const q = arg("query");
  out(await api("GET", `/analytics${q ? `?${q}` : ""}`));
} else if (cmd === "get") {
  const path = process.argv[3] || die("path required, e.g. get /posts");
  out(await api("GET", path));
} else if (cmd === "patch" || cmd === "put" || cmd === "delete") {
  // generic verbs for posts_update / posts_delete etc.
  const path = process.argv[3] || die(`usage: ${cmd} /path ['{"json":"body"}']`);
  const body = process.argv[4] ? JSON.parse(process.argv[4]) : undefined;
  out(await api(cmd.toUpperCase(), path, body));
} else {
  die("unknown command. Use: accounts | post | analytics | get | patch | put | delete");
}
