import { NextRequest, NextResponse } from "next/server";
import { Ytdl, chooseFormat, Quality } from "@distube/ytdl-core";
import { resolveAudioForTrack } from "@/lib/musicEngine";

export const dynamic = "force-dynamic";

// In-memory cache for resolved Google Video audio URLs (lasts ~3 hours)
const ytStreamCache = new Map<string, { url: string; expires: number }>();
const ytInstance = new Ytdl();

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
      if (isJsonRequested) return NextResponse.json({ success: true, audioUrl: directUrl });
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
      const resolved = await resolveAudioForTrack(
        resolvedTitle,
        resolvedArtist,
        "320",
        durationNum > 0 ? durationNum : undefined
      );

      if (resolved?.audioUrl) {
        if (resolved.source === "jiosaavn" && resolved.audioUrl.startsWith("http")) {
          if (isJsonRequested) {
            return NextResponse.json({ success: true, audioUrl: resolved.audioUrl });
          }
          return NextResponse.redirect(resolved.audioUrl, 302);
        }

        if (resolved.ytId) {
          ytId = resolved.ytId;
        } else if (resolved.audioUrl.includes("ytId=")) {
          const m = resolved.audioUrl.match(/ytId=([a-zA-Z0-9_-]+)/);
          if (m) ytId = m[1];
        }
      }
    }

    // 3. YouTube Audio Streaming with HTTP 206 Partial Content Range Support
    if (ytId) {
      let resolvedUrl: string | null = null;
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
          }
        } catch (ytErr: any) {
          console.error("Ytdl resolution error for", ytId, ytErr.message);
        }

        // Resilient fallback for serverless cloud IPs (Vercel / AWS)
        if (!resolvedUrl) {
          try {
            const fallbackEndpoints = [
              `https://pipedapi.kavin.rocks/streams/${ytId}`,
              `https://api.piped.private.coffee/streams/${ytId}`,
              `https://invidious.nerdvpn.de/api/v1/videos/${ytId}`,
            ];
            for (const ep of fallbackEndpoints) {
              const fRes = await fetch(ep, {
                headers: { "User-Agent": "Mozilla/5.0" },
                signal: AbortSignal.timeout(3000),
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
        return NextResponse.json(
          { error: "Failed to resolve YouTube audio stream" },
          { status: 404 }
        );
      }

      if (isJsonRequested) {
        return NextResponse.json({ success: true, audioUrl: resolvedUrl });
      }

      if (redirect) {
        return NextResponse.redirect(resolvedUrl, 302);
      }

      // Stream with HTTP Range support for scrubbing / fast buffering
      const clientRange = req.headers.get("range");
      const upstreamRes = await fetch(resolvedUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          ...(clientRange ? { Range: clientRange } : {}),
        },
      });

      const responseHeaders = new Headers();
      responseHeaders.set(
        "Content-Type",
        upstreamRes.headers.get("content-type") || "audio/webm"
      );
      responseHeaders.set("Accept-Ranges", "bytes");

      if (upstreamRes.headers.get("content-range")) {
        responseHeaders.set(
          "Content-Range",
          upstreamRes.headers.get("content-range")!
        );
      }
      if (upstreamRes.headers.get("content-length")) {
        responseHeaders.set(
          "Content-Length",
          upstreamRes.headers.get("content-length")!
        );
      }
      responseHeaders.set("Cache-Control", "public, max-age=3600");

      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        headers: responseHeaders,
      });
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
