"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

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
  PlayerState: { ENDED: number };
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
const MODES = [
  { id: "same", label: "Aynı tarz" },
  { id: "near", label: "Yakın" },
  { id: "far", label: "Uzak" },
] as const satisfies readonly { id: TMode; label: string }[];

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
      commit({ ...snapshot, pending: false, message: "Video istenemedi." });
      return;
    }
    const message = readMessage(payload);
    const video = readVideo(payload);
    if (!response.ok || !video) {
      commit({ ...snapshot, pending: false, message: message ?? "Video bulunamadı." });
      return;
    }
    commit({ ...snapshot, pending: false, message: null, video });
  } catch {
    commit({ ...snapshot, pending: false, message: "Video istenemedi." });
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

export default function HomePage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<IYouTubePlayer | null>(null);
  const loadedIdRef = useRef<string | null>(null);
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
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
        if (!cancelled) setPlayerError("YouTube oynatıcısı yüklenemedi.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!apiReady || !stage || !window.YT) return;
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
          if (event.data === youtube.PlayerState.ENDED) void requestNext();
        },
      },
    });
    return () => {
      cancelled = true;
      playerRef.current = null;
      loadedIdRef.current = null;
      destroyPlayer(player);
      mount.remove();
    };
  }, [apiReady]);

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

  return (
    <main className="screen">
      <header className="bar">
        <div className="modes" role="group" aria-label="Mesafe">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={current.mode === item.id}
              onClick={() => chooseMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Dil"
          value={current.language}
          onChange={(event) => {
            if (isLanguage(event.target.value)) chooseLanguage(event.target.value);
          }}
        >
          <option value="tr">TR</option>
          <option value="en">EN</option>
          <option value="all">Hepsi</option>
        </select>
        <span className="hint">R</span>
        <button type="button" className="sound" aria-pressed={!muted} onClick={toggleSound}>
          {muted ? "Ses" : "Sessiz"}
        </button>
      </header>
      {notice ? <p className="notice">{notice}</p> : null}
      {current.pending && current.video ? <p className="pending">Aranıyor</p> : null}
      <div className="frame">
        <div className="stage" ref={stageRef} />
        <div className="caption">
          <p>{current.video?.title ?? (current.pending ? "Aranıyor" : "nonal")}</p>
          {current.video ? (
            <a
              href={`https://www.youtube.com/channel/${current.video.channelId}`}
              target="_blank"
              rel="noreferrer"
            >
              {current.video.channelTitle}
            </a>
          ) : null}
        </div>
      </div>
    </main>
  );
}
