# Fonts

Fonts are **not bundled** with this repo — pick your own and drop them here.

The renderer (`remotion/EditVideo.tsx`) looks for two files:

| file | used for | weight |
|---|---|---|
| `hook.woff2` | the hook overlay (large text, top third / center) | bold (700) |
| `caption.woff2` | captions + spoken-word subtitles (yellow, bottom third) | bold (700) |

## How to add fonts

1. Choose fonts you have the right to use. Good free options:
   - **Inter** (SIL OFL) — clean, neutral, great for both roles.
   - **Montserrat**, **Archivo**, **Anton** (display) — strong hooks.
   - Download `.woff2` (or `.ttf`) from Google Fonts or the foundry.
2. Drop them in this folder named `hook.woff2` and `caption.woff2`
   (or use any names and update the `HOOK_FONT_FILE` / `CAPTION_FONT_FILE`
   constants near the top of `remotion/EditVideo.tsx`).
3. Re-render. If the files are missing, the renderer falls back to the
   system `system-ui` sans-serif stack — it still works, just with the
   default font.

## Licensing

Only ship fonts you are licensed to redistribute. **Do not** commit commercial
or platform-brand fonts (e.g. a vendor's proprietary UI font, a social
platform's house font). SIL Open Font License (OFL) fonts are safe to bundle —
keep the font's license file alongside it if you commit it.
