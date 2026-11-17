export const MODES = ["same", "near", "far"] as const;
export const LANGUAGES = ["tr", "en", "all"] as const;
export const STORED_LANGUAGES = ["tr", "en", "unknown"] as const;

export type TMode = (typeof MODES)[number];
export type TLanguage = (typeof LANGUAGES)[number];
export type TStoredLanguage = (typeof STORED_LANGUAGES)[number];

export interface ICatalogVideo {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  channelAvatarUrl?: string;
  channelSubscriberCount?: number;
  topic: string;
  language: TStoredLanguage;
  publishedAt: string;
  viewCount: number;
  seen: boolean;
}

export interface INextVideo {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  channelAvatarUrl?: string;
  channelSubscriberCount?: number;
  topic: string;
  language: TStoredLanguage;
}

export interface INextRequest {
  mode: TMode;
  language: TLanguage;
  currentVideoId?: string;
}

export interface INextResponse {
  video: INextVideo | null;
  message?: string;
}

export function isMode(value: unknown): value is TMode {
  return value === "same" || value === "near" || value === "far";
}

export function isLanguage(value: unknown): value is TLanguage {
  return value === "tr" || value === "en" || value === "all";
}

export function isStoredLanguage(value: unknown): value is TStoredLanguage {
  return value === "tr" || value === "en" || value === "unknown";
}

export function isNextVideo(value: unknown): value is INextVideo {
  if (!value || typeof value !== "object") return false;
  const video = value as Record<string, unknown>;
  return (
    typeof video.id === "string" &&
    typeof video.title === "string" &&
    typeof video.channelId === "string" &&
    typeof video.channelTitle === "string" &&
    (video.channelAvatarUrl === undefined || typeof video.channelAvatarUrl === "string") &&
    (video.channelSubscriberCount === undefined ||
      (typeof video.channelSubscriberCount === "number" &&
        Number.isFinite(video.channelSubscriberCount) &&
        video.channelSubscriberCount >= 0)) &&
    typeof video.topic === "string" &&
    isStoredLanguage(video.language)
  );
}
