"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Track } from "@/types";
import { QualityTier, resolveStreamQuality } from "@/lib/audioQuality";
import { useLibrary } from "@/contexts/LibraryContext";

export type RepeatMode = "off" | "all" | "one";

export interface PlayerProgressContextType {
  currentTime: number;
  duration: number;
  seekTo: (seconds: number) => void;
}

export interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  playbackQuality: QualityTier;
  userQueue: Track[];
  contextQueue: Track[];
  history: Track[];
  playTrack: (track: Track, contextList?: Track[], startIndex?: number) => void;
  togglePlayPause: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearUserQueue: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  audioRef: React.RefObject<HTMLAudioElement>;
  currentTime?: number;
  duration?: number;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);
const PlayerProgressContext = createContext<PlayerProgressContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [previousVolume, setPreviousVolume] = useState<number>(0.8);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [userQueue, setUserQueue] = useState<Track[]>([]);
  const [contextQueue, setContextQueue] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [playbackQuality, setPlaybackQuality] = useState<QualityTier>("ULTRA HD");
  const [audioQualityPref, setAudioQualityPref] = useState<string>("HIGH");

  let toggleLikeTrack: ((track: Track) => Promise<boolean>) | undefined;
  try {
    const library = useLibrary();
    toggleLikeTrack = library.toggleLikeTrack;
  } catch {
    // Fallback if rendered outside LibraryProvider in isolated unit tests
  }

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchedTrackIdRef = useRef<string | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytPlayerReadyRef = useRef<boolean>(false);
  const activeSourceRef = useRef<"audio" | "youtube">("audio");
  const isPlayingRef = useRef<boolean>(isPlaying);
  const audioContextRef = useRef<AudioContext | null>(null);
  const retryCountRef = useRef<number>(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPositionStateUpdateRef = useRef<number>(0);

  const onEndedRef = useRef<() => void>(() => {});

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Mobile Web Audio Keep-Alive: Keeps the browser audio hardware session active across track transitions
  const ensureAudioKeepAlive = useCallback(() => {
    try {
      if (typeof window === "undefined") return;
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          // 1-second silent looping buffer
          const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          const gain = ctx.createGain();
          gain.gain.value = 0.001; // inaudible
          source.connect(gain);
          gain.connect(ctx.destination);
          source.start(0);
          audioContextRef.current = ctx;
        }
      }
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume().catch(() => {});
      }
    } catch {
      // AudioContext init fallback
    }
  }, []);


  // Initialize official YouTube Iframe Player in background
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initYT = () => {
      if ((window as any).YT && (window as any).YT.Player && !ytPlayerRef.current) {
        try {
          ytPlayerRef.current = new (window as any).YT.Player("yt-player-element", {
            height: "1",
            width: "1",
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              fs: 0,
              rel: 0,
              playsinline: 1,
            },
            events: {
              onReady: (event: any) => {
                ytPlayerReadyRef.current = true;
                try {
                  event.target.setVolume(isMuted ? 0 : Math.round(volume * 100));
                } catch {}
              },
              onStateChange: (event: any) => {
                if (activeSourceRef.current === "youtube") {
                  // 1 = playing, 2 = paused, 0 = ended
                  if (event.data === 1) {
                    setIsPlaying(true);
                  } else if (event.data === 2) {
                    setIsPlaying(false);
                  } else if (event.data === 0) {
                    onEndedRef.current();
                  }
                }
              },
            },
          });
        } catch (e) {
          console.warn("YouTube iframe player init:", e);
        }
      }
    };

    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      (window as any).onYouTubeIframeAPIReady = initYT;
    } else {
      initYT();
    }
  }, []);

  // Poll current time when YouTube is actively playing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        if (activeSourceRef.current === "youtube" && ytPlayerRef.current?.getCurrentTime) {
          try {
            const cur = ytPlayerRef.current.getCurrentTime();
            const dur = ytPlayerRef.current.getDuration();
            if (typeof cur === "number" && !isNaN(cur)) setCurrentTime(cur);
            if (typeof dur === "number" && !isNaN(dur) && dur > 0) setDuration(dur);
          } catch {}
        }
      }, 300);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Restore player state from localStorage on initial load
  useEffect(() => {
    try {
      const savedVolume = localStorage.getItem("spotify_player_volume");
      if (savedVolume !== null) {
        const parsedVol = parseFloat(savedVolume);
        if (!isNaN(parsedVol) && parsedVol >= 0 && parsedVol <= 1) {
          setVolumeState(parsedVol);
          setPreviousVolume(parsedVol);
        }
      }

      const savedRepeat = localStorage.getItem("spotify_repeat_mode") as RepeatMode;
      if (savedRepeat && ["off", "all", "one"].includes(savedRepeat)) {
        setRepeatMode(savedRepeat);
      }

      const savedShuffle = localStorage.getItem("spotify_shuffle") === "true";
      setIsShuffle(savedShuffle);

      const savedQuality = localStorage.getItem("spotify_audio_quality");
      if (savedQuality) {
        setAudioQualityPref(savedQuality);
      }
      fetch("/api/me/preferences")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.preferences?.audioQuality) {
            setAudioQualityPref(data.preferences.audioQuality);
            try {
              localStorage.setItem("spotify_audio_quality", data.preferences.audioQuality);
            } catch {}
          }
        })
        .catch(() => {});
    } catch {
      // ignore
    }
  }, []);

  // Sync volume with both audio element and YouTube player
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
    if (ytPlayerRef.current && ytPlayerReadyRef.current) {
      try {
        ytPlayerRef.current.setVolume(isMuted ? 0 : Math.round(volume * 100));
      } catch {}
    }
  }, [volume, isMuted]);

  // Mobile Seamless Handoff: Switch from YouTube Iframe to native HTML5 Audio when tab/browser is backgrounded
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Mobile browser tab / screen minimized or switched
        if (activeSourceRef.current === "youtube" && isPlayingRef.current && currentTrack) {
          try {
            const ytId =
              currentTrack.ytId ||
              currentTrack.audioUrl?.match(/ytId=([a-zA-Z0-9_-]+)/)?.[1];
            if (ytId && ytPlayerRef.current?.getCurrentTime) {
              const currentSeek = ytPlayerRef.current.getCurrentTime() || currentTime;
              try {
                ytPlayerRef.current.pauseVideo?.();
              } catch {}

              const streamAudioUrl = `/api/stream?ytId=${encodeURIComponent(ytId)}&redirect=true`;
              activeSourceRef.current = "audio";
              if (audioRef.current) {
                audioRef.current.src = streamAudioUrl;
                audioRef.current.currentTime = currentSeek;
                audioRef.current
                  .play()
                  .then(() => setIsPlaying(true))
                  .catch(() => {});
              }
            }
          } catch (e) {
            console.warn("Seamless background handoff error:", e);
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handleVisibilityChange);
    };
  }, [currentTrack, currentTime]);

  // Sync MediaSession playbackState
  useEffect(() => {
    if (typeof window !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [isPlaying]);

  // Handle MediaSession metadata & action handlers for Mobile Lockscreen / Notification Shade
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    if (currentTrack) {
      const coverUrl =
        currentTrack.album?.coverUrl ||
        "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=512&h=512&fit=crop";

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist?.name || "Unknown Artist",
        album: currentTrack.album?.title || "Unknown Album",
        artwork: [
          { src: coverUrl, sizes: "96x96", type: "image/jpeg" },
          { src: coverUrl, sizes: "128x128", type: "image/jpeg" },
          { src: coverUrl, sizes: "192x192", type: "image/jpeg" },
          { src: coverUrl, sizes: "256x256", type: "image/jpeg" },
          { src: coverUrl, sizes: "384x384", type: "image/jpeg" },
          { src: coverUrl, sizes: "512x512", type: "image/jpeg" },
        ],
      });
    }

    try {
      navigator.mediaSession.setActionHandler("play", () => {
        ensureAudioKeepAlive();
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler("pause", () => togglePlayPause());
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        ensureAudioKeepAlive();
        nextTrack();
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        ensureAudioKeepAlive();
        previousTrack();
      });
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime !== undefined) {
          seekTo(details.seekTime);
        }
      });
      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        const offset = details.seekOffset || 10;
        const cur = audioRef.current?.currentTime ?? currentTime ?? 0;
        seekTo(Math.max(0, cur - offset));
      });
      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        const offset = details.seekOffset || 10;
        const cur = audioRef.current?.currentTime ?? currentTime ?? 0;
        const maxDur = duration || 9999;
        seekTo(Math.min(maxDur, cur + offset));
      });
      navigator.mediaSession.setActionHandler("stop", () => {
        if (audioRef.current) audioRef.current.pause();
        if (ytPlayerRef.current) {
          try {
            ytPlayerRef.current.pauseVideo?.();
          } catch {}
        }
        setIsPlaying(false);
      });
    } catch {
      // Ignore unsupported action handler errors on older mobile engines
    }
  }, [currentTrack, duration, currentTime, ensureAudioKeepAlive]);

  // Sync MediaSession positionState for Mobile Lockscreen Scrubber
  const updateMediaSessionPositionState = useCallback((cur: number, dur: number) => {
    if (
      typeof window !== "undefined" &&
      "mediaSession" in navigator &&
      "setPositionState" in navigator.mediaSession &&
      dur > 0 &&
      !isNaN(cur) &&
      !isNaN(dur)
    ) {
      const now = Date.now();
      if (now - lastPositionStateUpdateRef.current >= 1000) {
        lastPositionStateUpdateRef.current = now;
        try {
          navigator.mediaSession.setPositionState({
            duration: Math.max(0, dur),
            playbackRate: 1,
            position: Math.max(0, Math.min(dur, cur)),
          });
        } catch {}
      }
    }
  }, []);

  const playViaDirectAudio = (url: string) => {
    ensureAudioKeepAlive();
    activeSourceRef.current = "audio";
    try {
      ytPlayerRef.current?.stopVideo?.();
    } catch {}
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(true));
    }
  };

  const playViaYouTube = (ytId: string) => {
    ensureAudioKeepAlive();

    // If browser is already backgrounded or screen locked, mobile OS blocks YouTube iframe.
    // Seamlessly route straight to native audio stream!
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      playViaDirectAudio(`/api/stream?ytId=${encodeURIComponent(ytId)}&redirect=true`);
      return;
    }

    activeSourceRef.current = "youtube";
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {}
    }
    if (ytPlayerRef.current && ytPlayerReadyRef.current) {
      try {
        ytPlayerRef.current.loadVideoById(ytId, 0);
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
      } catch {
        setIsPlaying(true);
      }
    } else {
      // If YT iframe is still loading, wait 300ms
      setTimeout(() => {
        if (ytPlayerRef.current) {
          try {
            ytPlayerRef.current.loadVideoById(ytId, 0);
            ytPlayerRef.current.playVideo();
            setIsPlaying(true);
          } catch {}
        }
      }, 350);
    }
  };


  const playTrack = (track: Track, contextList?: Track[], startIndex?: number) => {
    prefetchedTrackIdRef.current = null;
    setCurrentTrack(track);
    setCurrentTime(0);

    if (contextList && contextList.length > 0) {
      const idx = startIndex !== undefined ? startIndex : contextList.findIndex((t) => t.id === track.id);
      if (idx !== -1) {
        setContextQueue(contextList.slice(idx + 1));
      } else {
        setContextQueue(contextList);
      }
    }

    // Add to history
    setHistory((prev) => [track, ...prev.filter((t) => t.id !== track.id)].slice(0, 50));

    // Log play to backend
    try {
      fetch("/api/me/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: track.id }),
      }).catch(() => {});
    } catch {}

    // Determine preferred streaming bitrate
    let prefBitrate: "96" | "160" | "320" = "320";
    if (audioQualityPref === "LOW") prefBitrate = "96";
    else if (audioQualityPref === "NORMAL") prefBitrate = "160";

    // 1. Direct CDN audio URL (e.g. JioSaavn 320kbps CDN https://aac.saavncdn.com/...)
    if (
      track.audioUrl &&
      (track.audioUrl.startsWith("http://") || track.audioUrl.startsWith("https://")) &&
      !track.audioUrl.includes("/api/stream") &&
      !track.audioUrl.includes("youtube.com")
    ) {
      let activeUrl = track.audioUrl;
      if (activeUrl.includes(".saavncdn.com")) {
        activeUrl = activeUrl.replace(/_(?:96|160|320)\./, `_${prefBitrate}.`);
      }
      const qInfo = resolveStreamQuality(activeUrl, "jiosaavn", audioQualityPref);
      setPlaybackQuality(qInfo.tier);
      playViaDirectAudio(activeUrl);
      return;
    }

    // 2. Direct YouTube ID
    const ytMatch = track.ytId || track.audioUrl?.match(/ytId=([a-zA-Z0-9_-]+)/)?.[1];
    if (ytMatch) {
      track.ytId = ytMatch;
      const qInfo = resolveStreamQuality(track.audioUrl, "youtube", audioQualityPref);
      setPlaybackQuality(qInfo.tier);
      playViaYouTube(ytMatch);
      return;
    }

    // 3. Resolve stream on demand with strict studio matching
    const queryUrl = track.audioUrl?.startsWith("/api/stream")
      ? `${track.audioUrl}${track.audioUrl.includes("?") ? "&" : "?"}format=json&bitrate=${prefBitrate}`
      : `/api/stream?format=json&title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist?.name || "")}&duration=${track.duration || 0}&bitrate=${prefBitrate}`;

    fetch(queryUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.qualityTier) {
          setPlaybackQuality(data.qualityTier);
        } else {
          setPlaybackQuality(resolveStreamQuality(data.audioUrl, data.source, audioQualityPref).tier);
        }
        if (data.source === "jiosaavn" && data.audioUrl && data.audioUrl.startsWith("http")) {
          track.audioUrl = data.audioUrl;
          playViaDirectAudio(data.audioUrl);
        } else if (data.ytId) {
          track.ytId = data.ytId;
          playViaYouTube(data.ytId);
        } else if (data.audioUrl) {
          track.audioUrl = data.audioUrl;
          playViaDirectAudio(data.audioUrl);
        }
      })
      .catch(() => {
        setIsPlaying(true);
      });
  };

  const togglePlayPause = () => {
    if (!currentTrack) return;

    if (activeSourceRef.current === "youtube") {
      if (isPlayingRef.current) {
        try {
          ytPlayerRef.current?.pauseVideo?.();
        } catch {}
        setIsPlaying(false);
      } else {
        try {
          ytPlayerRef.current?.playVideo?.();
        } catch {}
        setIsPlaying(true);
      }
      return;
    }

    if (!audioRef.current) return;
    if (isPlayingRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(true));
    }
  };

  const seekTo = (seconds: number) => {
    const clamped = Math.max(0, Math.min(duration || 9999, seconds));
    if (activeSourceRef.current === "youtube") {
      try {
        ytPlayerRef.current?.seekTo?.(clamped, true);
      } catch {}
      setCurrentTime(clamped);
      return;
    }

    if (!audioRef.current) return;
    audioRef.current.currentTime = clamped;
    setCurrentTime(clamped);
  };

  const setVolume = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    try {
      ytPlayerRef.current?.setVolume?.(Math.round(clamped * 100));
    } catch {}
    try {
      localStorage.setItem("spotify_player_volume", clamped.toString());
    } catch {
      // ignore
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      setVolumeState(previousVolume || 0.5);
      if (audioRef.current) audioRef.current.volume = previousVolume || 0.5;
      try {
        ytPlayerRef.current?.unMute?.();
        ytPlayerRef.current?.setVolume?.(Math.round((previousVolume || 0.5) * 100));
      } catch {}
    } else {
      setPreviousVolume(volume);
      setIsMuted(true);
      setVolumeState(0);
      if (audioRef.current) audioRef.current.volume = 0;
      try {
        ytPlayerRef.current?.mute?.();
      } catch {}
    }
  };

  const nextTrack = () => {
    // 1. Check user manual queue first
    if (userQueue.length > 0) {
      const next = userQueue[0];
      setUserQueue((prev) => prev.slice(1));
      playTrack(next);
      return;
    }

    // 2. Check context queue (album/playlist sequence)
    if (contextQueue.length > 0) {
      let nextIndex = 0;
      if (isShuffle && contextQueue.length > 1) {
        nextIndex = Math.floor(Math.random() * contextQueue.length);
      }
      const next = contextQueue[nextIndex];
      const remaining = contextQueue.filter((_, idx) => idx !== nextIndex);
      setContextQueue(remaining);
      playTrack(next);
      return;
    }

    // 3. Handle repeat mode
    if (repeatMode === "all" && history.length > 0) {
      const first = history[history.length - 1];
      playTrack(first);
      return;
    }

    // 4. Autoplay: dynamically fetch recommendations to keep music playing indefinitely
    if (currentTrack) {
      fetch(`/api/recommendations?seed_tracks=${currentTrack.id}&limit=6`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.tracks && data.tracks.length > 0) {
            const [firstRec, ...restRecs] = data.tracks;
            setContextQueue(restRecs);
            playTrack(firstRec);
          } else {
            setIsPlaying(false);
            setCurrentTime(0);
          }
        })
        .catch(() => {
          setIsPlaying(false);
          setCurrentTime(0);
        });
      return;
    }

    // End of playback
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const previousTrack = () => {
    if (!audioRef.current) return;

    // Spotify standard: If more than 3 seconds in, restart current track
    if (currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    // Otherwise, play previous track from history
    if (history.length > 1) {
      const prev = history[1];
      setHistory((prevList) => prevList.slice(1));
      playTrack(prev);
    } else {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const addToQueue = (track: Track) => {
    setUserQueue((prev) => [...prev, track]);
  };

  const playNext = (track: Track) => {
    setUserQueue((prev) => [track, ...prev]);
  };

  const removeFromQueue = (index: number) => {
    setUserQueue((prev) => prev.filter((_, idx) => idx !== index));
  };

  const clearUserQueue = () => {
    setUserQueue([]);
  };

  const toggleShuffle = () => {
    const nextVal = !isShuffle;
    setIsShuffle(nextVal);
    try {
      localStorage.setItem("spotify_shuffle", nextVal.toString());
    } catch {
      // ignore
    }
  };

  const cycleRepeat = () => {
    const modes: RepeatMode[] = ["off", "all", "one"];
    const nextIdx = (modes.indexOf(repeatMode) + 1) % modes.length;
    const nextMode = modes[nextIdx];
    setRepeatMode(nextMode);
    try {
      localStorage.setItem("spotify_repeat_mode", nextMode);
    } catch {
      // ignore
    }
  };

  // Audio event listeners
  const onTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime;
      const dur = audioRef.current.duration || duration || 0;
      setCurrentTime(cur);
      retryCountRef.current = 0; // Reset network retry counter on healthy progress
      updateMediaSessionPositionState(cur, dur);

      // Predictive Next-Track Prefetching:
      // When at 70% duration or <= 25s remaining, pre-resolve next track stream URL in advance
      // so track-to-track transition in the background is instantaneous and won't trigger mobile autoplay locks
      if (dur > 0 && (cur / dur >= 0.7 || dur - cur <= 25) && currentTrack) {
        if (prefetchedTrackIdRef.current !== currentTrack.id) {
          prefetchedTrackIdRef.current = currentTrack.id;
          const next = userQueue[0] || contextQueue[0];
          if (next && (!next.audioUrl || next.audioUrl.startsWith("/api/stream?title="))) {
            let prefBitrate: "96" | "160" | "320" = "320";
            if (audioQualityPref === "LOW") prefBitrate = "96";
            else if (audioQualityPref === "NORMAL") prefBitrate = "160";

            const queryUrl = next.audioUrl?.startsWith("/api/stream")
              ? `${next.audioUrl}&format=json&bitrate=${prefBitrate}`
              : `/api/stream?format=json&title=${encodeURIComponent(next.title)}&artist=${encodeURIComponent(next.artist?.name || "")}&duration=${next.duration || 0}&bitrate=${prefBitrate}`;

            fetch(queryUrl)
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (data?.audioUrl) {
                  next.audioUrl = data.audioUrl;
                } else if (data?.ytId) {
                  next.ytId = data.ytId;
                  next.audioUrl = `/api/stream?ytId=${encodeURIComponent(data.ytId)}&redirect=true`;
                }
              })
              .catch(() => {});
          }
        }
      }
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration || currentTrack?.duration || 0;
      setDuration(dur);
      updateMediaSessionPositionState(audioRef.current.currentTime || 0, dur);
    }
  };

  const onEnded = () => {
    if (repeatMode === "one") {
      if (activeSourceRef.current === "youtube") {
        try {
          ytPlayerRef.current?.seekTo?.(0, true);
          ytPlayerRef.current?.playVideo?.();
        } catch {}
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } else {
      ensureAudioKeepAlive();
      nextTrack();
    }
  };
  onEndedRef.current = onEnded;

  // Background Network Error Recovery with Exponential Backoff (1s, 2s, 4s)
  const onAudioError = () => {
    if (!currentTrack || !audioRef.current) return;

    if (retryCountRef.current < 3) {
      const delay = Math.pow(2, retryCountRef.current) * 1000;
      retryCountRef.current += 1;

      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = setTimeout(() => {
        const savedTime = audioRef.current?.currentTime || currentTime || 0;
        let prefBitrate: "96" | "160" | "320" = "320";
        if (audioQualityPref === "LOW") prefBitrate = "96";
        else if (audioQualityPref === "NORMAL") prefBitrate = "160";

        fetch(
          `/api/stream?format=json&title=${encodeURIComponent(currentTrack.title)}&artist=${encodeURIComponent(currentTrack.artist?.name || "")}&duration=${currentTrack.duration || 0}&bitrate=${prefBitrate}`
        )
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.audioUrl && audioRef.current) {
              audioRef.current.src = data.audioUrl;
              audioRef.current.currentTime = savedTime;
              audioRef.current
                .play()
                .then(() => setIsPlaying(true))
                .catch(() => {});
            }
          })
          .catch(() => {});
      }, delay);
    }
  };

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // Spacebar: Play / Pause
      if (e.code === "Space") {
        e.preventDefault();
        if (target.tagName === "BUTTON") {
          target.blur();
        }
        togglePlayPause();
      }

      // Ctrl + Right Arrow: Next Track
      if ((e.ctrlKey || e.metaKey) && e.code === "ArrowRight") {
        e.preventDefault();
        nextTrack();
      }

      // Ctrl + Left Arrow: Previous Track
      if ((e.ctrlKey || e.metaKey) && e.code === "ArrowLeft") {
        e.preventDefault();
        previousTrack();
      }

      // Ctrl + S: Toggle Shuffle
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        toggleShuffle();
      }

      // Ctrl + R: Cycle Repeat
      if ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        cycleRepeat();
      }

      // M: Toggle Mute
      if (e.key === "m" || e.key === "M") {
        if (!e.ctrlKey && !e.metaKey) {
          toggleMute();
        }
      }

      // Ctrl + Up Arrow: Volume Up
      if ((e.ctrlKey || e.metaKey) && e.code === "ArrowUp") {
        e.preventDefault();
        setVolume(Math.min(1, volume + 0.05));
      }

      // Ctrl + Down Arrow: Volume Down
      if ((e.ctrlKey || e.metaKey) && e.code === "ArrowDown") {
        e.preventDefault();
        setVolume(Math.max(0, volume - 0.05));
      }

      // Alt + Shift + B (Spotify Desktop) or L (when not typing in an input): Toggle Like on current track
      if (
        currentTrack &&
        toggleLikeTrack &&
        ((e.altKey && e.shiftKey && (e.key === "b" || e.key === "B")) ||
          (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "l" || e.key === "L")))
      ) {
        e.preventDefault();
        toggleLikeTrack(currentTrack);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, currentTrack, volume, isMuted, isShuffle, repeatMode, userQueue, contextQueue, toggleLikeTrack]);

  // Decoupled player value: Does NOT re-create reference on progress ticks (saving hundreds of component re-renders)
  const playerValue = useMemo<PlayerContextType>(
    () => ({
      currentTrack,
      isPlaying,
      volume,
      isMuted,
      isShuffle,
      repeatMode,
      playbackQuality,
      userQueue,
      contextQueue,
      history,
      playTrack,
      togglePlayPause,
      seekTo,
      setVolume,
      toggleMute,
      nextTrack,
      previousTrack,
      addToQueue,
      playNext,
      removeFromQueue,
      clearUserQueue,
      toggleShuffle,
      cycleRepeat,
      audioRef,
      currentTime,
      duration,
    }),
    [
      currentTrack,
      isPlaying,
      volume,
      isMuted,
      isShuffle,
      repeatMode,
      playbackQuality,
      userQueue,
      contextQueue,
      history,
      playTrack,
      togglePlayPause,
      seekTo,
      setVolume,
      toggleMute,
      nextTrack,
      previousTrack,
      addToQueue,
      playNext,
      removeFromQueue,
      clearUserQueue,
      toggleShuffle,
      cycleRepeat,
    ]
  );

  // Dedicated progress value for scrubber and lyric synchronization
  const progressValue = useMemo<PlayerProgressContextType>(
    () => ({
      currentTime,
      duration,
      seekTo,
    }),
    [currentTime, duration, seekTo]
  );

  return (
    <PlayerContext.Provider value={playerValue}>
      <PlayerProgressContext.Provider value={progressValue}>
        <audio
          ref={audioRef}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onEnded={onEnded}
          onError={onAudioError}
          preload="auto"
          playsInline
        />
        <div
          id="yt-player-container"
          style={{
            position: "fixed",
            top: "-9999px",
            left: "-9999px",
            width: "1px",
            height: "1px",
            opacity: 0,
            pointerEvents: "none",
          }}
        >
          <div id="yt-player-element" />
        </div>
        {children}
      </PlayerProgressContext.Provider>
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used within PlayerProvider");
  return context;
}

export function usePlayerProgress() {
  const context = useContext(PlayerProgressContext);
  if (!context) throw new Error("usePlayerProgress must be used within PlayerProvider");
  return context;
}
