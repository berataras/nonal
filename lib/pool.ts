import { CatalogError, readCatalog, readKnownChannelIds, writeCatalog } from "@/lib/catalog";
import { EMPTY_POOL_MESSAGE, MISSING_API_KEY_MESSAGE, SEARCH_ATTEMPTS } from "@/lib/config";
import { isTopic, pickRandom, topicCandidates, type TTopic } from "@/lib/topics";
import type { ICatalogVideo, INextRequest, INextResponse, INextVideo, TLanguage } from "@/lib/types";
import { fetchChannelProfiles, searchTopicWindow } from "@/lib/youtube";

let chain: Promise<unknown> = Promise.resolve();

export function pickNext(input: INextRequest): Promise<INextResponse> {
  const result = chain.then(() => pickNextQueued(input), () => pickNextQueued(input));
  chain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function pickNextQueued(input: INextRequest): Promise<INextResponse> {
  const catalog = await readCatalog();
  const knownChannelIds = await readKnownChannelIds();
  const known = new Set(knownChannelIds);
  const current = input.currentVideoId
    ? catalog.find((video) => video.id === input.currentVideoId)
    : undefined;
  const currentTopic = current && isTopic(current.topic) ? current.topic : null;
  const candidates = topicCandidates(input.mode, currentTopic);
  if (candidates.length === 0) return { video: null, message: EMPTY_POOL_MESSAGE };

  const cached = pickEligible(catalog, candidates, input.language, known);
  if (cached) return selectVideo(catalog, cached);

  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return { video: null, message: MISSING_API_KEY_MESSAGE };

  for (let attempt = 0; attempt < SEARCH_ATTEMPTS; attempt += 1) {
    const topic = candidates[attempt % candidates.length];
    const result = await searchTopicWindow({
      topic,
      language: input.language,
      knownChannelIds,
      existingIds: catalog.map((video) => video.id),
    });
    if (!result.ok) return { video: null, message: result.message };

    const existing = new Set(catalog.map((video) => video.id));
    const fresh = result.videos.filter((video) => !existing.has(video.id));
    if (fresh.length === 0) continue;
    catalog.push(...fresh);

    const chosen = pickEligible(catalog, [topic], input.language, known);
    if (chosen) return selectVideo(catalog, chosen);
    await writeCatalog(catalog);
  }

  return { video: null, message: EMPTY_POOL_MESSAGE };
}

async function selectVideo(
  catalog: ICatalogVideo[],
  chosen: ICatalogVideo,
): Promise<INextResponse> {
  if (!chosen.channelAvatarUrl || chosen.channelSubscriberCount === undefined) {
    const profiles = await fetchChannelProfiles([chosen.channelId]);
    const profile = profiles.get(chosen.channelId);
    if (profile) Object.assign(chosen, profile);
  }
  chosen.seen = true;
  await writeCatalog(catalog);
  return { video: toNextVideo(chosen) };
}

function pickEligible(
  catalog: readonly ICatalogVideo[],
  topics: readonly TTopic[],
  language: TLanguage,
  known: ReadonlySet<string>,
): ICatalogVideo | undefined {
  for (const topic of topics) {
    const matches = eligible(catalog, topic, language, known);
    const chosen = pickRandom(matches);
    if (chosen) return chosen;
  }
  return undefined;
}

function eligible(
  catalog: readonly ICatalogVideo[],
  topic: TTopic,
  language: TLanguage,
  known: ReadonlySet<string>,
): ICatalogVideo[] {
  return catalog.filter((video) => {
    if (video.seen || video.topic !== topic || known.has(video.channelId)) return false;
    if (language === "all") return true;
    return video.language === language;
  });
}

function toNextVideo(video: ICatalogVideo): INextVideo {
  return {
    id: video.id,
    title: video.title,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    channelAvatarUrl: video.channelAvatarUrl,
    channelSubscriberCount: video.channelSubscriberCount,
    topic: video.topic,
    language: video.language,
  };
}

export function isCatalogError(error: unknown): error is CatalogError {
  return error instanceof CatalogError;
}
