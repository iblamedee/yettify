"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// YouTube Player state constants
export const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export type YouTubePlaybackState =
  | "unstarted"
  | "ended"
  | "playing"
  | "paused"
  | "buffering"
  | "cued";

export type YouTubeErrorType =
  | "INVALID_ID"
  | "HTML5_ERROR"
  | "NOT_FOUND"
  | "RESTRICTED"
  | "UNKNOWN";

export interface YouTubePlayerError {
  code: number;
  type: YouTubeErrorType;
  message: string;
  isRestricted: boolean;
  videoId: string;
}

export interface UseYouTubePlayerOptions {
  videoId?: string | null;
  autoPlay?: boolean;
  controls?: boolean;
  initialVolume?: number; // 0 - 100
  initialMuted?: boolean;
  origin?: string;
  onReady?: (player: any) => void;
  onStateChange?: (state: YouTubePlaybackState, rawState: number) => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onError?: (error: YouTubePlayerError) => void;
  onEnded?: () => void;
}

export interface UseYouTubePlayerReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  player: any | null;
  isReady: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  playbackState: YouTubePlaybackState;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  toggleMute: () => void;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
}

// Global script loading state (singleton across all hook instances)
let apiLoadPromise: Promise<any> | null = null;

export function loadYouTubeIframeApi(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cannot load YouTube IFrame API in SSR"));
  }

  const existingYT = (window as any).YT;
  if (existingYT && existingYT.Player) {
    return Promise.resolve(existingYT);
  }

  if (apiLoadPromise) {
    return apiLoadPromise;
  }

  apiLoadPromise = new Promise((resolve, reject) => {
    // Check if script tag is already in DOM
    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
    
    // Store original callback if someone else defined it
    const previousReady = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === "function") {
        try {
          previousReady();
        } catch {}
      }
      resolve((window as any).YT);
    };

    if (!existingScript) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      tag.onerror = () => {
        apiLoadPromise = null;
        reject(new Error("Failed to load YouTube IFrame API script"));
      };
      const firstScriptTag = document.getElementsByTagName("script")[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.head.appendChild(tag);
      }
    }

    // Safety timeout in case callback doesn't fire within 10 seconds
    const timeout = setTimeout(() => {
      const YT = (window as any).YT;
      if (YT && YT.Player) {
        resolve(YT);
      } else {
        apiLoadPromise = null;
        reject(new Error("Timeout loading YouTube IFrame API"));
      }
    }, 10000);

    // If script was already loaded and ready fired before this listener
    const pollInterval = setInterval(() => {
      const YT = (window as any).YT;
      if (YT && YT.Player) {
        clearTimeout(timeout);
        clearInterval(pollInterval);
        resolve(YT);
      }
    }, 50);
  });

  return apiLoadPromise;
}

export function parseYouTubeError(code: number, videoId: string): YouTubePlayerError {
  let type: YouTubeErrorType = "UNKNOWN";
  let message = "An unknown YouTube playback error occurred.";
  let isRestricted = false;

  switch (code) {
    case 2:
      type = "INVALID_ID";
      message = "Invalid YouTube video ID parameter.";
      break;
    case 5:
      type = "HTML5_ERROR";
      message = "The requested content cannot be played in an HTML5 player.";
      break;
    case 100:
      type = "NOT_FOUND";
      message = "Video not found, removed, or marked as private.";
      break;
    case 101:
    case 150:
      type = "RESTRICTED";
      message = "The owner or record label does not allow this video to be played in embedded players.";
      isRestricted = true;
      break;
    case 153:
      type = "RESTRICTED";
      message = "Embedder identity or domain verification restricted by YouTube (Error 153).";
      isRestricted = true;
      break;
  }

  return { code, type, message, isRestricted, videoId };
}

export function mapRawState(state: number): YouTubePlaybackState {
  switch (state) {
    case YT_PLAYER_STATE.UNSTARTED:
      return "unstarted";
    case YT_PLAYER_STATE.ENDED:
      return "ended";
    case YT_PLAYER_STATE.PLAYING:
      return "playing";
    case YT_PLAYER_STATE.PAUSED:
      return "paused";
    case YT_PLAYER_STATE.BUFFERING:
      return "buffering";
    case YT_PLAYER_STATE.CUED:
      return "cued";
    default:
      return "unstarted";
  }
}

export function useYouTubePlayer(options: UseYouTubePlayerOptions = {}): UseYouTubePlayerReturn {
  const {
    videoId,
    autoPlay = false,
    controls = true,
    initialVolume = 100,
    initialMuted = false,
    origin,
    onReady,
    onStateChange,
    onProgress,
    onError,
    onEnded,
  } = options;

  // Unmanaged DOM container ref (never reconciled by React)
  const containerRef = useRef<HTMLDivElement>(null);
  const mountNodeRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any | null>(null);
  const currentVideoIdRef = useRef<string | null>(videoId || null);
  const isDestroyedRef = useRef<boolean>(false);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronized state
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [playbackState, setPlaybackState] = useState<YouTubePlaybackState>("unstarted");
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(initialVolume);
  const [isMuted, setIsMuted] = useState<boolean>(initialMuted);

  // Keep latest callbacks in refs to avoid re-instantiating YT.Player on callback changes
  const callbacksRef = useRef({
    onReady,
    onStateChange,
    onProgress,
    onError,
    onEnded,
  });

  useEffect(() => {
    callbacksRef.current = {
      onReady,
      onStateChange,
      onProgress,
      onError,
      onEnded,
    };
  }, [onReady, onStateChange, onProgress, onError, onEnded]);

  // Keep current videoId in ref
  useEffect(() => {
    currentVideoIdRef.current = videoId || null;
  }, [videoId]);

  const autoPlayRef = useRef<boolean>(autoPlay);
  useEffect(() => {
    autoPlayRef.current = autoPlay;
  }, [autoPlay]);

  const controlsRef = useRef<boolean>(controls);
  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  // Player controls
  const playVideo = useCallback(() => {
    if (playerRef.current && typeof playerRef.current.playVideo === "function") {
      try {
        playerRef.current.playVideo();
      } catch {}
    }
  }, []);

  const pauseVideo = useCallback(() => {
    if (playerRef.current && typeof playerRef.current.pauseVideo === "function") {
      try {
        playerRef.current.pauseVideo();
      } catch {}
    }
  }, []);

  const seekTo = useCallback((seconds: number, allowSeekAhead = true) => {
    if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      try {
        playerRef.current.seekTo(seconds, allowSeekAhead);
        setCurrentTime(seconds);
      } catch {}
    }
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newVolume)));
    setVolumeState(clamped);
    if (playerRef.current && typeof playerRef.current.setVolume === "function") {
      try {
        playerRef.current.setVolume(clamped);
      } catch {}
    }
  }, []);

  const mute = useCallback(() => {
    setIsMuted(true);
    if (playerRef.current && typeof playerRef.current.mute === "function") {
      try {
        playerRef.current.mute();
      } catch {}
    }
  }, []);

  const unMute = useCallback(() => {
    setIsMuted(false);
    if (playerRef.current && typeof playerRef.current.unMute === "function") {
      try {
        playerRef.current.unMute();
      } catch {}
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      unMute();
    } else {
      mute();
    }
  }, [isMuted, mute, unMute]);

  const loadVideoById = useCallback(
    (newVideoId: string, startSeconds = 0) => {
      currentVideoIdRef.current = newVideoId;
      if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
        try {
          playerRef.current.loadVideoById({
            videoId: newVideoId,
            startSeconds,
          });
        } catch {
          // If player instance is corrupted, it will be recreated
        }
      }
    },
    []
  );

  // Time & progress tracker loop (runs only when playing)
  const startProgressTracking = useCallback(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
        try {
          const cur = playerRef.current.getCurrentTime() || 0;
          const dur = playerRef.current.getDuration() || 0;
          setCurrentTime(cur);
          if (dur > 0) setDuration(dur);
          callbacksRef.current.onProgress?.(cur, dur);
        } catch {}
      }
    }, 250);
  }, []);

  const stopProgressTracking = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  // Initialize YT.Player safely on unmanaged mounting node
  useEffect(() => {
    isDestroyedRef.current = false;
    let isCancelled = false;

    // Build unmanaged target node inside containerRef to prevent React reconciliation interference
    if (!containerRef.current) return;

    if (!mountNodeRef.current) {
      const mountNode = document.createElement("div");
      mountNode.className = "w-full h-full";
      containerRef.current.appendChild(mountNode);
      mountNodeRef.current = mountNode;
    }

    loadYouTubeIframeApi()
      .then((YT) => {
        if (isCancelled || isDestroyedRef.current || !mountNodeRef.current) return;

        // Player event handlers
        const handleReady = (event: any) => {
          if (isCancelled || isDestroyedRef.current) return;
          setIsReady(true);

          try {
            if (initialMuted) {
              event.target.mute();
            } else {
              event.target.setVolume(initialVolume);
            }

            const dur = event.target.getDuration() || 0;
            if (dur > 0) setDuration(dur);

            if (autoPlayRef.current && currentVideoIdRef.current) {
              event.target.playVideo();
            }
          } catch {}

          callbacksRef.current.onReady?.(event.target);
        };

        const handleStateChange = (event: any) => {
          if (isCancelled || isDestroyedRef.current) return;
          const rawState = event.data;
          const stateName = mapRawState(rawState);

          setPlaybackState(stateName);

          if (rawState === YT_PLAYER_STATE.PLAYING) {
            setIsPlaying(true);
            setIsBuffering(false);
            startProgressTracking();
          } else if (rawState === YT_PLAYER_STATE.BUFFERING) {
            setIsBuffering(true);
          } else {
            setIsPlaying(false);
            setIsBuffering(false);
            stopProgressTracking();
          }

          if (rawState === YT_PLAYER_STATE.ENDED) {
            callbacksRef.current.onEnded?.();
          }

          callbacksRef.current.onStateChange?.(stateName, rawState);
        };

        const handleError = (event: any) => {
          if (isCancelled || isDestroyedRef.current) return;
          const parsedError = parseYouTubeError(
            event.data,
            currentVideoIdRef.current || ""
          );
          callbacksRef.current.onError?.(parsedError);
        };

        // Create the YouTube Player instance with hardened privacy-enhanced host and explicit origin verification
        playerRef.current = new YT.Player(mountNodeRef.current, {
          host: "https://www.youtube-nocookie.com",
          videoId: currentVideoIdRef.current || undefined,
          playerVars: {
            autoplay: autoPlayRef.current ? 1 : 0,
            controls: controlsRef.current ? 1 : 0,
            playsinline: 1,
            enablejsapi: 1,
            modestbranding: 1,
            rel: 0,
            origin: typeof window !== "undefined" ? window.location.origin : undefined,
          },
          events: {
            onReady: handleReady,
            onStateChange: handleStateChange,
            onError: handleError,
          },
        });
      })
      .catch((err) => {
        if (!isCancelled) {
          callbacksRef.current.onError?.({
            code: -1,
            type: "HTML5_ERROR",
            message: err.message || "Failed to initialize YouTube IFrame API",
            isRestricted: false,
            videoId: currentVideoIdRef.current || "",
          });
        }
      });

    return () => {
      isCancelled = true;
      isDestroyedRef.current = true;
      stopProgressTracking();

      if (playerRef.current) {
        try {
          if (typeof playerRef.current.destroy === "function") {
            playerRef.current.destroy();
          }
        } catch {}
        playerRef.current = null;
      }

      if (mountNodeRef.current && mountNodeRef.current.parentNode) {
        try {
          mountNodeRef.current.parentNode.removeChild(mountNodeRef.current);
        } catch {}
        mountNodeRef.current = null;
      }

      setIsReady(false);
      setIsPlaying(false);
    };
  }, []);

  // Reactive Play / Pause synchronization without destroying the player
  useEffect(() => {
    if (!isReady || !playerRef.current) return;
    try {
      if (autoPlay) {
        if (typeof playerRef.current.playVideo === "function") {
          playerRef.current.playVideo();
        }
      } else {
        if (typeof playerRef.current.pauseVideo === "function") {
          playerRef.current.pauseVideo();
        }
      }
    } catch {}
  }, [autoPlay, isReady]);

  // Reactive Volume synchronization
  useEffect(() => {
    if (!isReady || !playerRef.current) return;
    try {
      const clamped = Math.max(0, Math.min(100, Math.round(initialVolume)));
      if (typeof playerRef.current.setVolume === "function") {
        playerRef.current.setVolume(clamped);
      }
    } catch {}
  }, [initialVolume, isReady]);

  // Reactive Mute synchronization
  useEffect(() => {
    if (!isReady || !playerRef.current) return;
    try {
      if (initialMuted) {
        if (typeof playerRef.current.mute === "function") {
          playerRef.current.mute();
        }
      } else {
        if (typeof playerRef.current.unMute === "function") {
          playerRef.current.unMute();
        }
      }
    } catch {}
  }, [initialMuted, isReady]);

  // Load new videoId when prop changes on existing player instance
  useEffect(() => {
    if (videoId && isReady && playerRef.current) {
      if (currentVideoIdRef.current !== videoId) {
        currentVideoIdRef.current = videoId;
        loadVideoById(videoId);
      }
    }
  }, [videoId, isReady, loadVideoById]);

  return {
    containerRef,
    player: playerRef.current,
    isReady,
    isPlaying,
    isBuffering,
    playbackState,
    currentTime,
    duration,
    volume,
    isMuted,
    playVideo,
    pauseVideo,
    seekTo,
    setVolume,
    mute,
    unMute,
    toggleMute,
    loadVideoById,
  };
}
