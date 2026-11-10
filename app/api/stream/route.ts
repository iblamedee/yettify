import { NextRequest, NextResponse } from "next/server";
import { Ytdl, chooseFormat, Quality, Client, createPoTokenProvider } from "@distube/ytdl-core";
import { resolveAudioForTrack } from "@/lib/musicEngine";
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
      poTokenProviderPromise = createPoTokenProvider({ timeoutMs: 12000 }).catch((err) => {
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
    // When title or q is present (even if ytId is also provided as a fallback hint),
    // prioritize high-bitrate studio master from JioSaavn CDN (zero bot detection risk on cloud IPs)
    if (q || title) {
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

    // 3. YouTube Audio Streaming with HTTP 206 Partial Content Range Support
    if (ytId) {
      let resolvedUrl: string | null = null;

      // Check negative cache first: if video was recently confirmed unavailable/blocked, avoid re-hammering
      const negativeExpiry = ytNegativeCache.get(ytId);
      if (negativeExpiry && negativeExpiry > Date.now()) {
        if (isJsonRequested) {
          return NextResponse.json({ success: true, ytId, source: "youtube" });
        }
        return NextResponse.json(
          { error: "Video stream unavailable or restricted" },
          { status: 404 }
        );
      }

      const cached = ytStreamCache.get(ytId);
      if (cached && cached.expires > Date.now()) {
        resolvedUrl = cached.url;
      } else {
        try {
          const yt = await getYtdl();
          const info = await yt.getInfo(`https://www.youtube.com/watch?v=${ytId}`);
          const format = chooseFormat(info.formats, {
            quality: Quality.HighestAudio,
            filter: { hasAudio: true, hasVideo: false },
          });

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

        // ⚡ Automatic Zero-Bot Studio Fallback Bridge:
        // If direct YouTube stream extraction is blocked on cloud/datacenter IPs (e.g. BotGuard),
        // resolve the 320kbps verified studio master from JioSaavn CDN (0% risk of bot detection)!
        if (!resolvedUrl) {
          try {
            let searchTitle = title;
            let searchArtist = artist;

            // If title and artist were not provided in query params, fetch video metadata via yt-search (never blocked on Vercel)
            if (!searchTitle) {
              const yts = (await import("yt-search")).default;
              const meta = await yts({ videoId: ytId });
              if (meta && meta.title) {
                const { stripTrackArtifacts } = await import("@/lib/musicEngine");
                const clean = stripTrackArtifacts(meta.title) || meta.title;
                const author = (meta.author?.name || "")
                  .replace(/\s*-\s*Topic$/i, "")
                  .replace(/VEVO$/i, "")
                  .replace(/\s*Official$/i, "")
                  .trim();

                if (clean.includes(" - ")) {
                  const parts = clean.split(" - ");
                  searchArtist = author || parts[0].trim();
                  searchTitle = parts.slice(1).join(" - ").trim();
                } else {
                  searchTitle = clean;
                  searchArtist = author;
                }
              }
            }

            if (searchTitle) {
              const studioRes = await resolveAudioForTrack(
                searchTitle,
                searchArtist || undefined,
                "320"
              );

              if (studioRes?.audioUrl && studioRes.source === "jiosaavn") {
                resolvedUrl = studioRes.audioUrl;
                ytStreamCache.set(ytId, {
                  url: studioRes.audioUrl,
                  expires: Date.now() + 12 * 3600 * 1000,
                });
                ytNegativeCache.delete(ytId);

                if (isJsonRequested) {
                  const qualityInfo = resolveStreamQuality(resolvedUrl, "jiosaavn");
                  return NextResponse.json({
                    success: true,
                    audioUrl: resolvedUrl,
                    ytId,
                    source: "jiosaavn",
                    duration: studioRes.duration,
                    bitrate: qualityInfo.bitrate,
                    qualityTier: qualityInfo.tier,
                  });
                }
                return NextResponse.redirect(resolvedUrl, 302);
              }
            }
          } catch (bridgeErr: any) {
            console.warn(`[Zero-Bot Bridge] Note for ${ytId}:`, bridgeErr.message);
          }
        }
      }

      if (!resolvedUrl) {
        // Cache negative result for 5 minutes so rapid retries do not trigger IP bans
        ytNegativeCache.set(ytId, Date.now() + 5 * 60 * 1000);

        if (isJsonRequested) {
          return NextResponse.json(
            { success: false, error: "Failed to resolve YouTube audio stream", ytId, source: "youtube" },
            { status: 404 }
          );
        }
        return NextResponse.json(
          { error: "Failed to resolve YouTube audio stream" },
          { status: 404 }
        );
      }

      if (isJsonRequested) {
        const qualityInfo = resolveStreamQuality(resolvedUrl, "youtube");
        return NextResponse.json({
          success: true,
          audioUrl: resolvedUrl,
          ytId,
          source: "youtube",
          bitrate: qualityInfo.bitrate,
          qualityTier: qualityInfo.tier,
        });
      }

      // Always redirect to the resolved URL.
      // Proxying audio through a Vercel serverless function causes playback failure because:
      // 1. Vercel enforces a 4.5MB response body limit — audio files far exceed this.
      // 2. Vercel function streaming timeouts (10s Hobby / 60s Pro) kill long-lived audio connections.
      // The browser fetches the audio directly from Google's CDN once redirected.
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
