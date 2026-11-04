import { prisma } from "@/lib/prisma";
import { searchGlobalMusic, GlobalTrack } from "@/lib/musicEngine";

// Musical style / related artist clusters for authentic Spotify recommendation graph
export const RELATED_ARTIST_MAP: Record<string, string[]> = {
  "Sabrina Carpenter": ["Chappell Roan", "Olivia Rodrigo", "Billie Eilish", "Gracie Abrams", "Madison Beer", "Dua Lipa", "KATSEYE"],
  "Billie Eilish": ["Lana Del Rey", "Lorde", "Finneas", "Olivia Rodrigo", "Girl In Red", "Phoebe Bridgers", "Clairo"],
  "Kendrick Lamar": ["SZA", "Drake", "J. Cole", "Travis Scott", "Baby Keem", "Future", "Metro Boomin", "21 Savage"],
  "The Weeknd": ["Post Malone", "Bruno Mars", "Dua Lipa", "Doja Cat", "Frank Ocean", "SZA", "Khalid"],
  "Taylor Swift": ["Gracie Abrams", "Sabrina Carpenter", "Olivia Rodrigo", "Phoebe Bridgers", "Lana Del Rey", "Kacey Musgraves"],
  "Coldplay": ["The Killers", "Imagine Dragons", "OneRepublic", "U2", "Keane", "Snow Patrol"],
  "Drake": ["Kendrick Lamar", "Travis Scott", "Future", "Lil Baby", "21 Savage", "PARTYNEXTDOOR"],
  "Eminem": ["50 Cent", "Dr. Dre", "Snoop Dogg", "JAY-Z", "Kendrick Lamar", "Tupac"],
};

export interface RecommendationResult {
  tracks: any[];
  seed: {
    type: "track" | "artist" | "playlist" | "genre";
    name: string;
  };
}

export interface RadioStation {
  id: string;
  type: "track" | "artist";
  title: string;
  subtitle: string;
  coverUrl: string;
  tracks: any[];
}

/**
 * Normalizes a track object to standard Track interface
 */
function normalizeTrack(t: any) {
  return {
    id: t.id,
    title: t.title,
    duration: t.duration,
    streamCount: t.streamCount || 500000,
    audioUrl: t.audioUrl,
    lyrics: t.lyrics || null,
    explicit: Boolean(t.explicit),
    album: {
      id: t.album?.id || `alb_${t.id}`,
      title: t.album?.title || t.title,
      coverUrl: t.album?.coverUrl || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
    },
    artist: {
      id: t.artist?.id || `art_${t.id}`,
      name: t.artist?.name || "Various Artists",
    },
  };
}

/**
 * Gets recommended tracks for a given seed track
 */
export async function getRecommendationsForTrack(trackId: string, limit = 10): Promise<any[]> {
  try {
    // 1. Try finding track in DB
    const seedTrack = await prisma.track.findUnique({
      where: { id: trackId },
      include: { artist: true, album: true, genre: true },
    });

    let artistName = seedTrack?.artist?.name;
    let trackTitle = seedTrack?.title;
    let genreSlug = seedTrack?.genre?.slug;

    if (!seedTrack) {
      // If global track ID (e.g. global_123 or trk_...)
      const cleaned = trackId.replace(/^global_/, "").replace(/^trk_/, "").replace(/_/g, " ");
      trackTitle = cleaned;
      artistName = "Pop";
    }

    // 2. Fetch tracks by the same artist or same genre from DB
    const dbRecommendations = await prisma.track.findMany({
      where: {
        id: { not: trackId },
        OR: [
          artistName ? { artist: { name: artistName } } : {},
          genreSlug ? { genre: { slug: genreSlug } } : {},
        ],
      },
      include: { artist: true, album: true },
      take: limit,
      orderBy: { streamCount: "desc" },
    });

    let results = dbRecommendations.map(normalizeTrack);

    // 3. If we need more recommendations, query related artists in global music
    if (results.length < limit && artistName) {
      const related = RELATED_ARTIST_MAP[artistName] || [
        "Billie Eilish",
        "Sabrina Carpenter",
        "The Weeknd",
        "Kendrick Lamar",
      ];
      const randomRelated = related[Math.floor(Math.random() * related.length)];
      const globalTracks = await searchGlobalMusic(randomRelated, limit - results.length + 3);

      const existingIds = new Set(results.map((r) => r.id));
      for (const gt of globalTracks) {
        if (!existingIds.has(gt.id) && gt.id !== trackId) {
          results.push(normalizeTrack(gt));
          existingIds.add(gt.id);
        }
      }
    }

    return results.slice(0, limit);
  } catch (err) {
    console.error("getRecommendationsForTrack error:", err);
    return [];
  }
}

/**
 * Gets recommended tracks for an artist
 */
export async function getRecommendationsForArtist(artistIdOrName: string, limit = 15): Promise<any[]> {
  try {
    let artistName = artistIdOrName;
    const dbArtist = await prisma.artist.findFirst({
      where: {
        OR: [{ id: artistIdOrName }, { name: { contains: artistIdOrName } }],
      },
      include: { tracks: { include: { artist: true, album: true } } },
    });

    if (dbArtist) {
      artistName = dbArtist.name;
    }

    const related = RELATED_ARTIST_MAP[artistName] || [
      "Chappell Roan",
      "Olivia Rodrigo",
      "Billie Eilish",
      "Kendrick Lamar",
      "The Weeknd",
    ];

    const results: any[] = [];
    if (dbArtist?.tracks) {
      results.push(...dbArtist.tracks.map(normalizeTrack));
    }

    // Mix in top tracks from related artists
    for (const rel of related.slice(0, 3)) {
      if (results.length >= limit) break;
      const relTracks = await searchGlobalMusic(rel, 4);
      results.push(...relTracks.map(normalizeTrack));
    }

    return results.slice(0, limit);
  } catch (err) {
    console.error("getRecommendationsForArtist error:", err);
    return [];
  }
}

/**
 * Analyzes playlist contents and produces recommended tracks that are not yet in the playlist
 */
export async function getRecommendationsForPlaylist(
  playlistId: string,
  limit = 8
): Promise<any[]> {
  try {
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        tracks: {
          include: {
            track: { include: { artist: true, album: true } },
          },
        },
      },
    });

    if (!playlist) return [];

    const existingTrackIds = new Set(playlist.tracks.map((pt) => pt.track.id));
    const existingTitles = new Set(playlist.tracks.map((pt) => pt.track.title.toLowerCase()));

    // Extract seed artists from playlist
    const artistCounts = new Map<string, number>();
    playlist.tracks.forEach((pt) => {
      const name = pt.track.artist?.name;
      if (name) {
        artistCounts.set(name, (artistCounts.get(name) || 0) + 1);
      }
    });

    // Find top artist in playlist
    let seedArtist = "Sabrina Carpenter";
    let maxCount = 0;
    artistCounts.forEach((count, name) => {
      if (count > maxCount) {
        maxCount = count;
        seedArtist = name;
      }
    });

    // Also look at playlist title keywords (e.g. "Chill", "Hits", "Roadtrip", "Rock")
    let searchSeed = seedArtist;
    const titleLower = playlist.title.toLowerCase();
    if (titleLower.includes("rock")) searchSeed = "Rock classics";
    else if (titleLower.includes("pop")) searchSeed = "Pop hits";
    else if (titleLower.includes("chill")) searchSeed = "Chill indie";
    else if (titleLower.includes("hip")) searchSeed = "Hip Hop hits";

    // 1. Fetch DB candidates
    const dbCandidates = await prisma.track.findMany({
      where: {
        id: { notIn: Array.from(existingTrackIds) },
      },
      include: { artist: true, album: true },
      take: 15,
      orderBy: { streamCount: "desc" },
    });

    const recommendations: any[] = [];
    for (const trk of dbCandidates) {
      if (!existingTitles.has(trk.title.toLowerCase())) {
        recommendations.push(normalizeTrack(trk));
      }
    }

    // 2. Fetch Global candidates based on related artists
    const relatedArtists = RELATED_ARTIST_MAP[seedArtist] || ["Billie Eilish", "Taylor Swift", "Kendrick Lamar"];
    const randomArtist = relatedArtists[Math.floor(Math.random() * relatedArtists.length)];
    const globalTracks = await searchGlobalMusic(`${randomArtist} ${searchSeed}`, 10);

    for (const gt of globalTracks) {
      if (
        !existingTrackIds.has(gt.id) &&
        !existingTitles.has(gt.title.toLowerCase()) &&
        !recommendations.some((r) => r.title.toLowerCase() === gt.title.toLowerCase())
      ) {
        recommendations.push(normalizeTrack(gt));
      }
    }

    // Shuffle and pick
    const shuffled = recommendations.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, limit);
  } catch (err) {
    console.error("getRecommendationsForPlaylist error:", err);
    return [];
  }
}

/**
 * Generates an authentic Spotify Song Radio or Artist Radio station
 */
export async function generateRadioStation(
  type: "track" | "artist",
  seedId: string
): Promise<RadioStation | null> {
  try {
    let title = "Spotify Radio";
    let seedName = "Artist";
    let coverUrl = "https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/4oUHIQIBe0LHzYfvXNW4QM/en";
    let tracks: any[] = [];

    if (type === "track") {
      const dbTrack = await prisma.track.findUnique({
        where: { id: seedId },
        include: { artist: true, album: true },
      });

      if (dbTrack) {
        seedName = `${dbTrack.title}`;
        title = `${dbTrack.title} Radio`;
        coverUrl = dbTrack.album.coverUrl;
        tracks.push(normalizeTrack(dbTrack));
        const recs = await getRecommendationsForTrack(seedId, 25);
        tracks.push(...recs);
      } else {
        // Global track fallback
        const cleanTitle = seedId.replace(/^(global_|trk_)/, "").replace(/_/g, " ");
        title = `${cleanTitle} Radio`;
        const globalTracks = await searchGlobalMusic(cleanTitle, 20);
        tracks = globalTracks.map(normalizeTrack);
        if (tracks.length > 0) coverUrl = tracks[0].album.coverUrl;
      }
    } else {
      // Artist Radio
      const dbArtist = await prisma.artist.findFirst({
        where: {
          OR: [{ id: seedId }, { name: { contains: seedId.replace(/^art_/, "").replace(/_/g, " ") } }],
        },
        include: { tracks: { include: { artist: true, album: true } } },
      });

      if (dbArtist) {
        seedName = dbArtist.name;
        title = `${dbArtist.name} Radio`;
        coverUrl = dbArtist.avatarUrl;
        if (dbArtist.tracks) tracks.push(...dbArtist.tracks.map(normalizeTrack));
        const recs = await getRecommendationsForArtist(dbArtist.name, 25);
        tracks.push(...recs);
      } else {
        const cleanName = seedId.replace(/^art_/, "").replace(/_/g, " ");
        seedName = cleanName;
        title = `${cleanName} Radio`;
        const globalTracks = await searchGlobalMusic(cleanName, 25);
        tracks = globalTracks.map(normalizeTrack);
        if (tracks.length > 0) coverUrl = tracks[0].album.coverUrl;
      }
    }

    // Extract unique contributing artists for the "With X, Y, Z and more" subtitle
    const artistNames = Array.from(new Set(tracks.map((t) => t.artist?.name).filter(Boolean)));
    const sampleArtists = artistNames.slice(0, 3).join(", ");
    const subtitle = sampleArtists ? `With ${sampleArtists} and more` : "Spotify personalized radio station";

    // Deduplicate tracks by id or title
    const seen = new Set<string>();
    const uniqueTracks = tracks.filter((t) => {
      const key = `${t.title.toLowerCase()}_${t.artist.name.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      id: `radio_${type}_${seedId}`,
      type,
      title,
      subtitle,
      coverUrl,
      tracks: uniqueTracks.slice(0, 30),
    };
  } catch (err) {
    console.error("generateRadioStation error:", err);
    return null;
  }
}
