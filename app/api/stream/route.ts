import { NextRequest, NextResponse } from "next/server";
import { Ytdl, chooseFormat, Quality, Client } from "@distube/ytdl-core";
import { resolveAudioForTrack } from "@/lib/musicEngine";
import { resolveStreamQuality } from "@/lib/audioQuality";

export const dynamic = "force-dynamic";

// In-memory cache for resolved Google Video audio URLs (lasts ~3 hours)
const ytStreamCache = new Map<string, { url: string; expires: number }>();

// Negative cache for unresolvable / unavailable video IDs (lasts 5 minutes) to prevent hammering
const ytNegativeCache = new Map<string, number>();

// In-memory throttled logger timestamp map to prevent log spam (max 1 log per minute per id)
const lastLoggedError = new Map<string, number>();

// Client rotation: TV and VisionOS clients do not invoke BotGuard challenges on datacenter IPs
const YTDL_CLIENTS = [Client.Tv, Client.VisionOS, Client.WebEmbedded, Client.Mweb] as const;

const ytInstance = new Ytdl({
  clients: YTDL_CLIENTS,
  cookie: process.env.YOUTUBE_COOKIE || undefined,
});

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

    // 2. Query search resolution with strict validation & cover-filtering
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
          const info = await ytInstance.getInfo(`https://www.youtube.com/watch?v=${ytId}`);
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

        // Resilient fallback for serverless cloud IPs (Vercel / AWS)
        if (!resolvedUrl) {
          try {
            const fallbackEndpoints = [
              `https://api.piped.private.coffee/streams/${ytId}`,
              `https://piped.video/api/v1/streams/${ytId}`,
              `https://invidious.nerdvpn.de/api/v1/videos/${ytId}`,
            ];
            for (const ep of fallbackEndpoints) {
              const fRes = await fetch(ep, {
                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
                signal: AbortSignal.timeout(2500),
              });
              if (!fRes.ok) continue;
              const fData = await fRes.json();
              if (fData.audioStreams && Array.isArray(fData.audioStreams)) {
                const best = fData.audioStreams.sort(
                  (a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0)
                )[0];
                if (best?.url) {
                  resolvedUrl = best.url;
                  ytStreamCache.set(ytId, {
                    url: best.url,
                    expires: Date.now() + 3 * 3600 * 1000,
                  });
                  ytNegativeCache.delete(ytId);
                  break;
                }
              }
              if (fData.adaptiveFormats && Array.isArray(fData.adaptiveFormats)) {
                const aud = fData.adaptiveFormats.find((f: any) =>
                  f.type?.includes("audio")
                );
                if (aud?.url) {
                  resolvedUrl = aud.url;
                  ytStreamCache.set(ytId, {
                    url: aud.url,
                    expires: Date.now() + 3 * 3600 * 1000,
                  });
                  ytNegativeCache.delete(ytId);
                  break;
                }
              }
            }
          } catch {
            // fallback error ignored
          }
        }
      }

      if (!resolvedUrl) {
        // Cache negative result for 5 minutes so rapid retries do not trigger IP bans
        ytNegativeCache.set(ytId, Date.now() + 5 * 60 * 1000);

        if (isJsonRequested) {
          return NextResponse.json({ success: true, ytId, source: "youtube" });
        }
        return NextResponse.json(
          { error: "Failed to resolve YouTube audio stream" },
          { status: 404 }
        );
      }

      if (isJsonRequested) {
        return NextResponse.json({ success: true, audioUrl: resolvedUrl, ytId, source: "youtube" });
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
