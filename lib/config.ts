export const MIN_VIEW_COUNT = 2_000;
export const MAX_VIEW_COUNT = 300_000;
export const MIN_DURATION_SECONDS = 240;
export const POOL_REFILL_THRESHOLD = 5;
export const SEARCH_ATTEMPTS = 3;
export const SEARCH_MAX_RESULTS = 25;
export const SEARCH_WINDOW_DAYS = 7;
export const SEARCH_LATEST_OFFSET_DAYS = 30;
export const SEARCH_RANGE_START_MS = Date.parse("2008-01-01T00:00:00.000Z");
export const DAY_MS = 24 * 60 * 60 * 1000;

export const MISSING_API_KEY_MESSAGE =
  "YouTube API anahtarı yok. .env.local dosyasına YOUTUBE_API_KEY yaz.";
export const EMPTY_POOL_MESSAGE = "Bu dilde video bulunamadı.";
export const CATALOG_READ_MESSAGE = "Katalog okunamadı.";
export const QUOTA_MESSAGE = "YouTube kotası doldu.";
export const INVALID_KEY_MESSAGE = "YouTube API anahtarı geçersiz.";
export const REJECTED_KEY_MESSAGE = "YouTube API anahtarı reddedildi.";
export const SEARCH_FAILED_MESSAGE = "YouTube araması başarısız oldu.";
