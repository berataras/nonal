export const MIN_VIEW_COUNT = 2_000;
export const MAX_VIEW_COUNT = 300_000;
export const MIN_DURATION_SECONDS = 240;
export const SEARCH_ATTEMPTS = 3;
export const SEARCH_MAX_RESULTS = 25;
export const SEARCH_WINDOW_DAYS = 30;
export const SEARCH_LATEST_OFFSET_DAYS = 30;
export const SEARCH_RANGE_START_MS = Date.parse("2008-01-01T00:00:00.000Z");
export const DAY_MS = 24 * 60 * 60 * 1000;

export const MISSING_API_KEY_MESSAGE =
  "Add YOUTUBE_API_KEY to .env.local to discover videos.";
export const EMPTY_POOL_MESSAGE =
  "No unseen videos matched this distance and language. Try again for a different time window.";
export const CATALOG_READ_MESSAGE = "The local video catalog couldn’t be read.";
export const QUOTA_MESSAGE = "The YouTube API quota has been reached.";
export const INVALID_KEY_MESSAGE = "The YouTube API key is invalid.";
export const REJECTED_KEY_MESSAGE = "The YouTube API key was rejected.";
export const SEARCH_FAILED_MESSAGE = "The YouTube search failed. Try again.";
