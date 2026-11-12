"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Track } from "@/types";
import { QualityTier, resolveStreamQuality } from "@/lib/audioQuality";
import { useLibrary } from "@/contexts/LibraryContext";
import { useUI } from "@/contexts/UIContext";

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
  activeEngine: "audio" | "youtube";
  isVideoMode: boolean;
  setIsVideoMode: (val: boolean) => void;
  toggleVideoMode: () => void;
  activeYtVideoId: string | null;
  setYtPlayerInstance: (player: any) => void;
  currentTime?: number;
  duration?: number;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);
const PlayerProgressContext = createContext<PlayerProgressContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useUI();
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
  const currentTrackRef = useRef<Track | null>(null);
  const prefetchedTrackIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const retryCountRef = useRef<number>(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPositionStateUpdateRef = useRef<number>(0);

  const [activeEngine, setActiveEngine] = useState<"audio" | "youtube">("audio");
  const [isVideoMode, setIsVideoMode] = useState<boolean>(false);
  const [activeYtVideoId, setActiveYtVideoId] = useState<string | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const activeEngineRef = useRef<"audio" | "youtube">("audio");
  const activeYtVideoIdRef = useRef<string | null>(null);

  const toggleVideoMode = useCallback(() => {
    setIsVideoMode((prev) => !prev);
  }, []);

  useEffect(() => {
    activeEngineRef.current = activeEngine;
  }, [activeEngine]);

  useEffect(() => {
    activeYtVideoIdRef.current = activeYtVideoId;
  }, [activeYtVideoId]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  // Load YouTube IFrame API script once
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
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

  // Sync volume with HTML5 audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Sync MediaSession positionState for Mobile Lockscreen / Notification Scrubber
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

  // Sync MediaSession playbackState
  useEffect(() => {
    if (typeof window !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [isPlaying]);

  const nextTrackRef = useRef<() => void>(() => {});

  const setYtPlayerInstance = useCallback((player: any) => {
    ytPlayerRef.current = player;
  }, []);

  const initOrLoadYtPlayer = useCallback(
    (videoId: string) => {
      setActiveEngine("youtube");
      setActiveYtVideoId(videoId);
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === "function") {
        try {
          ytPlayerRef.current.loadVideoById(videoId);
          ytPlayerRef.current.setVolume(isMuted ? 0 : volume * 100);
          ytPlayerRef.current.playVideo();
        } catch {}
      }
    },
    [isMuted, volume]
  );

  // Sync YouTube playback progress when YouTube engine is active
  useEffect(() => {
    if (activeEngine !== "youtube") return;
    const interval = setInterval(() => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === "function") {
        try {
          const cur = ytPlayerRef.current.getCurrentTime() || 0;
          const dur = ytPlayerRef.current.getDuration() || duration || 0;
          setCurrentTime(cur);
          if (dur > 0 && dur !== duration) {
            setDuration(dur);
          }
          updateMediaSessionPositionState(cur, dur);
        } catch {}
      }
    }, 250);
    return () => clearInterval(interval);
  }, [activeEngine, duration, updateMediaSessionPositionState]);

  // Play audio directly through native HTML5 audio element
  const playViaDirectAudio = (url: string) => {
    setActiveEngine("audio");
    if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === "function") {
      try {
        ytPlayerRef.current.pauseVideo();
      } catch {}
    }
    if (!audioRef.current) return;
    if (audioRef.current.src !== url) {
      audioRef.current.src = url;
    }
    audioRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
        if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
      })
      .catch(() => {
        // Autoplay may wait for user interaction or buffer readiness
        setIsPlaying(true);
      });
  };

  const playTrack = (track: Track, contextList?: Track[], startIndex?: number) => {
    prefetchedTrackIdRef.current = null;
    retryCountRef.current = 0;
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

    // 1. Direct CDN audio URL (e.g. JioSaavn 320kbps CDN https://aac.saavncdn.com/... or sample MP3)
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

    // 2. Strict 1:1 Client-Side YouTube Playback:
    // If the track has any YouTube ID (covers, slowed + reverb, live versions, remixes, or user-selected video),
    // immediately stream that exact video client-side in the docked mini-player with 0ms server latency!
    const ytMatch = track.ytId || track.audioUrl?.match(/ytId=([a-zA-Z0-9_-]+)/)?.[1];
    const activeYtId = ytMatch || track.ytId || (track.id.startsWith("yt_") ? track.id.replace(/^yt_/, "") : null);

    if (activeYtId) {
      track.ytId = activeYtId;
      track.source = "youtube";
      setPlaybackQuality("HD");
      initOrLoadYtPlayer(activeYtId);
      return;
    }

    // 3. Official Catalog Stream Resolution (e.g. Spotify metadata / search tracks without direct URL)
    const queryUrl = activeYtId
      ? `/api/stream?format=json&ytId=${encodeURIComponent(activeYtId)}&title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist?.name || "")}&duration=${track.duration || 0}&bitrate=${prefBitrate}`
      : track.audioUrl?.startsWith("/api/stream")
      ? `${track.audioUrl}${track.audioUrl.includes("?") ? "&" : "?"}format=json&bitrate=${prefBitrate}`
      : `/api/stream?format=json&title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist?.name || "")}&duration=${track.duration || 0}&bitrate=${prefBitrate}`;

    setIsPlaying(true);

    fetch(queryUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) {
          if (activeYtId) {
            initOrLoadYtPlayer(activeYtId);
          }
          return;
        }

        if (data.qualityTier) {
          setPlaybackQuality(data.qualityTier);
        } else if (data.audioUrl) {
          setPlaybackQuality(resolveStreamQuality(data.audioUrl, data.source, audioQualityPref).tier);
        }

        // If JioSaavn has clean studio audio (or CDN direct link)
        if (data.audioUrl && data.audioUrl.startsWith("http") && !data.requiresClientPlayback) {
          track.audioUrl = data.audioUrl;
          if (data.source) track.source = data.source;
          playViaDirectAudio(data.audioUrl);
          return;
        }

        // Fallback to client-side YouTube player (runs on user's residential IP)
        const targetYtId = data.ytId || activeYtId;
        if (targetYtId) {
          track.ytId = targetYtId;
          track.source = "youtube";
          setPlaybackQuality("HD");
          initOrLoadYtPlayer(targetYtId);
        } else {
          showToast("Unable to play track audio.", "error");
          setIsPlaying(false);
        }
      })
      .catch(() => {
        if (activeYtId) {
          initOrLoadYtPlayer(activeYtId);
        } else {
          setIsPlaying(false);
        }
      });
  };

  const togglePlayPause = () => {
    if (!currentTrack) return;

    if (activeEngine === "youtube") {
      if (isPlayingRef.current) {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === "function") {
          try {
            ytPlayerRef.current.pauseVideo();
          } catch {}
        }
        setIsPlaying(false);
        if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
      } else {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === "function") {
          try {
            ytPlayerRef.current.playVideo();
          } catch {}
        }
        setIsPlaying(true);
        if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
      }
      return;
    }

    if (!audioRef.current) return;

    if (isPlayingRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
    } else {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
        })
        .catch(() => setIsPlaying(true));
    }
  };

  const seekTo = (seconds: number) => {
    const clamped = Math.max(0, Math.min(duration || 9999, seconds));
    if (activeEngine === "youtube") {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === "function") {
        try {
          ytPlayerRef.current.seekTo(clamped, true);
        } catch {}
      }
    } else if (audioRef.current) {
      audioRef.current.currentTime = clamped;
    }
    setCurrentTime(clamped);
    updateMediaSessionPositionState(clamped, duration);
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
    if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === "function") {
      try {
        ytPlayerRef.current.setVolume(clamped * 100);
      } catch {}
    }
    try {
      localStorage.setItem("spotify_player_volume", clamped.toString());
    } catch {
      // ignore
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      const targetVol = previousVolume || 0.5;
      setVolumeState(targetVol);
      if (audioRef.current) audioRef.current.volume = targetVol;
      if (ytPlayerRef.current && typeof ytPlayerRef.current.unMute === "function") {
        try {
          ytPlayerRef.current.unMute();
          ytPlayerRef.current.setVolume(targetVol * 100);
        } catch {}
      }
    } else {
      setPreviousVolume(volume);
      setIsMuted(true);
      setVolumeState(0);
      if (audioRef.current) audioRef.current.volume = 0;
      if (ytPlayerRef.current && typeof ytPlayerRef.current.mute === "function") {
        try {
          ytPlayerRef.current.mute();
        } catch {}
      }
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

  useEffect(() => {
    nextTrackRef.current = nextTrack;
  }, [nextTrack]);

  const previousTrack = () => {
    // Spotify standard: If more than 3 seconds in, restart current track
    if (currentTime > 3) {
      seekTo(0);
      return;
    }

    // Otherwise, play previous track from history
    if (history.length > 1) {
      const prev = history[1];
      setHistory((prevList) => prevList.slice(1));
      playTrack(prev);
    } else {
      seekTo(0);
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
                if (data?.audioUrl && data.source === "jiosaavn") {
                  next.audioUrl = data.audioUrl;
                } else if (data?.ytId) {
                  next.ytId = data.ytId;
                  next.audioUrl = `/api/stream?ytId=${encodeURIComponent(data.ytId)}&title=${encodeURIComponent(next.title)}&artist=${encodeURIComponent(next.artist?.name || "")}&redirect=true`;
                } else if (data?.audioUrl) {
                  next.audioUrl = data.audioUrl;
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
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } else {
      nextTrack();
    }
  };

  // Dynamic Stream Self-Healing: If an audio URL expires or fails, recover a fresh stream dynamically
  const onAudioError = () => {
    const track = currentTrackRef.current || currentTrack;
    if (!track || !audioRef.current) return;

    if (retryCountRef.current < 2) {
      retryCountRef.current += 1;
      let prefBitrate: "96" | "160" | "320" = "320";
      if (audioQualityPref === "LOW") prefBitrate = "96";
      else if (audioQualityPref === "NORMAL") prefBitrate = "160";

      fetch(
        `/api/stream?format=json&title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist?.name || "")}&duration=${track.duration || 0}&bitrate=${prefBitrate}`
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.audioUrl && !data?.requiresClientPlayback && audioRef.current) {
            track.audioUrl = data.audioUrl;
            playViaDirectAudio(data.audioUrl);
          } else if (data?.ytId || track.ytId) {
            const fallbackYtId = data?.ytId || track.ytId;
            initOrLoadYtPlayer(fallbackYtId!);
          } else {
            setIsPlaying(false);
            if (data?.restricted) {
              showToast("This stream is restricted on cloud servers. Try a studio track.", "error");
            }
          }
        })
        .catch(() => {
          setIsPlaying(false);
        });
    } else {
      retryCountRef.current = 0;
      setIsPlaying(false);
      showToast("Unable to play this track. Please select another song.", "error");
    }
  };

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
      navigator.mediaSession.setActionHandler("play", () => togglePlayPause());
      navigator.mediaSession.setActionHandler("pause", () => togglePlayPause());
      navigator.mediaSession.setActionHandler("nexttrack", () => nextTrack());
      navigator.mediaSession.setActionHandler("previoustrack", () => previousTrack());
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
        setIsPlaying(false);
      });
    } catch {
      // Ignore unsupported action handler errors on older mobile engines
    }
  }, [currentTrack, duration, currentTime]);

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
      activeEngine,
      isVideoMode,
      setIsVideoMode,
      toggleVideoMode,
      activeYtVideoId,
      setYtPlayerInstance,
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
      activeEngine,
      isVideoMode,
      toggleVideoMode,
      activeYtVideoId,
      setYtPlayerInstance,
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
          onPlay={() => {
            setIsPlaying(true);
            if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
          }}
          onPause={() => {
            setIsPlaying(false);
            if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
          }}
          preload="auto"
          playsInline
        />
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
