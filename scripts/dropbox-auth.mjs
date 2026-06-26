#!/usr/bin/env node
// One-time Dropbox OAuth flow to get a long-lived refresh token.
// Needs DROPBOX_APP_KEY and DROPBOX_APP_SECRET in .env first.
//
//   node scripts/dropbox-auth.mjs url       -> prints the URL to open and approve
//   node scripts/dropbox-auth.mjs <code>    -> exchanges the code, prints the refresh token

import { loadEnv, die, out } from "./lib.mjs";

loadEnv();
const key = process.env.DROPBOX_APP_KEY || die("set DROPBOX_APP_KEY in .env first");
const secret = process.env.DROPBOX_APP_SECRET || die("set DROPBOX_APP_SECRET in .env first");

const cmd = process.argv[2];
if (!cmd || cmd === "url") {
  out(`Open this URL, click Allow, and copy the code it shows:\n\nhttps://www.dropbox.com/oauth2/authorize?client_id=${key}&response_type=code&token_access_type=offline\n\nThen run: node scripts/dropbox-auth.mjs <code>`);
} else {
  const res = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: cmd,
      grant_type: "authorization_code",
      client_id: key,
      client_secret: secret,
    }),
  });
  const data = await res.json();
  if (!res.ok) die(JSON.stringify(data));
  out(`Add this to .env:\n\nDROPBOX_REFRESH_TOKEN=${data.refresh_token}`);
}
