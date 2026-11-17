import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";

import { isStoredLanguage, type ICatalogVideo } from "@/lib/types";

const dataDirectory = path.join(process.cwd(), "data");
const catalogPath = path.join(dataDirectory, "catalog.json");
const knownChannelsPath = path.join(dataDirectory, "known-channels.json");

export class CatalogError extends Error {
  constructor() {
    super("CATALOG");
    this.name = "CatalogError";
  }
}

export async function readCatalog(): Promise<ICatalogVideo[]> {
  let raw: string;
  try {
    raw = await readFile(catalogPath, "utf8");
  } catch (error) {
    if (isErrno(error, "ENOENT")) return [];
    throw new CatalogError();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new CatalogError();
  }
  if (!Array.isArray(parsed)) throw new CatalogError();
  return parsed.filter(isCatalogVideo);
}

export async function writeCatalog(videos: readonly ICatalogVideo[]): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryPath = `${catalogPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(videos, null, 2)}\n`, "utf8");
  await rename(temporaryPath, catalogPath);
}

export async function readKnownChannelIds(): Promise<string[]> {
  const parsed = await readJson(knownChannelsPath);
  if (!parsed || typeof parsed !== "object" || !("channelIds" in parsed)) return [];
  const channelIds = (parsed as { channelIds?: unknown }).channelIds;
  if (!Array.isArray(channelIds)) return [];
  return channelIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

async function readJson(filePath: string): Promise<unknown> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch (error) {
    if (isErrno(error, "ENOENT")) return null;
    throw error;
  }
}

function isCatalogVideo(value: unknown): value is ICatalogVideo {
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
    isStoredLanguage(video.language) &&
    typeof video.publishedAt === "string" &&
    typeof video.viewCount === "number" &&
    Number.isFinite(video.viewCount) &&
    typeof video.seen === "boolean"
  );
}

function isErrno(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}
