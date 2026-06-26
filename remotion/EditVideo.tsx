import React from "react";
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/fonts";

export const FPS = 30;

// Text styling overview (tune to taste):
// Hook: bold, white, black soft outline, top third (default) or dead center, center-aligned.
//   Case is rendered as passed (lowercase default / CAPS for news) — not transformed here.
// Box variant (bright/busy vertical clips): same white text on a semi-transparent black rounded box.
// Pill variant (bright/horizontal/blurred-bg clips): black text on a white rounded pill, no outline.
// Caption: bold, yellow #f4c70f, black outline, bottom third, clear of platform UI.
//
// FONTS ARE NOT BUNDLED. Drop your own .woff2/.ttf into remotion/public/fonts/ and point the
// constants below at them (see remotion/public/fonts/README.md). If the files are missing the
// renderer falls back to the system-ui stack — it still renders, just with the default sans-serif.
const HOOK_FONT_FAMILY = "Hook Font";
const CAPTION_FONT_FAMILY = "Caption Font";
const HOOK_FONT_FILE = "fonts/hook.woff2";       // your hook font (bold)
const CAPTION_FONT_FILE = "fonts/caption.woff2"; // your caption font (bold)

// Load a font if present; swallow a missing-file rejection so the render still completes.
const tryLoadFont = (family: string, file: string, weight: string) => {
  try {
    loadFont({ family, url: staticFile(file), weight }).waitUntilDone().catch(() => undefined);
  } catch {
    // font file absent — the system-ui fallback in the font stacks below takes over
  }
};
tryLoadFont(HOOK_FONT_FAMILY, HOOK_FONT_FILE, "700");
tryLoadFont(CAPTION_FONT_FAMILY, CAPTION_FONT_FILE, "700");

export type TextCue = { text: string; startSec: number; endSec: number | null }; // endSec null = until clip end

export type EditVideoProps = {
  videoFile: string; // relative to remotion/public/
  trimStartSec: number;
  trimEndSec: number | null;
  hook: TextCue | null;
  preset: string; // "plain" (standard) | "box" (semi-transparent box) | "pill" (white pill)
  hookPosition?: string; // "top" (top third, default) | "center" (dead center)
  caption: TextCue | null; // secondary/context line, yellow, bottom third
  music: { file: string; volume: number } | null;
  videoVolume: number;
  subtitles: TextCue[];
};

// Font stacks: the configured family first, then a robust system fallback if it didn't load.
const CAPTION_FONT = `'${CAPTION_FONT_FAMILY}', system-ui, -apple-system, 'Helvetica Neue', sans-serif`;
const HOOK_FONT = `'${HOOK_FONT_FAMILY}', system-ui, -apple-system, sans-serif`;

// Black outline that doesn't eat the fill (Chrome supports paint-order on text).
const outline = (px: number): React.CSSProperties => ({
  WebkitTextStroke: `${px}px #000`,
  paintOrder: "stroke fill",
});

const HOOK_STYLES: Record<string, { wrap: React.CSSProperties; text: React.CSSProperties }> = {
  plain: {
    wrap: {},
    text: {
      fontFamily: HOOK_FONT,
      fontWeight: 700,
      fontSize: 58,
      color: "#fff",
      textAlign: "center",
      lineHeight: 1.25,
      ...outline(10),
    },
  },
  box: {
    // Same white hook as plain, on a subtle semi-transparent black box (~50%) for bright/busy clips.
    wrap: {
      backgroundColor: "rgba(0,0,0,0.5)",
      borderRadius: 22,
      padding: "16px 28px",
    },
    text: {
      fontFamily: HOOK_FONT,
      fontWeight: 700,
      fontSize: 58,
      color: "#fff",
      textAlign: "center",
      lineHeight: 1.25,
      ...outline(6), // lighter than plain — the box already provides separation
    },
  },
  pill: {
    wrap: {
      backgroundColor: "#fff",
      borderRadius: 28,
      padding: "18px 34px",
    },
    text: {
      fontFamily: HOOK_FONT,
      fontWeight: 700,
      fontSize: 54,
      color: "#000",
      textAlign: "center",
      lineHeight: 1.3,
    },
  },
};

const CAPTION_STYLE: React.CSSProperties = {
  fontFamily: CAPTION_FONT,
  fontWeight: 700,
  fontSize: 50,
  color: "#f4c70f",
  textAlign: "center",
  lineHeight: 1.25,
  ...outline(9),
};

const Fade: React.FC<{ durationFrames: number; fade: number; children: React.ReactNode; style: React.CSSProperties }> = ({
  durationFrames,
  fade,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, fade, Math.max(fade + 1, durationFrames - fade), durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  // width/height auto: AbsoluteFill hardcodes width 100%, which silently overrides
  // a `right` offset whenever `left` is also set — text ends up off-center.
  return <AbsoluteFill style={{ width: "auto", height: "auto", ...style, opacity }}>{children}</AbsoluteFill>;
};

const cueFrames = (c: TextCue, totalFrames: number) => {
  const from = Math.round(c.startSec * FPS);
  const end = c.endSec == null ? totalFrames : Math.round(c.endSec * FPS);
  return { from, duration: Math.max(1, end - from) };
};

export const EditVideo: React.FC<EditVideoProps> = ({
  videoFile,
  trimStartSec,
  hook,
  preset,
  hookPosition,
  caption,
  music,
  videoVolume,
  subtitles,
}) => {
  const hookStyle = HOOK_STYLES[preset] ?? HOOK_STYLES.plain;
  // Placement: top third (default) or dead center for short reveals (playbook). Top keeps ≥15%
  // breathing room above (top:280 ≈ 14.6%); center fills height and centers the block vertically.
  const hookPlacement: React.CSSProperties =
    hookPosition === "center"
      ? { top: 0, bottom: 0, left: 110, right: 110, alignItems: "center", justifyContent: "center", flexDirection: "column" }
      : { top: 280, left: 110, right: 110, alignItems: "flex-start", justifyContent: "center", flexDirection: "row" };
  const { durationInFrames } = useVideoConfig();
  const hookF = hook ? cueFrames(hook, durationInFrames) : null;
  const captionF = caption ? cueFrames(caption, durationInFrames) : null;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo
        src={staticFile(videoFile)}
        startFrom={Math.round(trimStartSec * FPS)}
        volume={videoVolume}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      {music ? <Audio src={staticFile(music.file)} volume={music.volume} loop /> : null}

      {/* Hook: top third (default) or dead center, horizontally centered, inside safe zones */}
      {hook && hookF ? (
        <Sequence from={hookF.from} durationInFrames={hookF.duration}>
          <Fade
            durationFrames={hookF.duration}
            fade={5}
            style={hookPlacement}
          >
            <div style={hookStyle.wrap}>
              <div style={{ ...hookStyle.text, maxWidth: 760 }}>{hook.text}</div>
            </div>
          </Fade>
        </Sequence>
      ) : null}

      {/* Caption: bottom third, above the platform UI (bottom ~480px) */}
      {caption && captionF ? (
        <Sequence from={captionF.from} durationInFrames={captionF.duration}>
          <Fade
            durationFrames={captionF.duration}
            fade={5}
            style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 560 }}
          >
            <div style={{ ...CAPTION_STYLE, maxWidth: 800 }}>{caption.text}</div>
          </Fade>
        </Sequence>
      ) : null}

      {/* Subtitles (spoken word, talking clips only): caption styling, slightly smaller */}
      {subtitles.map((s, i) => {
        const f = cueFrames(s, durationInFrames);
        return (
          <Sequence key={i} from={f.from} durationInFrames={f.duration}>
            <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 560 }}>
              <div style={{ ...CAPTION_STYLE, fontSize: 46, maxWidth: 820 }}>{s.text}</div>
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
