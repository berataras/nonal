import { CatalogError, readCatalog, readHomeTopics, readKnownChannelIds, writeCatalog } from "@/lib/catalog";
import {
  EMPTY_POOL_MESSAGE,
  MISSING_API_KEY_MESSAGE,
  POOL_REFILL_THRESHOLD,
  SEARCH_ATTEMPTS,
} from "@/lib/config";
import { isTopic, pickRandom, pickTopic } from "@/lib/topics";
import type { ICatalogVideo, INextRequest, INextResponse, INextVideo, TLanguage } from "@/lib/types";
import { searchTopicWeek } from "@/lib/youtube";

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
  const home = await readHomeTopics();
  const known = new Set(knownChannelIds);
  const current = input.currentVideoId
    ? catalog.find((video) => video.id === input.currentVideoId)
    : undefined;
  const currentTopic = current && isTopic(current.topic) ? current.topic : null;
  const topic = pickTopic(input.mode, currentTopic, home);
  if (!topic) return { video: null, message: EMPTY_POOL_MESSAGE };

  let matches = eligible(catalog, topic, input.language, known);
  if (matches.length < POOL_REFILL_THRESHOLD) {
    const key = process.env.YOUTUBE_API_KEY?.trim();
    if (!key) {
      if (matches.length === 0) return { video: null, message: MISSING_API_KEY_MESSAGE };
    } else {
      for (let attempt = 0; attempt < SEARCH_ATTEMPTS; attempt += 1) {
        const result = await searchTopicWeek({
          topic,
          language: input.language,
          knownChannelIds,
          existingIds: catalog.map((video) => video.id),
        });
        if (!result.ok) {
          if (matches.length > 0) break;
          return { video: null, message: result.message };
        }
        const existing = new Set(catalog.map((video) => video.id));
        const fresh = result.videos.filter((video) => !existing.has(video.id));
        if (fresh.length === 0) continue;
        catalog.push(...fresh);
        await writeCatalog(catalog);
        matches = eligible(catalog, topic, input.language, known);
        if (matches.length > 0) break;
      }
    }
  }

  const chosen = pickRandom(matches);
  if (!chosen) return { video: null, message: EMPTY_POOL_MESSAGE };
  chosen.seen = true;
  await writeCatalog(catalog);
  return { video: toNextVideo(chosen) };
}

function eligible(
  catalog: readonly ICatalogVideo[],
  topic: string,
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
    topic: video.topic,
    language: video.language,
  };
}

export function isCatalogError(error: unknown): error is CatalogError {
  return error instanceof CatalogError;
}
