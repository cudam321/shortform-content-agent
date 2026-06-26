#!/usr/bin/env node
// Dropbox vault client.
//
// Usage:
//   node scripts/dropbox.mjs list [/folder]            (defaults to DROPBOX_RAW_FOLDER)
//   node scripts/dropbox.mjs download <dropboxPath> <localPath>
//   node scripts/dropbox.mjs upload <localPath> <dropboxPath>
//   node scripts/dropbox.mjs link <dropboxPath>        (4h temporary direct URL — feed to Zernio)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadEnv, die, out } from "./lib.mjs";

loadEnv();

async function getToken() {
  if (process.env.DROPBOX_REFRESH_TOKEN) {
    const res = await fetch("https://api.dropbox.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: process.env.DROPBOX_REFRESH_TOKEN,
        client_id: process.env.DROPBOX_APP_KEY,
        client_secret: process.env.DROPBOX_APP_SECRET,
      }),
    });
    const data = await res.json();
    if (!res.ok) die(`token refresh failed: ${JSON.stringify(data)}`);
    return data.access_token;
  }
  if (process.env.DROPBOX_ACCESS_TOKEN) return process.env.DROPBOX_ACCESS_TOKEN;
  die("set DROPBOX_REFRESH_TOKEN (+app key/secret) or DROPBOX_ACCESS_TOKEN");
}

// HTTP headers are ASCII-only: escape non-ASCII (emoji in filenames) as \uXXXX for Dropbox-API-Arg
const headerSafeJson = (obj) =>
  JSON.stringify(obj).replace(/[-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

async function rpc(token, endpoint, body) {
  const res = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) die(`${endpoint}: ${JSON.stringify(data)}`);
  return data;
}

const token = await getToken();
const cmd = process.argv[2];

if (cmd === "list") {
  let path = process.argv[3] || process.env.DROPBOX_RAW_FOLDER || die("no folder given and DROPBOX_RAW_FOLDER unset");
  if (path === "/") path = ""; // Dropbox API wants "" for root
  let data = await rpc(token, "files/list_folder", { path, include_media_info: true });
  let entries = data.entries;
  while (data.has_more) {
    data = await rpc(token, "files/list_folder/continue", { cursor: data.cursor });
    entries = entries.concat(data.entries);
  }
  out(entries.map((e) =>
    e[".tag"] === "folder"
      ? { folder: e.path_display }
      : {
          path: e.path_display,
          size_mb: +(e.size / 1e6).toFixed(1),
          modified: e.server_modified,
          duration_s: e.media_info?.metadata?.duration ? +(e.media_info.metadata.duration / 1000).toFixed(1) : undefined,
        }
  ));
} else if (cmd === "download") {
  const [src, dest] = process.argv.slice(3);
  if (!src || !dest) die("usage: download <dropboxPath> <localPath>");
  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Dropbox-API-Arg": headerSafeJson({ path: src }) },
  });
  if (!res.ok) die(`download: ${await res.text()}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  out(`saved ${dest}`);
} else if (cmd === "upload") {
  const [src, dest] = process.argv.slice(3);
  if (!src || !dest) die("usage: upload <localPath> <dropboxPath>");
  const buf = readFileSync(src);
  const CHUNK = 8 * 1024 * 1024;
  const content = async (endpoint, argHeader, body) => {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await fetch(`https://content.dropboxapi.com/2/files/${endpoint}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Dropbox-API-Arg": headerSafeJson(argHeader), "Content-Type": "application/octet-stream" },
          body,
        });
        const text = await res.text();
        if (!res.ok) throw new Error(`${endpoint}: ${text.slice(0, 200)}`);
        return text ? JSON.parse(text) : {};
      } catch (e) {
        if (attempt === 4) throw e;
        await new Promise((r) => setTimeout(r, 4000 * attempt));
      }
    }
  };
  let data;
  if (buf.length <= CHUNK) {
    data = await content("upload", { path: dest, mode: "overwrite" }, buf);
  } else {
    // chunked upload session — survives flaky networks, no size ceiling
    const start = await content("upload_session/start", { close: false }, buf.subarray(0, CHUNK));
    let offset = CHUNK;
    while (buf.length - offset > CHUNK) {
      await content("upload_session/append_v2", { cursor: { session_id: start.session_id, offset }, close: false }, buf.subarray(offset, offset + CHUNK));
      offset += CHUNK;
    }
    data = await content("upload_session/finish",
      { cursor: { session_id: start.session_id, offset }, commit: { path: dest, mode: "overwrite" } },
      buf.subarray(offset));
  }
  out({ path: data.path_display, size_mb: +(data.size / 1e6).toFixed(1) });
} else if (cmd === "link") {
  const path = process.argv[3] || die("usage: link <dropboxPath>");
  const data = await rpc(token, "files/get_temporary_link", { path });
  out(data.link);
} else if (cmd === "share") {
  // PERMANENT direct link (use this for Zernio posts — temp links die in 4h,
  // which kills any post scheduled further out than that)
  const path = process.argv[3] || die("usage: share <dropboxPath>");
  const call = async (endpoint, body) => {
    const res = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, data: await res.json() };
  };
  let r = await call("sharing/create_shared_link_with_settings", { path });
  let url = r.ok ? r.data.url : null;
  if (!url) {
    r = await call("sharing/list_shared_links", { path, direct_only: true });
    url = r.ok && r.data.links?.length ? r.data.links[0].url : null;
  }
  if (!url) die(`share failed for ${path}: ${JSON.stringify(r.data).slice(0, 200)}`);
  out(url.replace("www.dropbox.com", "dl.dropboxusercontent.com").replace(/[?&]dl=\d/, ""));
} else if (cmd === "mkdir") {
  const path = process.argv[3] || die("usage: mkdir <dropboxPath>");
  const data = await rpc(token, "files/create_folder_v2", { path, autorename: false });
  out({ created: data.metadata.path_display });
} else if (cmd === "move") {
  const [from, to] = process.argv.slice(3);
  if (!from || !to) die("usage: move <fromPath> <toPath>");
  const data = await rpc(token, "files/move_v2", { from_path: from, to_path: to, autorename: true });
  out({ moved: data.metadata.path_display });
} else {
  die("unknown command. Use: list | download | upload | link | mkdir | move");
}
