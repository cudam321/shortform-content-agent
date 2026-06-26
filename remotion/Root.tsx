import React from "react";
import { Composition, staticFile } from "remotion";
import { getVideoMetadata } from "@remotion/media-utils";
import { EditVideo, EditVideoProps, FPS } from "./EditVideo";

const defaultProps: EditVideoProps = {
  videoFile: "",
  trimStartSec: 0,
  trimEndSec: null,
  hook: null,
  preset: "plain",
  caption: null,
  music: null,
  videoVolume: 1,
  subtitles: [],
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="EditVideo"
      component={EditVideo}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={300}
      defaultProps={defaultProps}
      calculateMetadata={async ({ props }) => {
        const meta = await getVideoMetadata(staticFile(props.videoFile));
        const start = props.trimStartSec ?? 0;
        const end = Math.min(props.trimEndSec ?? meta.durationInSeconds, meta.durationInSeconds);
        return {
          durationInFrames: Math.max(1, Math.round((end - start) * FPS)),
          props,
        };
      }}
    />
  );
};
