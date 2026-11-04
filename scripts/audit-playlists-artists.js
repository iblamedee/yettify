const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function audit() {
  console.log("=== AUDITING PLAYLISTS ===");
  const playlists = await prisma.playlist.findMany({
    include: {
      tracks: {
        include: {
          track: {
            include: { artist: true, album: true }
          }
        }
      },
      owner: true
    }
  });

  console.log(`Total playlists: ${playlists.length}`);
  for (const pl of playlists) {
    console.log(`Playlist "${pl.title}" (id: ${pl.id}):`);
    console.log(`  coverUrl: ${pl.coverUrl}`);
    console.log(`  tracksCount: ${pl.tracks.length}`);
    if (pl.tracks.length > 0) {
      console.log(`  sample track: "${pl.tracks[0].track.title}" by "${pl.tracks[0].track.artist?.name}" [album cover: ${pl.tracks[0].track.album?.coverUrl?.slice(0, 40)}]`);
    }
  }

  console.log("\n=== AUDITING TRACKS WITHOUT ARTISTS OR WITH EMPTY ARTISTS ===");
  const tracksWithoutArtist = await prisma.track.findMany({
    where: {
      OR: [
        { artist: { name: "" } },
        { artist: { name: "Unknown Artist" } },
        { artist: { name: "Various Artists" } },
        { artist: { name: "undefined" } }
      ]
    },
    include: { artist: true, album: true }
  });

  console.log(`Tracks with missing/generic artist: ${tracksWithoutArtist.length}`);
  for (const t of tracksWithoutArtist) {
    console.log(` - ID: ${t.id}, Title: "${t.title}", Artist: "${t.artist?.name}", Album: "${t.album?.title}"`);
  }
}

audit().finally(() => prisma.$disconnect());
