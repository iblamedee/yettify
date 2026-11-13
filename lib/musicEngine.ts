import CryptoJS from "crypto-js";
import crypto from "crypto";
import yts from "yt-search";
import { prisma } from "@/lib/prisma";

const SAAVN_DES_KEY = Buffer.from("38346591", "utf-8");
const CRYPTO_JS_KEY = CryptoJS.enc.Utf8.parse("38346591");

export interface GlobalTrack {
  id: string;
  title: string;
  duration: number;
  streamCount: number;
  audioUrl: string;
  lyrics?: string;
  explicit: boolean;
  album: {
    id: string;
    title: string;
    coverUrl: string;
  };
  artist: {
    id: string;
    name: string;
  };
  source?: "youtube" | "spotify" | "jiosaavn";
}

export interface GlobalAlbum {
  id: string;
  title: string;
  coverUrl: string;
  releaseYear: number;
  artist: {
    id?: string;
    name: string;
  };
  trackCount?: number;
  copyright?: string;
}

export function decodeHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

/**
 * Decrypts JioSaavn DES-ECB encrypted media URL into direct 320kbps MP4/AAC stream
 */
export function decryptSaavnUrl(encUrl: string, bitrate: "96" | "160" | "320" = "320"): string | null {
  if (!encUrl) return null;
  try {
    // 1. Ultra-fast native Node.js OpenSSL crypto decipher (50x-100x faster than pure JS)
    if (typeof crypto !== "undefined" && crypto.createDecipheriv) {
      const decipher = crypto.createDecipheriv("des-ecb", SAAVN_DES_KEY, null);
      decipher.setAutoPadding(true);
      let decrypted = decipher.update(encUrl, "base64", "utf-8");
      decrypted += decipher.final("utf-8");
      const rawUrl = decrypted.trim();
      if (rawUrl && rawUrl.startsWith("http")) {
        return rawUrl.replace(/_96\./, `_${bitrate}.`);
      }
    }
  } catch {
    // Fall back to CryptoJS if native decipher encounters an unexpected padding issue
  }

  try {
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Base64.parse(encUrl),
    });
    const decrypted = CryptoJS.DES.decrypt(
      cipherParams,
      CRYPTO_JS_KEY,
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
    );
    const rawUrl = decrypted.toString(CryptoJS.enc.Utf8).trim();
    if (!rawUrl || !rawUrl.startsWith("http")) return null;
    return rawUrl.replace(/_96\./, `_${bitrate}.`);
  } catch {
    return null;
  }
}

export function cleanText(str?: string | null): string {
  return (str || "")
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Strips noise, bracketed tags, and suffixes (e.g. "feat.", "Official Video", "- Single")
 * to improve search indexing and exact catalog matching.
 */
export function stripTrackArtifacts(title?: string | null): string {
  if (!title) return "";
  return title
    .replace(/\s*[\(\[](?:feat\.|featuring|with|prod\.|official|audio|video|remaster(?:ed)?|deluxe|version|edition|single|bonus|extended|mix|visualizer|hq|hd|4k)[^\)\]]*[\)\]]/gi, "")
    .replace(/\s*-\s*(?:feat\.|featuring|with|prod\.|official|audio|video|remaster(?:ed)?|deluxe|version|edition|single|bonus|extended|mix|visualizer).*/gi, "")
    .replace(/\s*-\s*Single$/i, "")
    .trim();
}

export const FORBIDDEN_COVER_KEYWORDS = [
  "cover",
  "karaoke",
  "tribute",
  "instrumental",
  "piano",
  "acoustic",
  "mashup",
  "parody",
  "slowed",
  "reverb",
  "made famous by",
  "originally performed by",
  "in the style of",
  "hit crew",
  "geek music",
  "born to rock",
  "midifine",
  "cover band",
  "lullaby",
  "remake",
  "party tyme",
  "lullapop",
  "the neon crew",
  "zzang karaoke",
  "backing version",
  "melody karaoke",
  "instrumental karaoke",
  "8d audio",
  "8d",
  "sped up",
];

export const FORBIDDEN_COVER_ARTISTS = [
  "lullapop",
  "party tyme",
  "hit crew",
  "geek music",
  "midifine",
  "cover band",
  "the neon crew",
  "zzang karaoke",
  "daneet",
  "ken boss",
  "galex",
  "slawd",
  "pacey",
  "leon leke",
  "alessia brightly",
  "acoustic hits",
  "karaoke hits",
];

// In-memory cache for resolved track audio streams to provide 0ms latency for repeated requests
const streamResolutionCache = new Map<
  string,
  { audioUrl: string; duration?: number; lyrics?: string; coverUrl?: string; source?: string; ytId?: string; requiresClientPlayback?: boolean }
>();

// In-memory cache for YouTube queries to prevent rate limits
const ytQueryCache = new Map<string, any>();

/**
 * Validates whether a JioSaavn song accurately matches the expected title and artist
 */
export async function checkJioSaavnVerified(
  title: string,
  artistName?: string,
  targetDuration?: number,
  bitrate: "96" | "160" | "320" = "320"
): Promise<{ audioUrl: string; duration?: number; lyrics?: string; coverUrl?: string; source: string } | null> {
  const cleanTitle = stripTrackArtifacts(title) || title;
  const queries = [
    [cleanTitle, artistName].filter(Boolean).join(" "),
    [title, artistName].filter(Boolean).join(" "),
    cleanTitle,
  ];
  const uniqueQueries = Array.from(new Set(queries.filter(Boolean)));
  const normTitle = cleanText(title);
  const normBaseTitle = cleanText(cleanTitle);
  const normArtist = cleanText(artistName);

  type ScoredCandidate = {
    audioUrl: string;
    duration: number;
    coverUrl?: string;
    source: string;
    score: number;
    playCount: number;
  };

  const candidates: ScoredCandidate[] = [];

  for (const q of uniqueQueries) {
    try {
      const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_marker=0&api_version=4&_format=json&p=1&n=10&q=${encodeURIComponent(q)}`;
      const res = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!res.ok) continue;
      const data = await res.json();
      const results = data.results || [];

      for (const song of results) {
        const sTitle = song.title || song.song || "";
        const sAlbum = song.album || song.more_info?.album || "";
        const primaryArtistObjs = song.more_info?.artistMap?.primary_artists || [];
        const primaryArtistNames = Array.isArray(primaryArtistObjs) ? primaryArtistObjs.map((a: any) => a.name) : [];

        const artistList = [
          ...primaryArtistNames,
          song.primary_artists,
          song.singers,
          song.more_info?.music,
          ...(song.more_info?.artistMap?.artists?.map((a: any) => a.name) || []),
        ].filter(Boolean);
        const sArtists = artistList.join(" ");

        const sNormTitle = cleanText(sTitle);
        const sNormBaseTitle = cleanText(stripTrackArtifacts(sTitle));
        const sNormArtists = cleanText(sArtists);

        // 1. Forbidden covers, karaoke, and tribute check
        const fullContent = `${sTitle} ${sAlbum} ${sArtists}`.toLowerCase();
        const hasCoverKeyword = FORBIDDEN_COVER_KEYWORDS.some((kw) => fullContent.includes(kw));
        const hasCoverArtist = FORBIDDEN_COVER_ARTISTS.some(
          (ca) => sNormArtists.includes(ca) || sAlbum.toLowerCase().includes(ca)
        );
        const requestedHasKeyword = FORBIDDEN_COVER_KEYWORDS.some((kw) =>
          `${title} ${artistName || ""}`.toLowerCase().includes(kw)
        );
        if ((hasCoverKeyword || hasCoverArtist) && !requestedHasKeyword) {
          continue;
        }

        // 2. Title matching
        let titleScore = 0;
        if (sNormTitle === normTitle || sNormBaseTitle === normBaseTitle) {
          titleScore = 50;
        } else if (
          normBaseTitle.length >= 3 &&
          (sNormBaseTitle.startsWith(normBaseTitle) || normBaseTitle.startsWith(sNormBaseTitle))
        ) {
          titleScore = 35;
        } else if (normBaseTitle.length >= 4 && sNormBaseTitle.includes(normBaseTitle)) {
          titleScore = 25;
        } else {
          continue;
        }

        // 3. Length ratio check (reject mashups and combined songs)
        const lengthRatio = sNormBaseTitle.length / Math.max(1, normBaseTitle.length);
        if (lengthRatio > 1.4 && !normTitle.includes("remix") && !normTitle.includes("mashup")) {
          continue;
        }

        // 4. Strict Artist scoring & validation
        let artistScore = 0;
        if (normArtist && normArtist !== "various artists" && normArtist !== "unknown artist") {
          const primaryNorms = primaryArtistNames.map((n: string) => cleanText(n));
          const matchedPrimary = primaryNorms.some(
            (pn: string) => pn.includes(normArtist) || normArtist.includes(pn)
          );
          const matchedAny =
            normArtist.length >= 3 &&
            (sNormArtists.includes(normArtist) || normArtist.includes(sNormArtists));

          if (matchedPrimary) {
            artistScore = 40;
          } else if (matchedAny) {
            artistScore = 25;
          } else {
            // Strictly reject candidate when artist does not match requested artist!
            continue;
          }
        }

        // 5. Popularity / Play count boost
        const playCount = parseInt(song.play_count || song.more_info?.play_count || "0", 10);
        let popScore = 0;
        if (playCount > 10000000) popScore = 30;
        else if (playCount > 1000000) popScore = 20;
        else if (playCount > 100000) popScore = 10;

        // 6. Duration proximity check
        const sDuration = parseInt(song.duration || song.more_info?.duration || "0", 10);
        let durationScore = 0;
        if (targetDuration && targetDuration > 0 && sDuration > 0) {
          const diff = Math.abs(sDuration - targetDuration);
          if (diff <= 15) durationScore = 15;
          else if (diff <= 40) durationScore = 5;
          else if (diff > 75) continue;
        }

        const totalScore = titleScore + artistScore + popScore + durationScore;

        const encUrl = song.encrypted_media_url || song.more_info?.encrypted_media_url;
        const audioUrl = decryptSaavnUrl(encUrl, bitrate);
        if (audioUrl) {
          const rawImg = song.image || "";
          const coverUrl = rawImg
            ? rawImg.replace(/-(?:50x50|150x150)\.(?:jpg|webp)/, "-500x500.jpg")
            : undefined;
          candidates.push({
            source: "jiosaavn",
            audioUrl,
            duration: isNaN(sDuration) ? 210 : sDuration,
            coverUrl,
            score: totalScore,
            playCount,
          });
        }
      }
    } catch (err) {
      console.error("checkJioSaavnVerified error:", err);
    }
  }

  // 7. Fallback to resilient mobile Android endpoint (unblocked on cloud datacenters / Vercel)
  if (candidates.length === 0) {
    try {
      const mobileQuery = [cleanTitle, artistName].filter(Boolean).join(" ");
      const autoUrl = `https://www.jiosaavn.com/api.php?__call=autocomplete.get&_marker=0&query=${encodeURIComponent(mobileQuery)}&ctx=android&_format=json`;
      const autoRes = await fetch(autoUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36",
        },
      });

      if (autoRes.ok) {
        const autoData = await autoRes.json();
        const songs = autoData?.songs?.data || [];
        const songIds = songs.slice(0, 6).map((s: any) => s.id).filter(Boolean);

        if (songIds.length > 0) {
          const detailsUrl = `https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0&_format=json&pids=${songIds.join(",")}`;
          const detailsRes = await fetch(detailsUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36",
            },
          });

          if (detailsRes.ok) {
            const detailsData = await detailsRes.json();
            for (const id of songIds) {
              const song = detailsData[id];
              if (!song) continue;

              const sTitle = song.title || song.song || "";
              const sAlbum = song.album || song.more_info?.album || "";
              const primaryArtistObjs = song.more_info?.artistMap?.primary_artists || [];
              const primaryArtistNames = Array.isArray(primaryArtistObjs) ? primaryArtistObjs.map((a: any) => a.name) : [];

              const artistList = [
                ...primaryArtistNames,
                song.primary_artists,
                song.singers,
                song.more_info?.music,
                ...(song.more_info?.artistMap?.artists?.map((a: any) => a.name) || []),
              ].filter(Boolean);
              const sArtists = artistList.join(" ");

              const sNormTitle = cleanText(sTitle);
              const sNormBaseTitle = cleanText(stripTrackArtifacts(sTitle));
              const sNormArtists = cleanText(sArtists);

              // Forbidden covers, karaoke, and tribute check
              const fullContent = `${sTitle} ${sAlbum} ${sArtists}`.toLowerCase();
              const hasCoverKeyword = FORBIDDEN_COVER_KEYWORDS.some((kw) => fullContent.includes(kw));
              const hasCoverArtist = FORBIDDEN_COVER_ARTISTS.some(
                (ca) => sNormArtists.includes(ca) || sAlbum.toLowerCase().includes(ca)
              );
              const requestedHasKeyword = FORBIDDEN_COVER_KEYWORDS.some((kw) =>
                `${title} ${artistName || ""}`.toLowerCase().includes(kw)
              );
              if ((hasCoverKeyword || hasCoverArtist) && !requestedHasKeyword) {
                continue;
              }

              // Title matching
              let titleScore = 0;
              if (sNormTitle === normTitle || sNormBaseTitle === normBaseTitle) {
                titleScore = 50;
              } else if (
                normBaseTitle.length >= 3 &&
                (sNormBaseTitle.startsWith(normBaseTitle) || normBaseTitle.startsWith(sNormBaseTitle))
              ) {
                titleScore = 35;
              } else if (normBaseTitle.length >= 4 && sNormBaseTitle.includes(normBaseTitle)) {
                titleScore = 25;
              } else {
                continue;
              }

              // Length ratio check
              const lengthRatio = sNormBaseTitle.length / Math.max(1, normBaseTitle.length);
              if (lengthRatio > 1.4 && !normTitle.includes("remix") && !normTitle.includes("mashup")) {
                continue;
              }

              // Strict Artist scoring & validation
              let artistScore = 0;
              if (normArtist && normArtist !== "various artists" && normArtist !== "unknown artist") {
                const primaryNorms = primaryArtistNames.map((n: string) => cleanText(n));
                const matchedPrimary = primaryNorms.some(
                  (pn: string) => pn.includes(normArtist) || normArtist.includes(pn)
                );
                const matchedAny =
                  normArtist.length >= 3 &&
                  (sNormArtists.includes(normArtist) || normArtist.includes(sNormArtists));

                if (matchedPrimary) {
                  artistScore = 40;
                } else if (matchedAny) {
                  artistScore = 25;
                } else {
                  continue;
                }
              }

              const playCount = parseInt(song.play_count || song.more_info?.play_count || "0", 10);
              let popScore = 0;
              if (playCount > 10000000) popScore = 30;
              else if (playCount > 1000000) popScore = 20;
              else if (playCount > 100000) popScore = 10;

              const sDuration = parseInt(song.duration || song.more_info?.duration || "0", 10);
              let durationScore = 0;
              if (targetDuration && targetDuration > 0 && sDuration > 0) {
                const diff = Math.abs(sDuration - targetDuration);
                if (diff <= 15) durationScore = 15;
                else if (diff <= 40) durationScore = 5;
                else if (diff > 75) continue;
              }

              const totalScore = titleScore + artistScore + popScore + durationScore;
              const encUrl = song.encrypted_media_url || song.more_info?.encrypted_media_url;
              const audioUrl = decryptSaavnUrl(encUrl, bitrate);

              if (audioUrl) {
                const rawImg = song.image || "";
                const coverUrl = rawImg
                  ? rawImg.replace(/-(?:50x50|150x150)\.(?:jpg|webp)/, "-500x500.jpg")
                  : undefined;
                candidates.push({
                  source: "jiosaavn",
                  audioUrl,
                  duration: isNaN(sDuration) ? 210 : sDuration,
                  coverUrl,
                  score: totalScore,
                  playCount,
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("checkJioSaavnVerified mobile fallback error:", err);
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.playCount - a.playCount;
  });

  const best = candidates[0];
  if (best.score >= 35) {
    return {
      source: best.source,
      audioUrl: best.audioUrl,
      duration: best.duration,
      coverUrl: best.coverUrl,
    };
  }

  return null;
}

/**
 * Detects whether a YouTube channel enforces third-party web embedding blocks (Error 150/101).
 * Major labels enforce blanket embed restrictions on all VEVO and auto-generated Topic channels.
 */
export function isChannelEmbedRestricted(channelName: string, channelUrl?: string): boolean {
  const norm = (channelName || "").toLowerCase().trim();
  const normUrl = (channelUrl || "").toLowerCase().trim();
  if (norm.includes("vevo") || normUrl.includes("vevo")) return true;
  if (
    norm.endsWith("- topic") ||
    norm.endsWith("-topic") ||
    norm.includes("- topic") ||
    normUrl.includes("-topic")
  ) {
    return true;
  }
  return false;
}

/**
 * Searches and ranks YouTube audio videos with multi-criteria scoring to guarantee the exact official track
 */
export async function resolveBestYouTubeAudio(
  title: string,
  artistName?: string,
  targetDuration?: number
): Promise<{ ytId: string; audioUrl: string; duration: number; coverUrl: string; source: string } | null> {
  const normTitle = cleanText(title);
  const baseTitle = stripTrackArtifacts(title) || title;
  const normBaseTitle = cleanText(baseTitle);
  const normArtist = cleanText(artistName);
  const cacheKey = `${normTitle}:::${normArtist}`;

  if (ytQueryCache.has(cacheKey)) {
    return ytQueryCache.get(cacheKey);
  }

  const queries = [
    `${artistName || ""} ${baseTitle} lyrics`.trim(),
    `${artistName || ""} - ${baseTitle} audio`.trim(),
    `${artistName || ""} - ${baseTitle}`.trim(),
    `${artistName || ""} - ${title}`.trim(),
  ];

  for (const q of queries) {
    if (!q) continue;
    try {
      const res = await yts(q);
      if (!res || !res.videos || res.videos.length === 0) continue;

      const scored = res.videos.map((v: any) => {
        const vTitle = (v.title || "").toLowerCase();
        const vAuthor = (v.author?.name || "").toLowerCase();
        const vAuthorUrl = (v.author?.url || "").toLowerCase();
        const durationSec = v.seconds || 0;
        let score = 0;

        // Skip non-songs (reactions, tutorials, 1-hour loops, podcasts)
        if (durationSec > 900 || durationSec < 40) return { v, score: -100 };
        if (
          vTitle.includes("reaction") ||
          vTitle.includes("reacts") ||
          vTitle.includes("tutorial") ||
          vTitle.includes("how to play") ||
          vTitle.includes("1 hour") ||
          vTitle.includes("10 hours") ||
          vTitle.includes("review")
        ) {
          return { v, score: -100 };
        }

        // Embed Safety: Completely discard VEVO and Topic channels because record labels block third-party iframe embedding (Error 150/101)
        if (isChannelEmbedRestricted(vAuthor, vAuthorUrl)) {
          return { v, score: -100 };
        }

        const vNormTitle = cleanText(vTitle);
        const vNormAuthor = cleanText(vAuthor);

        // Title match
        if (vNormTitle.includes(normTitle) || (normBaseTitle.length >= 3 && vNormTitle.includes(normBaseTitle))) {
          score += 40;
        }

        // Artist match (Strict!)
        if (normArtist) {
          const authorMatches = vNormAuthor.includes(normArtist) || normArtist.includes(vNormAuthor);
          const titleMatches = vNormTitle.includes(normArtist);
          if (authorMatches || titleMatches) {
            score += 40;
            if (authorMatches) score += 20; // Extra boost if author channel itself is artist
          } else {
            // Heavy penalty if artist is specified but neither title nor channel contains it
            score -= 60;
          }
        }

        // Boost verified / official channels (embed-safe)
        if (v.author?.verified || vAuthor.includes("official")) {
          score += 20;
        }
        // Boost embed-friendly lyric videos and clean audio tracks (which never have Error 150 blocks)
        if (vTitle.includes("lyrics") || vTitle.includes("lyric video")) {
          score += 35;
        }
        if (vTitle.includes("audio")) {
          score += 20;
        }

        // Reliability boost for established embed-compliant lyric channels
        const cleanLyricChannels = ["7clouds", "dan music", "shadow music", "taj tracks", "cassiopeia", "unique vibes", "tbt lyrics", "superblyrics", "syrebralvibes"];
        if (cleanLyricChannels.some((c) => vAuthor.includes(c))) {
          score += 40;
        }

        // De-prioritize official music videos (they have movie intros/skits and frequent embedding blocks)
        if (vTitle.includes("official music video") || vTitle.includes("official video")) {
          score -= 30;
        }

        // Cover penalty
        if (
          !normTitle.includes("cover") &&
          (vTitle.includes("cover") ||
            vTitle.includes("karaoke") ||
            vTitle.includes("tribute") ||
            vTitle.includes("instrumental"))
        ) {
          score -= 50;
        }

        // Proximity scoring for duration
        if (targetDuration && targetDuration > 0 && durationSec > 0) {
          const diff = Math.abs(durationSec - targetDuration);
          if (diff < 15) score += 30;
          else if (diff < 35) score += 15;
          else if (diff > 45) score -= 30;
          else if (diff > 90) return { v, score: -100 };
        }

        return { v, score };
      });

      scored.sort((a: any, b: any) => b.score - a.score);
      // Require score >= 50 so low-relevance or wrong artist songs are discarded
      if (scored.length > 0 && scored[0].score >= 50) {
        const best = scored[0].v;
        const result = {
          source: "youtube",
          ytId: best.videoId,
          audioUrl: `/api/stream?ytId=${best.videoId}`,
          duration: best.seconds || 210,
          coverUrl: best.thumbnail || `https://i.ytimg.com/vi/${best.videoId}/hqdefault.jpg`,
        };
        ytQueryCache.set(cacheKey, result);
        return result;
      }
    } catch (err: any) {
      console.error(`resolveBestYouTubeAudio error for "${q}":`, err.message);
    }
  }

  return null;
}

/**
 * Resolves a high-quality, verified playable audio stream for any track by title and artist name.
 * Checks verified JioSaavn 320kbps first; if missing or mismatched, falls back to scored YouTube stream.
 */
export async function resolveAudioForTrack(
  title: string,
  artistName?: string,
  bitrate: "96" | "160" | "320" = "320",
  targetDuration?: number
): Promise<{ audioUrl: string; duration?: number; lyrics?: string; coverUrl?: string; source?: string; ytId?: string } | null> {
  const normTitle = cleanText(title);
  const normArtist = cleanText(artistName);
  const cacheKey = `${normTitle}:::${normArtist}:::${bitrate}`;

  if (streamResolutionCache.has(cacheKey)) {
    return streamResolutionCache.get(cacheKey)!;
  }

  // 1. Try verified JioSaavn stream with requested bitrate
  const saavnRes = await checkJioSaavnVerified(title, artistName, targetDuration, bitrate);
  if (saavnRes) {
    streamResolutionCache.set(cacheKey, saavnRes);
    return saavnRes;
  }

  // 2. High-precision scored YouTube stream resolution (with client-side playback fallback)
  const ytRes = await resolveBestYouTubeAudio(title, artistName, targetDuration);
  if (ytRes) {
    const res = {
      ...ytRes,
      requiresClientPlayback: true,
    };
    streamResolutionCache.set(cacheKey, res);
    return res;
  }

  return null;
}

/**
 * Searches the Apple Music / iTunes worldwide catalog (100M+ tracks, mirror of Spotify library)
 */
export async function searchSpotifyCatalog(query: string, limit = 35): Promise<GlobalTrack[]> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) return [];
    const data = await res.json();
    const results = data.results || [];

    return results.map((r: any) => {
      const trackName = decodeHtml(r.trackName || "Unknown Track");
      const artistName = decodeHtml(r.artistName || "Various Artists");
      const albumTitle = decodeHtml(r.collectionName || trackName);
      const safeArtistId = `art_${artistName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      const safeAlbumId = `alb_${albumTitle.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      const coverUrl = (r.artworkUrl100 || "").replace("100x100bb", "600x600bb") || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop";
      const durationSec = Math.round((r.trackTimeMillis || 200000) / 1000);

      return {
        id: `itunes_${r.trackId}`,
        title: trackName,
        duration: durationSec,
        streamCount: Math.floor(Math.random() * 50000000) + 10000000,
        audioUrl: `/api/stream?title=${encodeURIComponent(trackName)}&artist=${encodeURIComponent(artistName)}&duration=${durationSec}`,
        explicit: r.trackExplicitness === "explicit",
        album: {
          id: safeAlbumId,
          title: albumTitle,
          coverUrl,
        },
        artist: {
          id: safeArtistId,
          name: artistName,
        },
        source: "spotify" as const,
      };
    });
  } catch (err) {
    console.error("searchSpotifyCatalog error:", err);
    return [];
  }
}

/**
 * Searches real official studio albums from the global Spotify / Apple Music catalog
 */
export async function searchSpotifyAlbums(query: string, limit = 8): Promise<GlobalAlbum[]> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=album&limit=${limit * 2}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) return [];
    const data = await res.json();
    const results = data.results || [];

    const albums: GlobalAlbum[] = [];
    const seenKeys = new Set<string>();

    for (const a of results) {
      if (!a.collectionName) continue;
      const rawTitle = decodeHtml(a.collectionName);
      // Normalize to prevent duplicates of the same album
      const cleanTitle = rawTitle.replace(/\s*[\(\[](?:Deluxe|Bonus Track|Special|Expanded|Remastered|Edition)[\)\]]/gi, "").trim();
      const normKey = `${cleanTitle.toLowerCase()}:::${(a.artistName || "").toLowerCase()}`;

      if (seenKeys.has(normKey)) continue;
      seenKeys.add(normKey);

      const coverUrl = a.artworkUrl100
        ? a.artworkUrl100.replace("100x100bb", "600x600bb")
        : "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop";

      const releaseYear = a.releaseDate ? new Date(a.releaseDate).getFullYear() : 2024;
      const safeArtistId = `art_${(a.artistName || "Various Artists").toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

      albums.push({
        id: `alb_itunes_${a.collectionId}`,
        title: rawTitle,
        coverUrl,
        releaseYear: isNaN(releaseYear) ? 2024 : releaseYear,
        artist: {
          id: safeArtistId,
          name: decodeHtml(a.artistName || "Various Artists"),
        },
        trackCount: a.trackCount,
        copyright: a.copyright,
      });

      if (albums.length >= limit) break;
    }

    return albums;
  } catch (err) {
    console.error("searchSpotifyAlbums error:", err);
    return [];
  }
}

const ytSearchCache = new Map<string, { tracks: GlobalTrack[]; expires: number }>();

/**
 * Searches YouTube & YouTube Music for videos, tracks, live recordings, and remixes
 */
export async function searchYouTube(query: string, limit = 25): Promise<GlobalTrack[]> {
  try {
    const cacheKey = `yt_search_${query.toLowerCase().trim()}`;
    const cached = ytSearchCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.tracks.slice(0, limit);
    }

    const res = await yts(query);
    if (!res || !res.videos) return [];

    const tracks: GlobalTrack[] = [];
    for (const v of res.videos) {
      if (tracks.length >= limit) break;

      const authorRaw = v.author?.name || "";
      // Skip auto-generated Topic channels (e.g. "Artist - Topic") because record labels block third-party embedding (Error 150)
      if (authorRaw.toLowerCase().endsWith("- topic")) {
        continue;
      }

      const raw = v.title || "Unknown Title";
      const clean = raw
        .replace(/\s*[\(\[](?:Official\s*(?:Music\s*)?Video|Official\s*Audio|Audio|Lyrics?|Visualizer|Lyric\s*Video|HD|4K|Remastered|Video|Clip\s*Officiel)[\)\]]\s*$/gi, "")
        .replace(/\s*[\(\[](?:Official\s*(?:Music\s*)?Video|Official\s*Audio|Audio|Lyrics?|Visualizer|HD|4K|Remastered|Official|Video|Clip\s*Officiel)[\)\]]/gi, "")
        .trim();

      let artistName = authorRaw
        .replace(/\s*-\s*Topic$/i, "")
        .replace(/VEVO$/i, "")
        .replace(/\s*Official$/i, "")
        .trim();
      let title = clean;

      const separators = [" - ", " – ", " — ", " | "];
      for (const sep of separators) {
        if (clean.includes(sep)) {
          const parts = clean.split(sep);
          if (parts[0].trim().length > 0 && parts[1].trim().length > 0) {
            artistName = parts[0]
              .trim()
              .replace(/\s*-\s*Topic$/i, "")
              .replace(/VEVO$/i, "")
              .replace(/\s*Official$/i, "")
              .trim();
            title = parts.slice(1).join(sep).trim();
            break;
          }
        }
      }

      if (!artistName) artistName = "YouTube Music";

      const safeArtistId = `art_${artistName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      const safeAlbumId = `alb_yt_${v.videoId}`;

      tracks.push({
        id: `yt_${v.videoId}`,
        title: decodeHtml(title),
        duration: v.seconds || 180,
        streamCount: v.views || 1000000,
        audioUrl: `/api/stream?ytId=${v.videoId}&title=${encodeURIComponent(decodeHtml(title))}&artist=${encodeURIComponent(decodeHtml(artistName))}&duration=${v.seconds || 180}`,
        explicit: false,
        album: {
          id: safeAlbumId,
          title: decodeHtml(`${title} (Single)`),
          coverUrl: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        },
        artist: {
          id: safeArtistId,
          name: decodeHtml(artistName),
        },
        source: "youtube" as const,
      });
    }

    if (ytSearchCache.size > 200) {
      const firstKey = ytSearchCache.keys().next().value;
      if (firstKey) ytSearchCache.delete(firstKey);
    }
    ytSearchCache.set(cacheKey, { tracks, expires: Date.now() + 15 * 60 * 1000 });

    return tracks.slice(0, limit);
  } catch (err) {
    console.error("searchYouTube error:", err);
    return [];
  }
}

/**
 * Searches the JioSaavn 320kbps catalog
 */
export async function searchJioSaavn(query: string, limit = 10): Promise<GlobalTrack[]> {
  try {
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_marker=0&api_version=4&_format=json&p=1&n=${limit}&q=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) return [];
    const data = await res.json();
    const results = data.results || [];

    const tracks: GlobalTrack[] = [];
    for (const s of results) {
      const encUrl = s.encrypted_media_url || s.more_info?.encrypted_media_url;
      const audioUrl = decryptSaavnUrl(encUrl, "320");
      if (!audioUrl) continue;

      const title = decodeHtml(s.song || s.title || "Unknown Track");

      let artistNames: string[] = [];
      if (Array.isArray(s.more_info?.artistMap?.primary_artists) && s.more_info.artistMap.primary_artists.length > 0) {
        artistNames = s.more_info.artistMap.primary_artists.map((a: any) => decodeHtml(a.name)).filter(Boolean);
      } else if (Array.isArray(s.more_info?.artistMap?.artists) && s.more_info.artistMap.artists.length > 0) {
        const singersOrPrimary = s.more_info.artistMap.artists
          .filter((a: any) => a.role === "primary_artists" || a.role === "singer" || a.role === "music")
          .map((a: any) => decodeHtml(a.name))
          .filter(Boolean);
        artistNames = singersOrPrimary.length > 0
          ? singersOrPrimary
          : s.more_info.artistMap.artists.map((a: any) => decodeHtml(a.name)).filter(Boolean);
      }

      if (artistNames.length === 0) {
        if (s.primary_artists) artistNames.push(decodeHtml(s.primary_artists));
        else if (s.singers) artistNames.push(decodeHtml(s.singers));
        else if (s.more_info?.singers) artistNames.push(decodeHtml(s.more_info.singers));
        else if (s.more_info?.music) artistNames.push(decodeHtml(s.more_info.music));
        else if (s.subtitle) artistNames.push(decodeHtml(s.subtitle));
        else if (s.header_desc) artistNames.push(decodeHtml(s.header_desc));
        else if (s.more_info?.label) artistNames.push(decodeHtml(s.more_info.label));
      }

      // Deduplicate artist names
      artistNames = Array.from(new Set(artistNames));
      const artistName = artistNames.length > 0 ? artistNames.join(", ") : "Various Artists";

      const albumTitle = decodeHtml(s.album || s.more_info?.album || title);

      // Filter out unwanted covers, karaoke, and tribute versions
      const fullSearchContent = `${title} ${albumTitle} ${artistName}`.toLowerCase();
      const hasCover = FORBIDDEN_COVER_KEYWORDS.some((kw) => fullSearchContent.includes(kw));
      const hasCoverArtist = FORBIDDEN_COVER_ARTISTS.some((ca) => fullSearchContent.includes(ca));
      const qHasCover = FORBIDDEN_COVER_KEYWORDS.some((kw) => query.toLowerCase().includes(kw));
      if ((hasCover || hasCoverArtist) && !qHasCover) continue;

      const rawImg = s.image || "";
      const coverUrl = rawImg ? rawImg.replace(/-(?:50x50|150x150)\.(?:jpg|webp)/, "-500x500.jpg") : "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop";
      const duration = parseInt(s.duration || s.more_info?.duration || "180", 10);
      const playCount = parseInt(s.play_count || s.more_info?.play_count || "500000", 10);

      const safeId = `global_${s.id}`;
      const primaryArtist = artistNames[0] || artistName;
      const safeArtistId = `art_${primaryArtist.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      const safeAlbumId = `alb_${albumTitle.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

      tracks.push({
        id: safeId,
        title,
        duration: isNaN(duration) ? 180 : duration,
        streamCount: isNaN(playCount) ? 500000 : playCount,
        audioUrl,
        explicit: Boolean(s.explicit_content === "1" || s.more_info?.is_dolby_content),
        album: {
          id: safeAlbumId,
          title: albumTitle,
          coverUrl,
        },
        artist: {
          id: safeArtistId,
          name: artistName,
        },
        source: "jiosaavn" as const,
      });
    }

    return tracks;
  } catch (err) {
    console.error("searchJioSaavn error:", err);
    return [];
  }
}

/**
 * Searches the unified global music catalogue across Spotify, YouTube, and JioSaavn with fast response time
 */
export async function searchGlobalMusic(
  query: string,
  limit = 50,
  source: "all" | "youtube" | "spotify" = "all"
): Promise<GlobalTrack[]> {
  if (!query || query.trim().length === 0) return [];
  const cleanQ = query.trim();

  if (source === "youtube") {
    return await searchYouTube(cleanQ, limit);
  }

  if (source === "spotify") {
    return await searchSpotifyCatalog(cleanQ, limit);
  }

  // Fast multi-source query:
  // Spotify/Apple Music (~200ms) + JioSaavn (~250ms) + YouTube with 1500ms race timeout
  try {
    const ytPromise = Promise.race([
      searchYouTube(cleanQ, 25),
      new Promise<GlobalTrack[]>((resolve) => setTimeout(() => resolve([]), 1500)),
    ]);

    const [spotifySettled, saavnSettled, ytSettled] = await Promise.allSettled([
      searchSpotifyCatalog(cleanQ, Math.ceil(limit * 0.7)),
      searchJioSaavn(cleanQ, Math.min(25, Math.ceil(limit * 0.6))),
      ytPromise,
    ]);

    const spotifyTracks = spotifySettled.status === "fulfilled" ? spotifySettled.value : [];
    const saavnTracks = saavnSettled.status === "fulfilled" ? saavnSettled.value : [];
    const ytTracks = ytSettled.status === "fulfilled" ? ytSettled.value : [];

    // Prioritize direct studio CDN tracks (JioSaavn 320kbps & Spotify/Apple 100M+ catalog)
    const combined: GlobalTrack[] = [];
    const seenStudioSignatures = new Set<string>();

    const studioMax = Math.max(saavnTracks.length, spotifyTracks.length);
    for (let i = 0; i < studioMax; i++) {
      if (i < saavnTracks.length) {
        const t = saavnTracks[i];
        const sig = `${t.title.toLowerCase()}:::${t.artist.name.toLowerCase()}`;
        if (!seenStudioSignatures.has(sig)) {
          seenStudioSignatures.add(sig);
          combined.push(t);
        }
      }
      if (i < spotifyTracks.length) {
        const t = spotifyTracks[i];
        const sig = `${t.title.toLowerCase()}:::${t.artist.name.toLowerCase()}`;
        if (!seenStudioSignatures.has(sig)) {
          seenStudioSignatures.add(sig);
          combined.push(t);
        }
      }
    }

    // Append all relevant YouTube tracks (covers, reverb, live, remixes, unreleased) without dropping duplicates
    const seenYtIds = new Set<string>();
    for (const t of ytTracks) {
      if (!seenYtIds.has(t.id)) {
        seenYtIds.add(t.id);
        combined.push(t);
      }
    }

    // Intent-aware ranking:
    // If user's query specifically targets alternate/community versions (e.g. slowed, reverb, cover, remix, live, acoustic):
    // boost matching YouTube tracks to the top!
    const lowerQuery = cleanQ.toLowerCase();
    const isAlternateIntent = ["slowed", "reverb", "cover", "remix", "acoustic", "live", "sped up", "8d", "piano", "tribute"].some(
      (kw) => lowerQuery.includes(kw)
    );

    if (isAlternateIntent) {
      combined.sort((a, b) => {
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        const aMatches = lowerQuery.split(" ").filter((w) => w.length > 2 && aTitle.includes(w)).length;
        const bMatches = lowerQuery.split(" ").filter((w) => w.length > 2 && bTitle.includes(w)).length;
        return bMatches - aMatches;
      });
    }

    return combined.slice(0, limit);
  } catch (err) {
    console.error("searchGlobalMusic error:", err);
    return [];
  }
}

/**
 * On-demand artist populator: dynamically creates artist + top tracks in DB if clicked from search
 */
export async function ensureArtistInDb(identifier: string) {
  try {
    const cleanSearch = identifier.replace(/^art_/, "").replace(/_/g, " ").trim();
    if (!cleanSearch) return null;
    const lowerSearch = cleanSearch.toLowerCase();

    // 1. Search global music (JioSaavn + Spotify + YouTube)
    const globalTracks = await searchGlobalMusic(cleanSearch, 30);

    // Strict filter: candidate tracks MUST have an artist matching cleanSearch
    let matchingTracks = globalTracks.filter((gt) => {
      const artName = gt.artist.name.toLowerCase();
      return artName === lowerSearch || artName.includes(lowerSearch) || lowerSearch.includes(artName);
    });

    // If still empty, search JioSaavn directly
    if (!matchingTracks.length) {
      const saavnTracks = await searchJioSaavn(cleanSearch, 20);
      matchingTracks = saavnTracks.filter((gt) => {
        const artName = gt.artist.name.toLowerCase();
        return artName === lowerSearch || artName.includes(lowerSearch) || lowerSearch.includes(artName);
      });
    }

    if (!matchingTracks.length) return null;

    // Use canonical artist name from matching tracks (prefer exact match if available)
    const exactMatch = matchingTracks.find(
      (gt) => gt.artist.name.toLowerCase() === lowerSearch
    );
    const top = exactMatch || matchingTracks[0];
    const artistName = top.artist.name;
    const targetArtistId = identifier.startsWith("art_")
      ? identifier
      : `art_${artistName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

    // Check if artist already exists by targetArtistId or exact name
    let artist = await prisma.artist.findFirst({
      where: {
        OR: [
          { id: targetArtistId },
          { name: { equals: artistName } },
        ],
      },
      include: {
        tracks: { include: { artist: true, album: true }, take: 10 },
        albums: true,
      },
    });

    if (artist && artist.tracks.length > 0) return artist;

    if (!artist) {
      artist = await prisma.artist.create({
        data: {
          id: targetArtistId,
          name: artistName,
          avatarUrl: top.album.coverUrl,
          headerUrl: top.album.coverUrl,
          verified: true,
          monthlyListeners: Math.floor(Math.random() * 50000000) + 20000000,
          bio: `${artistName} is an iconic musical artist with chart-topping tracks worldwide across Spotify and YouTube.`,
        },
        include: { tracks: { include: { artist: true, album: true } }, albums: true },
      });
    }

    // Create album for this artist
    const album = await prisma.album.create({
      data: {
        id: `alb_${top.album.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`,
        title: top.album.title || `${artistName} Essentials`,
        coverUrl: top.album.coverUrl,
        releaseYear: 2024,
        releaseDate: "2024",
        type: "album",
        copyright: `© 2024 ${artistName}`,
        artistId: artist.id,
      },
    });

    // Create tracks strictly from matchingTracks (up to 15)
    const tracksToInsert = matchingTracks.slice(0, 15);
    for (let i = 0; i < tracksToInsert.length; i++) {
      const gt = tracksToInsert[i];
      await prisma.track.create({
        data: {
          id: `trk_${gt.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${i}_${Date.now()}`,
          title: gt.title,
          duration: gt.duration,
          streamCount: gt.streamCount || Math.floor(Math.random() * 20000000) + 5000000,
          audioUrl: gt.audioUrl,
          explicit: gt.explicit || false,
          trackNumber: i + 1,
          albumId: album.id,
          artistId: artist.id,
        },
      });
    }

    return await prisma.artist.findUnique({
      where: { id: artist.id },
      include: {
        tracks: { include: { artist: true, album: true }, orderBy: { streamCount: "desc" }, take: 10 },
        albums: true,
      },
    });
  } catch (err) {
    console.error("ensureArtistInDb error:", err);
    return null;
  }
}

/**
 * On-demand album populator: dynamically creates album + tracks in DB if clicked from search
 */
export async function ensureAlbumInDb(identifier: string) {
  try {
    // 1. If identifier is an official iTunes/Apple collection ID (e.g. alb_itunes_1739659134)
    if (identifier.startsWith("alb_itunes_")) {
      const collectionId = identifier.replace("alb_itunes_", "");
      const lookupUrl = `https://itunes.apple.com/lookup?id=${collectionId}&entity=song`;
      const res = await fetch(lookupUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const [albumInfo, ...songs] = data.results;
          const artistName = decodeHtml(albumInfo.artistName || "Various Artists");
          const albumTitle = decodeHtml(albumInfo.collectionName || "Album");
          const safeArtistId = `art_${artistName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
          const coverUrl = albumInfo.artworkUrl100
            ? albumInfo.artworkUrl100.replace("100x100bb", "600x600bb")
            : "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop";

          let artist = await prisma.artist.findFirst({ where: { name: artistName } });
          if (!artist) {
            artist = await prisma.artist.create({
              data: {
                id: safeArtistId,
                name: artistName,
                avatarUrl: coverUrl,
                headerUrl: coverUrl,
                verified: true,
                monthlyListeners: Math.floor(Math.random() * 50000000) + 20000000,
              },
            });
          }

          const releaseYear = albumInfo.releaseDate ? new Date(albumInfo.releaseDate).getFullYear() : 2024;
          const album = await prisma.album.create({
            data: {
              id: identifier,
              title: albumTitle,
              coverUrl,
              releaseYear: isNaN(releaseYear) ? 2024 : releaseYear,
              releaseDate: albumInfo.releaseDate ? albumInfo.releaseDate.split("T")[0] : "2024",
              type: "album",
              copyright: albumInfo.copyright || `© ${releaseYear} ${artistName}`,
              artistId: artist.id,
            },
          });

          for (let i = 0; i < songs.length; i++) {
            const s = songs[i];
            const trackTitle = decodeHtml(s.trackName || "Track");
            const trackDuration = Math.round((s.trackTimeMillis || 200000) / 1000);
            await prisma.track.create({
              data: {
                id: `trk_itunes_${s.trackId}_${Date.now()}_${i}`,
                title: trackTitle,
                duration: trackDuration,
                streamCount: Math.floor(Math.random() * 30000000) + 5000000,
                audioUrl: `/api/stream?title=${encodeURIComponent(trackTitle)}&artist=${encodeURIComponent(artistName)}&duration=${trackDuration}`,
                explicit: s.trackExplicitness === "explicit",
                trackNumber: s.trackNumber || i + 1,
                discNumber: s.discNumber || 1,
                albumId: album.id,
                artistId: artist.id,
              },
            });
          }

          return await prisma.album.findUnique({
            where: { id: album.id },
            include: {
              artist: true,
              tracks: {
                include: { artist: true, album: true },
                orderBy: { trackNumber: "asc" },
              },
            },
          });
        }
      }
    }

    // 2. Generic fallback populator
    const cleanSearch = identifier.replace(/^alb_/, "").replace(/_/g, " ").trim();
    if (!cleanSearch) return null;

    const globalTracks = await searchGlobalMusic(cleanSearch, 15);
    if (!globalTracks.length) return null;

    const top = globalTracks[0];
    const artistName = top.artist.name;
    const albumTitle = top.album.title;

    let artist = await prisma.artist.findFirst({
      where: { name: { equals: artistName } },
    });

    if (!artist) {
      artist = await prisma.artist.create({
        data: {
          id: `art_${artistName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
          name: artistName,
          avatarUrl: top.album.coverUrl,
          headerUrl: top.album.coverUrl,
          verified: true,
          monthlyListeners: Math.floor(Math.random() * 50000000) + 20000000,
        },
      });
    }

    const album = await prisma.album.create({
      data: {
        id: identifier,
        title: albumTitle,
        coverUrl: top.album.coverUrl,
        releaseYear: 2024,
        releaseDate: "2024",
        type: "album",
        copyright: `© 2024 ${artistName}`,
        artistId: artist.id,
      },
    });

    for (let i = 0; i < globalTracks.length; i++) {
      const gt = globalTracks[i];
      await prisma.track.create({
        data: {
          id: `trk_${gt.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${i}_${Date.now()}`,
          title: gt.title,
          duration: gt.duration,
          streamCount: gt.streamCount,
          audioUrl: gt.audioUrl,
          explicit: gt.explicit,
          trackNumber: i + 1,
          albumId: album.id,
          artistId: artist.id,
        },
      });
    }

    return await prisma.album.findUnique({
      where: { id: album.id },
      include: {
        artist: true,
        tracks: {
          include: { artist: true, album: true },
          orderBy: { trackNumber: "asc" },
        },
      },
    });
  } catch (err) {
    console.error("ensureAlbumInDb error:", err);
    return null;
  }
}

/**
 * On-demand track populator: ensures a track and its parent artist/album exist in SQLite DB
 */
export async function ensureTrackInDb(trackData: any): Promise<any> {
  if (!trackData || !trackData.id) return null;

  try {
    // 1. If track already exists, return with full associations
    let existing = await prisma.track.findUnique({
      where: { id: trackData.id },
      include: { artist: true, album: true },
    });
    if (existing) return existing;

    // 2. Ensure Artist exists
    const artistName = decodeHtml(trackData.artist?.name || "Various Artists");
    let artist = await prisma.artist.findFirst({
      where: { name: artistName },
    });

    if (!artist) {
      const safeArtistId = trackData.artist?.id && !trackData.artist.id.startsWith("global_") && !trackData.artist.id.startsWith("yt_") && !trackData.artist.id.startsWith("itunes_")
        ? trackData.artist.id
        : `art_${artistName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      
      const existingArtistById = await prisma.artist.findUnique({ where: { id: safeArtistId } });
      if (existingArtistById) {
        artist = existingArtistById;
      } else {
        artist = await prisma.artist.create({
          data: {
            id: safeArtistId,
            name: artistName,
            avatarUrl: trackData.album?.coverUrl || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
            headerUrl: trackData.album?.coverUrl || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1600&h=600&fit=crop",
            verified: true,
            monthlyListeners: Math.floor(Math.random() * 30000000) + 10000000,
          },
        });
      }
    }

    // 3. Ensure Album exists
    const albumTitle = decodeHtml(trackData.album?.title || trackData.title || "Singles");
    let album = await prisma.album.findFirst({
      where: { title: albumTitle, artistId: artist.id },
    });

    if (!album) {
      const safeAlbumId = trackData.album?.id && !trackData.album.id.startsWith("global_") && !trackData.album.id.startsWith("yt_") && !trackData.album.id.startsWith("itunes_")
        ? trackData.album.id
        : `alb_${albumTitle.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;

      const existingAlbumById = await prisma.album.findUnique({ where: { id: safeAlbumId } });
      if (existingAlbumById) {
        album = existingAlbumById;
      } else {
        album = await prisma.album.create({
          data: {
            id: safeAlbumId,
            title: albumTitle,
            coverUrl: trackData.album?.coverUrl || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
            releaseYear: trackData.album?.releaseYear || 2024,
            releaseDate: "2024",
            type: "album",
            artistId: artist.id,
          },
        });
      }
    }

    // 4. Create Track
    return await prisma.track.create({
      data: {
        id: trackData.id,
        title: decodeHtml(trackData.title || "Unknown Track"),
        duration: trackData.duration || 210,
        streamCount: trackData.streamCount || 500000,
        audioUrl: trackData.audioUrl || "",
        explicit: Boolean(trackData.explicit),
        trackNumber: trackData.trackNumber || 1,
        discNumber: 1,
        artistId: artist.id,
        albumId: album.id,
      },
      include: {
        artist: true,
        album: true,
      },
    });
  } catch (err) {
    console.error("ensureTrackInDb error:", err);
    return null;
  }
}
