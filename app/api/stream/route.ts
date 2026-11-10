import { NextRequest, NextResponse } from "next/server";
import { Ytdl, chooseFormat, Quality, Client, createPoTokenProvider } from "@distube/ytdl-core";
import {
  resolveAudioForTrack,
  checkJioSaavnVerified,
  searchJioSaavn,
  stripTrackArtifacts,
} from "@/lib/musicEngine";
import { resolveStreamQuality } from "@/lib/audioQuality";

export const dynamic = "force-dynamic";

// In-memory cache for resolved Google Video audio URLs (lasts ~3 hours)
const ytStreamCache = new Map<string, { url: string; expires: number }>();

// Negative cache for unresolvable / unavailable video IDs (lasts 5 minutes) to prevent hammering
const ytNegativeCache = new Map<string, number>();

// In-memory throttled logger timestamp map to prevent log spam (max 1 log per minute per id)
const lastLoggedError = new Map<string, number>();

// Client hierarchy: VisionOS and WebEmbedded prioritize non-BotGuard playback on datacenter IPs
const YTDL_CLIENTS = [Client.VisionOS, Client.WebEmbedded, Client.Tv, Client.Mweb] as const;

// Lazy singleton PoToken provider and Ytdl instance
let poTokenProviderPromise: Promise<any> | null = null;
let ytInstanceSingleton: Ytdl | null = null;

async function getYtdl(): Promise<Ytdl> {
  if (ytInstanceSingleton) return ytInstanceSingleton;

  try {
    if (!poTokenProviderPromise) {
      poTokenProviderPromise = createPoTokenProvider({ timeoutMs: 2000 }).catch((err) => {
        console.warn("[YouTube Stream] PoToken provider init warning:", err.message);
        return null;
      });
    }

    const provider = await poTokenProviderPromise;
    if (provider) {
      ytInstanceSingleton = new Ytdl({
        clients: YTDL_CLIENTS,
        getPoToken: provider,
        cookie: process.env.YOUTUBE_COOKIE || undefined,
      });
      return ytInstanceSingleton;
    }
  } catch (err: any) {
    console.warn("[YouTube Stream] PoToken setup error:", err.message);
  }

  // Fallback to standard clients without PoToken
  ytInstanceSingleton = new Ytdl({
    clients: YTDL_CLIENTS,
    cookie: process.env.YOUTUBE_COOKIE || undefined,
  });
  return ytInstanceSingleton;
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    let ytId = searchParams.get("ytId");
    const q = searchParams.get("q");
    const title = searchParams.get("title");
    const artist = searchParams.get("artist") || "";
    const redirect = searchParams.get("redirect") === "true";
    const directUrl = searchParams.get("url");
    const isJsonRequested =
      req.headers.get("accept")?.includes("application/json") ||
      searchParams.get("format") === "json";

    // 1. Direct URL pass-through
    if (directUrl) {
      if (isJsonRequested) {
        const qualityInfo = resolveStreamQuality(directUrl);
        return NextResponse.json({
          success: true,
          audioUrl: directUrl,
          bitrate: qualityInfo.bitrate,
          qualityTier: qualityInfo.tier,
        });
      }
      return NextResponse.redirect(directUrl, 302);
    }

    // 2. Studio-First query search resolution with strict validation & cover-filtering
    // Prioritize high-bitrate studio master from JioSaavn CDN (zero bot detection risk on cloud IPs)
    // ONLY when ytId is NOT specified. If a specific ytId was requested, do not hijack it.
    if (!ytId && (q || title)) {
      let resolvedTitle = title || "";
      let resolvedArtist = artist || "";

      if (!resolvedTitle && q) {
        // 1. Check if an existing track in database matches this audioUrl or query
        try {
          const { prisma } = await import("@/lib/prisma");
          const reqPathAndQuery = req.nextUrl.pathname + req.nextUrl.search;
          const dbTrack = await prisma.track.findFirst({
            where: {
              OR: [
                { audioUrl: reqPathAndQuery },
                { audioUrl: `/api/stream?q=${encodeURIComponent(q)}` },
                { audioUrl: `/api/stream?q=${q}` },
                { title: { equals: q } },
              ],
            },
            include: { artist: true },
          });

          if (dbTrack) {
            resolvedTitle = dbTrack.title;
            resolvedArtist = dbTrack.artist?.name || "";
          }
        } catch {
          // ignore
        }

        // 2. If still not resolved, check patterns in q
        if (!resolvedTitle) {
          if (q.includes(" - ")) {
            const parts = q.split(" - ");
            resolvedArtist = parts[0].trim();
            resolvedTitle = parts.slice(1).join(" - ").trim();
          } else if (q.toLowerCase().includes(" by ")) {
            const parts = q.split(/\s+by\s+/i);
            resolvedTitle = parts[0].trim();
            resolvedArtist = parts.slice(1).join(" by ").trim();
          } else {
            try {
              const { prisma } = await import("@/lib/prisma");
              const artistsInDb = await prisma.artist.findMany({ select: { name: true } });
              const foundArtist = artistsInDb.find((a) =>
                q.toLowerCase().includes(a.name.toLowerCase())
              );
              if (foundArtist) {
                resolvedArtist = foundArtist.name;
                resolvedTitle = q.replace(new RegExp(foundArtist.name, "gi"), "").trim();
              } else {
                resolvedTitle = q.trim();
              }
            } catch {
              resolvedTitle = q.trim();
            }
          }
        }
      }

      const durationNum = parseInt(searchParams.get("duration") || "0", 10);
      const bitrateParam = searchParams.get("bitrate");
      const targetBitrate: "96" | "160" | "320" =
        bitrateParam === "96" || bitrateParam === "160" ? bitrateParam : "320";

      const resolved = await resolveAudioForTrack(
        resolvedTitle,
        resolvedArtist,
        targetBitrate,
        durationNum > 0 ? durationNum : undefined
      );

      if (resolved?.audioUrl) {
        if (resolved.source === "jiosaavn" && resolved.audioUrl.startsWith("http")) {
          if (isJsonRequested) {
            const qualityInfo = resolveStreamQuality(resolved.audioUrl, "jiosaavn");
            return NextResponse.json({
              success: true,
              audioUrl: resolved.audioUrl,
              source: "jiosaavn",
              duration: resolved.duration,
              bitrate: qualityInfo.bitrate,
              qualityTier: qualityInfo.tier,
            });
          }
          return NextResponse.redirect(resolved.audioUrl, 302);
        }

        if (resolved.ytId) {
          ytId = resolved.ytId;
        } else if (resolved.audioUrl.includes("ytId=")) {
          const m = resolved.audioUrl.match(/ytId=([a-zA-Z0-9_-]+)/);
          if (m) ytId = m[1];
        }

        if (isJsonRequested && ytId) {
          const qualityInfo = resolveStreamQuality(resolved.audioUrl, "youtube");
          return NextResponse.json({
            success: true,
            ytId,
            audioUrl: resolved.audioUrl,
            source: "youtube",
            duration: resolved.duration,
            bitrate: qualityInfo.bitrate,
            qualityTier: qualityInfo.tier,
          });
        }
      }
    }

    // 3. YouTube Audio Streaming with Studio-Master Fallback (Zero 30s cutoffs, zero bot failure)
    if (ytId) {
      let resolvedUrl: string | null = null;
      let resolvedSource: "youtube" | "jiosaavn" = "youtube";

      // Check negative cache first: if video was recently confirmed unavailable/blocked, avoid re-hammering
      const negativeExpiry = ytNegativeCache.get(ytId);
      if (negativeExpiry && negativeExpiry > Date.now()) {
        if (isJsonRequested) {
          return NextResponse.json({
            success: false,
            error: "This stream is temporarily unavailable or restricted by YouTube BotGuard on cloud servers.",
            restricted: true,
            ytId,
            source: "youtube",
          }, { status: 404 });
        }
        return NextResponse.json(
          {
            error: "This stream is temporarily unavailable or restricted by YouTube BotGuard on cloud servers.",
            restricted: true,
            ytId,
            source: "youtube",
          },
          { status: 404 }
        );
      }

      const cached = ytStreamCache.get(ytId);
      if (cached && cached.expires > Date.now()) {
        resolvedUrl = cached.url;
        if (resolvedUrl.includes(".saavncdn.com")) {
          resolvedSource = "jiosaavn";
        }
      } else {
        // Tier 1: Try native ytdl extraction (bounded fast timeout so serverless doesn't stall)
        try {
          const ytPromise = (async () => {
            const yt = await getYtdl();
            const info = await yt.getInfo(`https://www.youtube.com/watch?v=${ytId}`);
            return chooseFormat(info.formats, {
              quality: Quality.HighestAudio,
              filter: { hasAudio: true, hasVideo: false },
            });
          })();

          const format: any = await Promise.race([
            ytPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error("YTDL timeout")), 2500)),
          ]);

          if (format?.url) {
            resolvedUrl = format.url;
            ytStreamCache.set(ytId, {
              url: format.url,
              expires: Date.now() + 3 * 3600 * 1000,
            });
            ytNegativeCache.delete(ytId);
          }
        } catch (ytErr: any) {
          const now = Date.now();
          const lastLog = lastLoggedError.get(ytId) || 0;
          if (now - lastLog > 60000) {
            console.warn(`[YouTube Stream] Resolution note for ${ytId}: ${ytErr.message}`);
            lastLoggedError.set(ytId, now);
          }
        }

        // Tier 2: Resilient fast Invidious / Piped audio stream mirrors for datacenter IPs
        if (!resolvedUrl) {
          try {
            const fallbackEndpoints = [
              `https://pipedapi.kavin.rocks/streams/${ytId}`,
              `https://api.piped.private.coffee/streams/${ytId}`,
              `https://inv.nadeko.net/api/v1/videos/${ytId}`,
              `https://invidious.nerdvpn.de/api/v1/videos/${ytId}`,
            ];

            const fetchMirror = async (ep: string): Promise<string | null> => {
              try {
                const fRes = await fetch(ep, {
                  headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
                  signal: AbortSignal.timeout(1800),
                });
                if (!fRes.ok) return null;
                const fData = await fRes.json();
                if (fData.audioStreams && Array.isArray(fData.audioStreams) && fData.audioStreams.length > 0) {
                  const best = fData.audioStreams.sort(
                    (a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0)
                  )[0];
                  if (best?.url) return best.url;
                }
                if (fData.adaptiveFormats && Array.isArray(fData.adaptiveFormats)) {
                  const aud = fData.adaptiveFormats.find((f: any) => f.type?.includes("audio"));
                  if (aud?.url) return aud.url;
                }
                return null;
              } catch {
                return null;
              }
            };

            const mirrorResults = await Promise.allSettled(fallbackEndpoints.map((ep) => fetchMirror(ep)));
            for (const r of mirrorResults) {
              if (r.status === "fulfilled" && r.value) {
                resolvedUrl = r.value;
                ytStreamCache.set(ytId, {
                  url: r.value,
                  expires: Date.now() + 3 * 3600 * 1000,
                });
                ytNegativeCache.delete(ytId);
                break;
              }
            }
          } catch {
            // mirror fallback error ignored
          }
        }

        // Tier 3: Full-Length 320kbps Studio Master Resolution via JioSaavn CDN (0% Bot Risk, Full 3-5min Playback)
        // Resolves exact song using track metadata or YouTube oEmbed data, completely eliminating 30-second truncations
        if (!resolvedUrl) {
          try {
            let candidateTitle = title || "";
            let candidateArtist = artist || "";

            // If title is missing, fetch metadata via fast zero-bot YouTube oEmbed endpoint
            if (!candidateTitle && ytId) {
              try {
                const oembedRes = await fetch(
                  `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`,
                  { signal: AbortSignal.timeout(2000) }
                );
                if (oembedRes.ok) {
                  const oData = await oembedRes.json();
                  const rawTitle = oData.title || "";
                  const rawAuthor = (oData.author_name || "")
                    .replace(/\s*-\s*Topic$/i, "")
                    .replace(/VEVO$/i, "")
                    .trim();

                  // Parse "Artist - Title" format common in YouTube uploads
                  if (rawTitle.includes(" - ")) {
                    const parts = rawTitle.split(" - ");
                    candidateArtist = parts[0].trim();
                    candidateTitle = parts.slice(1).join(" - ").trim();
                  } else {
                    candidateTitle = rawTitle;
                    if (!candidateArtist && rawAuthor) {
                      candidateArtist = rawAuthor;
                    }
                  }
                }
              } catch {
                // oembed error ignored
              }
            }

            if (candidateTitle) {
              const durationNum = parseInt(searchParams.get("duration") || "0", 10);
              const bitrateParam = searchParams.get("bitrate");
              const targetBitrate: "96" | "160" | "320" =
                bitrateParam === "96" || bitrateParam === "160" ? bitrateParam : "320";

              // 1. Try verified JioSaavn resolution with duration tolerance
              const saavnRes = await checkJioSaavnVerified(
                candidateTitle,
                candidateArtist,
                durationNum > 0 ? durationNum : undefined,
                targetBitrate
              );

              if (saavnRes?.audioUrl && saavnRes.audioUrl.startsWith("http")) {
                resolvedUrl = saavnRes.audioUrl;
                resolvedSource = "jiosaavn";
                ytStreamCache.set(ytId, {
                  url: resolvedUrl,
                  expires: Date.now() + 6 * 3600 * 1000,
                });
                ytNegativeCache.delete(ytId);
              } else {
                // 2. Search JioSaavn catalog for verified studio master
                const cleanT = stripTrackArtifacts(candidateTitle) || candidateTitle;
                const searchQueries = [
                  [cleanT, candidateArtist].filter(Boolean).join(" "),
                  candidateTitle,
                ];
                for (const sq of searchQueries) {
                  if (!sq.trim()) continue;
                  const saavnTracks = await searchJioSaavn(sq.trim(), 3);
                  if (saavnTracks && saavnTracks.length > 0) {
                    const best = saavnTracks[0];
                    if (best?.audioUrl && best.audioUrl.startsWith("http")) {
                      resolvedUrl = best.audioUrl;
                      resolvedSource = "jiosaavn";
                      ytStreamCache.set(ytId, {
                        url: resolvedUrl,
                        expires: Date.now() + 6 * 3600 * 1000,
                      });
                      ytNegativeCache.delete(ytId);
                      break;
                    }
                  }
                }
              }
            }
          } catch (studioErr: any) {
            console.warn(`[Studio Fallback] Error resolving studio audio for ${ytId}:`, studioErr.message);
          }
        }
      }

      if (!resolvedUrl) {
        // Cache negative result for 3 minutes so rapid retries do not trigger IP bans
        ytNegativeCache.set(ytId, Date.now() + 3 * 60 * 1000);

        if (isJsonRequested) {
          return NextResponse.json(
            {
              success: false,
              error: "This video stream is restricted by YouTube BotGuard on cloud servers. Try searching for the studio song.",
              restricted: true,
              ytId,
              source: "youtube",
            },
            { status: 404 }
          );
        }
        return NextResponse.json(
          {
            error: "This video stream is restricted by YouTube BotGuard on cloud servers. Try searching for the studio song.",
            restricted: true,
            ytId,
            source: "youtube",
          },
          { status: 404 }
        );
      }

      if (isJsonRequested) {
        const qualityInfo = resolveStreamQuality(resolvedUrl, resolvedSource);
        return NextResponse.json({
          success: true,
          audioUrl: resolvedUrl,
          ytId,
          source: resolvedSource,
          bitrate: qualityInfo.bitrate,
          qualityTier: qualityInfo.tier,
        });
      }

      // Always redirect to the resolved URL.
      // Proxying audio through a Vercel serverless function causes playback failure because:
      // 1. Vercel enforces a 4.5MB response body limit — audio files far exceed this.
      // 2. Vercel function streaming timeouts (10s Hobby / 60s Pro) kill long-lived audio connections.
      // The browser fetches the audio directly from CDN once redirected.
      return NextResponse.redirect(resolvedUrl, 302);
    }

    return NextResponse.json(
      { error: "Query parameter (ytId, q, or title) required" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Stream route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
