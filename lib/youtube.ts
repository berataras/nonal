import {
  DAY_MS,
  INVALID_KEY_MESSAGE,
  MAX_VIEW_COUNT,
  MIN_DURATION_SECONDS,
  MIN_VIEW_COUNT,
  MISSING_API_KEY_MESSAGE,
  QUOTA_MESSAGE,
  REJECTED_KEY_MESSAGE,
  SEARCH_FAILED_MESSAGE,
  SEARCH_LATEST_OFFSET_DAYS,
  SEARCH_MAX_RESULTS,
  SEARCH_RANGE_START_MS,
  SEARCH_WINDOW_DAYS,
} from "@/lib/config";
import { pickQuery, type TTopic } from "@/lib/topics";
import type { ICatalogVideo, TLanguage, TStoredLanguage } from "@/lib/types";

export interface ISearchWindowInput {
  topic: TTopic;
  language: TLanguage;
  knownChannelIds: readonly string[];
  existingIds: readonly string[];
}

export type TYoutubeResult =
  | { ok: true; videos: ICatalogVideo[] }
  | { ok: false; message: string };

interface ISearchHit {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
}

export interface IChannelProfile {
  avatarUrl?: string;
  subscriberCount?: number;
}

export async function searchTopicWindow(input: ISearchWindowInput): Promise<TYoutubeResult> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return { ok: false, message: MISSING_API_KEY_MESSAGE };

  const window = randomWindow();
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    order: "date",
    videoEmbeddable: "true",
    safeSearch: "moderate",
    maxResults: String(SEARCH_MAX_RESULTS),
    q: pickQuery(input.topic, input.language),
    videoDuration: Math.random() < 0.5 ? "medium" : "long",
    publishedAfter: window.publishedAfter,
    publishedBefore: window.publishedBefore,
    key,
  });
  if (input.language !== "all") params.set("relevanceLanguage", input.language);

  const search = await fetchYoutube("search", params);
  if (!search.ok) return search;

  const known = new Set(input.knownChannelIds);
  const existing = new Set(input.existingIds);
  const hits = readSearchHits(search.body).filter(
    (hit) => !known.has(hit.channelId) && !existing.has(hit.id),
  );
  if (hits.length === 0) return { ok: true, videos: [] };

  const detailsParams = new URLSearchParams({
    part: "snippet,contentDetails,statistics",
    id: hits.map((hit) => hit.id).join(","),
    key,
  });
  const details = await fetchYoutube("videos", detailsParams);
  if (!details.ok) return details;

  const hitById = new Map(hits.map((hit) => [hit.id, hit]));
  const videos = readVideos(details.body, hitById, input);
  const profiles = await fetchChannelProfiles(videos.map((video) => video.channelId));
  return {
    ok: true,
    videos: videos.map((video) => ({ ...video, ...profiles.get(video.channelId) })),
  };
}

export async function fetchChannelProfiles(
  channelIds: readonly string[],
): Promise<ReadonlyMap<string, IChannelProfile>> {
  const uniqueIds = [...new Set(channelIds)].slice(0, 50);
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key || uniqueIds.length === 0) return new Map();

  const params = new URLSearchParams({
    part: "snippet,statistics",
    id: uniqueIds.join(","),
    key,
  });
  const response = await fetchYoutube("channels", params);
  if (!response.ok) return new Map();
  return readChannelProfiles(response.body);
}

async function fetchYoutube(
  resource: "channels" | "search" | "videos",
  params: URLSearchParams,
): Promise<{ ok: true; body: unknown } | { ok: false; message: string }> {
  let response: Response;
  try {
    response = await fetch(`https://www.googleapis.com/youtube/v3/${resource}?${params}`, {
      cache: "no-store",
    });
  } catch (error) {
    console.error("YouTube request failed", resource, error);
    return { ok: false, message: SEARCH_FAILED_MESSAGE };
  }

  let body: unknown = null;
  try {
    body = (await response.json()) as unknown;
  } catch {
    body = null;
  }

  if (!response.ok || hasError(body)) {
    return { ok: false, message: failureMessage(response.status, body) };
  }
  return { ok: true, body };
}

function readChannelProfiles(body: unknown): ReadonlyMap<string, IChannelProfile> {
  const profiles = new Map<string, IChannelProfile>();
  if (!body || typeof body !== "object" || !("items" in body)) return profiles;
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) return profiles;

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item as {
      id?: unknown;
      snippet?: {
        thumbnails?: {
          default?: { url?: unknown };
          medium?: { url?: unknown };
          high?: { url?: unknown };
        };
      };
      statistics?: {
        hiddenSubscriberCount?: unknown;
        subscriberCount?: unknown;
      };
    };
    if (typeof record.id !== "string") continue;

    const thumbnail =
      record.snippet?.thumbnails?.high?.url ??
      record.snippet?.thumbnails?.medium?.url ??
      record.snippet?.thumbnails?.default?.url;
    const avatarUrl =
      typeof thumbnail === "string" && thumbnail.startsWith("https://") ? thumbnail : undefined;
    const subscriberCount = readSubscriberCount(record.statistics);
    if (!avatarUrl && subscriberCount === undefined) continue;
    profiles.set(record.id, { avatarUrl, subscriberCount });
  }

  return profiles;
}

function readSubscriberCount(
  statistics:
    | { hiddenSubscriberCount?: unknown; subscriberCount?: unknown }
    | undefined,
): number | undefined {
  if (!statistics || statistics.hiddenSubscriberCount === true) return undefined;
  if (typeof statistics.subscriberCount !== "string") return undefined;
  const count = Number(statistics.subscriberCount);
  return Number.isFinite(count) && count >= 0 ? count : undefined;
}

function randomWindow(): { publishedAfter: string; publishedBefore: string } {
  const latestStart =
    Date.now() - SEARCH_LATEST_OFFSET_DAYS * DAY_MS - SEARCH_WINDOW_DAYS * DAY_MS;
  const span = Math.max(latestStart - SEARCH_RANGE_START_MS, DAY_MS);
  const windowStart = SEARCH_RANGE_START_MS + Math.floor(Math.random() * span);
  return {
    publishedAfter: new Date(windowStart).toISOString(),
    publishedBefore: new Date(windowStart + SEARCH_WINDOW_DAYS * DAY_MS).toISOString(),
  };
}

function readSearchHits(body: unknown): ISearchHit[] {
  if (!body || typeof body !== "object" || !("items" in body)) return [];
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];

  const hits: ISearchHit[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item as {
      id?: { videoId?: unknown };
      snippet?: {
        title?: unknown;
        channelId?: unknown;
        channelTitle?: unknown;
        publishedAt?: unknown;
        liveBroadcastContent?: unknown;
      };
    };
    const id = record.id?.videoId;
    const snippet = record.snippet;
    if (typeof id !== "string" || !snippet) continue;
    if (snippet.liveBroadcastContent === "live" || snippet.liveBroadcastContent === "upcoming") {
      continue;
    }
    if (typeof snippet.channelId !== "string") continue;
    hits.push({
      id,
      title: typeof snippet.title === "string" && snippet.title.trim() ? snippet.title : "Başlıksız",
      channelId: snippet.channelId,
      channelTitle: typeof snippet.channelTitle === "string" ? snippet.channelTitle : "",
      publishedAt: typeof snippet.publishedAt === "string" ? snippet.publishedAt : "",
    });
  }
  return hits;
}

function readVideos(
  body: unknown,
  hitById: ReadonlyMap<string, ISearchHit>,
  input: ISearchWindowInput,
): ICatalogVideo[] {
  if (!body || typeof body !== "object" || !("items" in body)) return [];
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];

  const videos: ICatalogVideo[] = [];
  for (const item of items) {
    const video = toCatalogVideo(item, hitById, input.language, input.topic);
    if (video) videos.push(video);
  }
  return videos;
}

function toCatalogVideo(
  item: unknown,
  hitById: ReadonlyMap<string, ISearchHit>,
  language: TLanguage,
  topic: TTopic,
): ICatalogVideo | null {
  if (!item || typeof item !== "object") return null;
  const record = item as {
    id?: unknown;
    snippet?: { defaultAudioLanguage?: unknown; liveBroadcastContent?: unknown; title?: unknown };
    contentDetails?: { duration?: unknown };
    statistics?: { viewCount?: unknown };
  };
  if (typeof record.id !== "string") return null;
  const hit = hitById.get(record.id);
  if (!hit) return null;
  if (
    record.snippet?.liveBroadcastContent === "live" ||
    record.snippet?.liveBroadcastContent === "upcoming"
  ) {
    return null;
  }

  const storedLanguage = toStoredLanguage(
    typeof record.snippet?.defaultAudioLanguage === "string"
      ? record.snippet.defaultAudioLanguage
      : undefined,
    language,
  );
  if (!storedLanguage) return null;

  const duration =
    typeof record.contentDetails?.duration === "string"
      ? durationSeconds(record.contentDetails.duration)
      : null;
  if (duration === null || duration < MIN_DURATION_SECONDS) return null;

  const viewCount =
    typeof record.statistics?.viewCount === "string" ? Number(record.statistics.viewCount) : NaN;
  if (!Number.isFinite(viewCount) || viewCount < MIN_VIEW_COUNT || viewCount > MAX_VIEW_COUNT) {
    return null;
  }

  const title =
    typeof record.snippet?.title === "string" && record.snippet.title.trim()
      ? record.snippet.title
      : hit.title;

  return {
    id: record.id,
    title,
    channelId: hit.channelId,
    channelTitle: hit.channelTitle,
    topic,
    language: storedLanguage,
    publishedAt: hit.publishedAt,
    viewCount,
    seen: false,
  };
}

function toStoredLanguage(code: string | undefined, requested: TLanguage): TStoredLanguage | null {
  if (!code) return requested === "all" ? "unknown" : null;
  const base = code.toLowerCase().split("-")[0];
  if (base === "tr") return requested === "en" ? null : "tr";
  if (base === "en") return requested === "tr" ? null : "en";
  return requested === "all" ? "unknown" : null;
}

function durationSeconds(value: string): number | null {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match || (!match[1] && !match[2] && !match[3])) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function hasError(body: unknown): boolean {
  return Boolean(body && typeof body === "object" && "error" in body);
}

function failureMessage(status: number, body: unknown): string {
  const reason = readReason(body);
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded" || reason === "rateLimitExceeded") {
    return QUOTA_MESSAGE;
  }
  if (reason === "keyInvalid") return INVALID_KEY_MESSAGE;
  if (status === 403) return REJECTED_KEY_MESSAGE;
  return SEARCH_FAILED_MESSAGE;
}

function readReason(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || !("error" in body)) return undefined;
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== "object" || !("errors" in error)) return undefined;
  const errors = (error as { errors?: unknown }).errors;
  if (!Array.isArray(errors) || !errors[0] || typeof errors[0] !== "object") return undefined;
  const reason = (errors[0] as { reason?: unknown }).reason;
  return typeof reason === "string" ? reason : undefined;
}
