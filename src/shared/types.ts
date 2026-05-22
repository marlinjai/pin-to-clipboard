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

// Binary payloads never cross a message boundary as ArrayBuffer/Blob - Chrome's
// messaging serializer drops them. Image bytes travel as a base64 string and
// are decoded in the receiving context. See shared/base64.ts.
export type Message =
  | {
      type: "COPY_IMAGE";
      pinId: string;
      candidateUrl: string;
      quality: ImageQuality;
    }
  | { type: "VIDEO_ACTION"; pinId: string; sources: VideoSources };

export type Response =
  | {
      ok: true;
      type: "IMAGE";
      base64: string;
      mimeType: string;
      resolvedUrl: string;
    }
  | { ok: true; type: "VIDEO_DONE"; copiedUrl?: string; downloaded?: boolean }
  | { ok: false; code: ErrorCode; message: string; fallbackUrl?: string };

export type ErrorCode =
  | "NO_ORIGINALS"
  | "ANIMATED_UNCOPYABLE"
  | "CDN_BLOCKED"
  | "FETCH_FAILED"
  | "NO_VIDEO_SOURCE";

export interface VideoSources {
  mp4Url?: string;
  hlsUrl?: string;
  posterUrl?: string;
}
