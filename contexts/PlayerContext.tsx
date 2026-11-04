"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Track } from "@/types";

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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchedTrackIdRef = useRef<string | null>(null);

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
    } catch {
      // ignore
    }
  }, []);

  // Sync volume with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Handle MediaSession metadata & action handlers
  useEffect(() => {
    if ("mediaSession" in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist?.name || "Unknown Artist",
        album: currentTrack.album?.title || "Unknown Album",
        artwork: [
          {
            src: currentTrack.album?.coverUrl || "/placeholder.png",
            sizes: "512x512",
            type: "image/jpeg",
          },
        ],
      });

      navigator.mediaSession.setActionHandler("play", () => togglePlayPause());
      navigator.mediaSession.setActionHandler("pause", () => togglePlayPause());
      navigator.mediaSession.setActionHandler("nexttrack", () => nextTrack());
      navigator.mediaSession.setActionHandler("previoustrack", () => previousTrack());
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime !== undefined) {
          seekTo(details.seekTime);
        }
      });
    }
  }, [currentTrack]);

  const playTrack = (track: Track, contextList?: Track[], startIndex?: number) => {
    prefetchedTrackIdRef.current = null;
    setCurrentTrack(track);
    setCurrentTime(0);

    if (contextList && contextList.length > 0) {
      const idx = startIndex !== undefined ? startIndex : contextList.findIndex((t) => t.id === track.id);
      if (idx !== -1) {
        // Queue all subsequent tracks from this context
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
    } catch {
      // ignore
    }

    // Audio play
    if (audioRef.current) {
      if (track.audioUrl) {
        audioRef.current.src = track.audioUrl;
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(true));
      } else {
        // Resolve on demand if audioUrl is missing
        fetch(`/api/stream?format=json&title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist?.name || "")}&duration=${track.duration || 0}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.audioUrl && audioRef.current) {
              track.audioUrl = data.audioUrl;
              audioRef.current.src = data.audioUrl;
              audioRef.current
                .play()
                .then(() => setIsPlaying(true))
                .catch(() => setIsPlaying(true));
            }
          })
          .catch(() => setIsPlaying(true));
      }
    }
  };

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const togglePlayPause = () => {
    if (!audioRef.current || !currentTrack) return;

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
    if (!audioRef.current) return;
    const clamped = Math.max(0, Math.min(duration, seconds));
    audioRef.current.currentTime = clamped;
    setCurrentTime(clamped);
  };

  const setVolume = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
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
      setVolumeState(previousVolume || 0.5);
    } else {
      setPreviousVolume(volume);
      setIsMuted(true);
      setVolumeState(0);
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

      // Predictive Next-Track Prefetching:
      // When at 80% duration or <= 20s remaining, pre-resolve next track stream URL in the background
      if (dur > 0 && (cur / dur >= 0.8 || dur - cur <= 20) && currentTrack) {
        if (prefetchedTrackIdRef.current !== currentTrack.id) {
          prefetchedTrackIdRef.current = currentTrack.id;
          const next = userQueue[0] || contextQueue[0];
          if (next && (!next.audioUrl || next.audioUrl.startsWith("/api/stream?title="))) {
            const queryUrl = next.audioUrl?.startsWith("/api/stream")
              ? `${next.audioUrl}&format=json`
              : `/api/stream?format=json&title=${encodeURIComponent(next.title)}&artist=${encodeURIComponent(next.artist?.name || "")}&duration=${next.duration || 0}`;

            fetch(queryUrl)
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (data?.audioUrl) {
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
      setDuration(audioRef.current.duration || currentTrack?.duration || 0);
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

  const onAudioError = () => {
    if (currentTrack && audioRef.current) {
      fetch(`/api/stream?format=json&title=${encodeURIComponent(currentTrack.title)}&artist=${encodeURIComponent(currentTrack.artist?.name || "")}&duration=${currentTrack.duration || 0}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.audioUrl && audioRef.current && data.audioUrl !== audioRef.current.src) {
            audioRef.current.src = data.audioUrl;
            audioRef.current.play().catch(() => {});
          }
        })
        .catch(() => {});
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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, currentTrack, volume, isMuted, isShuffle, repeatMode, userQueue, contextQueue]);

  // Decoupled player value: Does NOT re-create reference on progress ticks (saving hundreds of component re-renders)
  const playerValue = useMemo<PlayerContextType>(
    () => ({
      currentTrack,
      isPlaying,
      volume,
      isMuted,
      isShuffle,
      repeatMode,
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
