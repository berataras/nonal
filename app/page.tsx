"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Languages,
  LoaderCircle,
  Orbit,
  Repeat2,
  SkipForward,
  Telescope,
  Volume2,
  VolumeX,
} from "lucide-react";

import {
  isLanguage,
  isMode,
  isNextVideo,
  type INextResponse,
  type INextVideo,
  type TLanguage,
  type TMode,
} from "@/lib/types";

interface IYouTubePlayer {
  loadVideoById: (videoId: string) => void;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  mute: () => void;
  unMute: () => void;
  playVideo: () => void;
  destroy: () => void;
}

interface IYouTubePlayerEvent {
  data: number;
}

interface IYouTubeNamespace {
  Player: new (
    element: string | HTMLElement,
    options: {
      width?: string;
      height?: string;
      playerVars?: Record<string, number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: IYouTubePlayerEvent) => void;
      };
    },
  ) => IYouTubePlayer;
  PlayerState: { BUFFERING: number; ENDED: number; PLAYING: number };
}

interface ISession {
  mode: TMode;
  language: TLanguage;
  video: INextVideo | null;
  message: string | null;
  pending: boolean;
}

declare global {
  interface Window {
    YT?: IYouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const MODE_KEY = "nonal-mode";
const LANGUAGE_KEY = "nonal-language";
const RANDOM_START_MIN_SECONDS = 15;
const RANDOM_START_END_BUFFER_SECONDS = 45;
const MODES = [
  { id: "same", label: "Same", icon: Repeat2 },
  { id: "near", label: "Near", icon: Orbit },
  { id: "far", label: "Far", icon: Telescope },
] as const satisfies readonly {
  id: TMode;
  label: string;
  icon: typeof Repeat2;
}[];

const defaultSession: ISession = {
  mode: "far",
  language: "all",
  video: null,
  message: null,
  pending: false,
};
let snapshot: ISession = defaultSession;
let preferencesLoaded = false;
let iframeApiPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return defaultSession;
}

function commit(next: ISession) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function chooseMode(mode: TMode) {
  commit({ ...snapshot, mode });
  window.localStorage.setItem(MODE_KEY, mode);
}

function chooseLanguage(language: TLanguage) {
  commit({ ...snapshot, language });
  window.localStorage.setItem(LANGUAGE_KEY, language);
}

function loadPreferences() {
  if (preferencesLoaded) return;
  preferencesLoaded = true;
  const storedMode = window.localStorage.getItem(MODE_KEY);
  const storedLanguage = window.localStorage.getItem(LANGUAGE_KEY);
  const mode = isMode(storedMode) ? storedMode : snapshot.mode;
  const language = isLanguage(storedLanguage) ? storedLanguage : snapshot.language;
  if (mode === snapshot.mode && language === snapshot.language) return;
  commit({ ...snapshot, mode, language });
}

async function requestNext() {
  if (snapshot.pending) return;
  const body = {
    mode: snapshot.mode,
    language: snapshot.language,
    currentVideoId: snapshot.video?.id,
  };
  commit({ ...snapshot, pending: true, message: null });
  try {
    const response = await fetch("/api/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let payload: unknown;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      commit({ ...snapshot, pending: false, message: "Couldn’t load a video." });
      return;
    }
    const message = readMessage(payload);
    const video = readVideo(payload);
    if (!response.ok || !video) {
      commit({ ...snapshot, pending: false, message: message ?? "No video found." });
      return;
    }
    commit({ ...snapshot, pending: false, message: null, video });
  } catch {
    commit({ ...snapshot, pending: false, message: "Couldn’t load a video." });
  }
}

function readMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("message" in payload)) return null;
  const message = (payload as INextResponse).message;
  return typeof message === "string" ? message : null;
}

function readVideo(payload: unknown): INextVideo | null {
  if (!payload || typeof payload !== "object" || !("video" in payload)) return null;
  const video = (payload as { video?: unknown }).video;
  return isNextVideo(video) ? video : null;
}

function loadIframeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (iframeApiPromise) return iframeApiPromise;
  iframeApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("player"));
    document.body.appendChild(script);
  });
  return iframeApiPromise;
}

function destroyPlayer(player: IYouTubePlayer) {
  try {
    player.destroy();
  } catch {
    // The iframe API throws when the player is already gone.
  }
}

function randomStartSeconds(duration: number, random: () => number = Math.random) {
  const latestStart = duration - RANDOM_START_END_BUFFER_SECONDS;
  if (latestStart <= RANDOM_START_MIN_SECONDS) return 0;
  return Math.floor(
    RANDOM_START_MIN_SECONDS + random() * (latestStart - RANDOM_START_MIN_SECONDS),
  );
}

function formatSubscribers(count: number | undefined) {
  if (count === undefined) return null;
  const formatted = new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(count);
  return `${formatted} subscribers`;
}

function ChannelIdentity({ video }: { video: INextVideo }) {
  const href = `https://www.youtube.com/channel/${video.channelId}`;
  const subscriberText = formatSubscribers(video.channelSubscriberCount);
  const initial = video.channelTitle.trim().charAt(0).toUpperCase() || "N";

  return (
    <a className="channel" href={href} target="_blank" rel="noreferrer">
      <span className="avatar" aria-hidden="true">
        <span>{initial}</span>
        {video.channelAvatarUrl ? (
          // The YouTube API asks clients to use the returned thumbnail URL unchanged.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.channelAvatarUrl}
            alt=""
            width="40"
            height="40"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        ) : null}
      </span>
      <span className="channelCopy">
        <strong>{video.channelTitle}</strong>
        {subscriberText ? <span>{subscriberText}</span> : null}
      </span>
    </a>
  );
}

export default function HomePage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<IYouTubePlayer | null>(null);
  const loadedIdRef = useRef<string | null>(null);
  const randomizedIdRef = useRef<string | null>(null);
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hasVideo = current.video !== null;
  const [apiReady, setApiReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    loadPreferences();
    void requestNext();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.code !== "KeyR") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, select, textarea")) return;
      event.preventDefault();
      void requestNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadIframeApi()
      .then(() => {
        if (!cancelled) setApiReady(true);
      })
      .catch(() => {
        if (!cancelled) setPlayerError("Couldn’t load the YouTube player.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!apiReady || !hasVideo || !stage || !window.YT) return;
    let cancelled = false;
    const youtube = window.YT;
    const mount = document.createElement("div");
    stage.appendChild(mount);
    const player = new youtube.Player(mount, {
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 1,
        mute: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
      },
      events: {
        onReady: () => {
          if (cancelled) {
            destroyPlayer(player);
            return;
          }
          playerRef.current = player;
          setPlayerReady(true);
        },
        onStateChange: (event) => {
          if (event.data === youtube.PlayerState.ENDED) {
            void requestNext();
            return;
          }
          if (
            event.data !== youtube.PlayerState.BUFFERING &&
            event.data !== youtube.PlayerState.PLAYING
          ) {
            return;
          }
          const videoId = loadedIdRef.current;
          if (!videoId || randomizedIdRef.current === videoId) return;
          const duration = player.getDuration();
          if (!Number.isFinite(duration) || duration <= 0) return;
          randomizedIdRef.current = videoId;
          const startSeconds = randomStartSeconds(duration);
          if (startSeconds > 0) player.seekTo(startSeconds, true);
        },
      },
    });
    return () => {
      cancelled = true;
      playerRef.current = null;
      loadedIdRef.current = null;
      randomizedIdRef.current = null;
      destroyPlayer(player);
      mount.remove();
    };
  }, [apiReady, hasVideo]);

  useEffect(() => {
    const player = playerRef.current;
    if (!playerReady || !player || !current.video) return;
    if (loadedIdRef.current === current.video.id) return;
    loadedIdRef.current = current.video.id;
    player.loadVideoById(current.video.id);
  }, [playerReady, current.video]);

  function toggleSound() {
    const player = playerRef.current;
    if (!player) return;
    if (muted) {
      player.unMute();
      player.playVideo();
      setMuted(false);
      return;
    }
    player.mute();
    setMuted(true);
  }

  const notice = playerError ?? current.message;
  const soundLabel = muted ? "Turn sound on" : "Mute video";

  return (
    <main className="watchPage">
      <header className="siteHeader">
        <Link className="wordmark" href="/" aria-label="nonal home">
          nonal<span aria-hidden="true" />
        </Link>
      </header>
      <section className="playerFrame" aria-label="Video player">
          <div className="stage" ref={stageRef} />
          {current.pending ? (
            <div className="loadingOverlay" role="status" aria-live="polite">
              <LoaderCircle aria-hidden="true" />
              <span>{current.video ? "Finding the next video" : "Finding a video"}</span>
            </div>
          ) : null}
          {notice ? (
            <p className={`notice${current.video ? " noticeWithVideo" : ""}`} role="alert">
              {notice}
            </p>
          ) : null}
      </section>

      <section className="videoDetails" aria-label="Video details">
          <h1>{current.video?.title ?? (current.pending ? "Finding something unfamiliar…" : "nonal")}</h1>
          <div className="metaRow">
            {current.video ? <ChannelIdentity video={current.video} /> : <div className="channelPlaceholder" />}

            <div className="actions" aria-label="Player controls">
              <div className="modeGroup" role="group" aria-label="Discovery distance">
                {MODES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="actionButton modeButton"
                      aria-pressed={current.mode === item.id}
                      onClick={() => chooseMode(item.id)}
                    >
                      <Icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <label className="languageControl">
                <Languages aria-hidden="true" />
                <span className="srOnly">Language</span>
                <select
                  aria-label="Language"
                  value={current.language}
                  onChange={(event) => {
                    if (isLanguage(event.target.value)) chooseLanguage(event.target.value);
                  }}
                >
                  <option value="tr">TR</option>
                  <option value="en">EN</option>
                  <option value="all">All</option>
                </select>
                <ChevronDown className="chevron" aria-hidden="true" />
              </label>

              <button
                type="button"
                className="actionButton nextButton"
                disabled={current.pending}
                onClick={() => void requestNext()}
              >
                <SkipForward aria-hidden="true" />
                <span>Next</span>
                <kbd>R</kbd>
              </button>

              <button
                type="button"
                className="iconButton"
                aria-label={soundLabel}
                aria-pressed={!muted}
                data-tooltip={soundLabel}
                disabled={!playerReady || !current.video}
                onClick={toggleSound}
              >
                {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
              </button>
            </div>
          </div>
      </section>
    </main>
  );
}
