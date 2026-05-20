export type ImageQuality = "largest-available" | "original";
export type VideoAction = "copy-url" | "download" | "both";

export interface Settings {
  imageQuality: ImageQuality;
  videoAction: VideoAction;
}

export const DEFAULT_SETTINGS: Settings = {
  imageQuality: "largest-available",
  videoAction: "copy-url",
};

export type Message =
  | {
      type: "RESOLVE_AND_FETCH";
      pinId: string;
      candidateUrl: string;
      quality: ImageQuality;
    }
  | { type: "VIDEO_ACTION"; pinId: string; sources: VideoSources }
  | { type: "TRANSCODE_TO_PNG"; bytes: ArrayBuffer; mimeType: string };

export type Response =
  | {
      ok: true;
      type: "MEDIA";
      bytes: ArrayBuffer;
      mimeType: string;
      resolvedUrl: string;
    }
  | { ok: true; type: "VIDEO_DONE"; copiedUrl?: string; downloaded?: boolean }
  | { ok: true; type: "PNG_BYTES"; bytes: ArrayBuffer }
  | { ok: false; code: ErrorCode; message: string; fallbackUrl?: string };

export type ErrorCode =
  | "NO_ORIGINALS"
  | "ANIMATED_UNCOPYABLE"
  | "CDN_BLOCKED"
  | "FETCH_FAILED"
  | "TRANSCODE_FAILED"
  | "NO_VIDEO_SOURCE";

export interface VideoSources {
  mp4Url?: string;
  hlsUrl?: string;
  posterUrl?: string;
}
