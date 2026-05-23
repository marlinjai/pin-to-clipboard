import {
  DEFAULT_SETTINGS,
  Settings,
  ImageQuality,
  VideoAction,
} from "../shared/types";

const IMAGE_QUALITIES = ["largest-available", "original"] as const satisfies readonly ImageQuality[];
const VIDEO_ACTIONS = ["copy-url", "download", "both"] as const satisfies readonly VideoAction[];

function sanitize(raw: unknown): Settings {
  const r = (raw ?? {}) as Partial<Settings>;
  return {
    imageQuality: IMAGE_QUALITIES.includes(r.imageQuality as ImageQuality)
      ? (r.imageQuality as ImageQuality)
      : DEFAULT_SETTINGS.imageQuality,
    videoAction: VIDEO_ACTIONS.includes(r.videoAction as VideoAction)
      ? (r.videoAction as VideoAction)
      : DEFAULT_SETTINGS.videoAction,
  };
}

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.sync.get("settings");
  return sanitize(settings);
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.sync.set({ settings: { ...current, ...patch } });
}
