const { PrismaClient } = require("@prisma/client");
const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

// 1. Read Turso credentials from .env
const envPath = path.resolve(__dirname, "../.env");
const envContent = fs.readFileSync(envPath, "utf-8");
let tursoUrl = "";
let tursoToken = "";

for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("TURSO_DATABASE_URL=")) {
    tursoUrl = trimmed.split("=")[1].trim().replace(/^"|"$/g, "");
  }
  if (trimmed.startsWith("TURSO_AUTH_TOKEN=")) {
    tursoToken = trimmed.split("=")[1].trim().replace(/^"|"$/g, "");
  }
}

if (!tursoUrl || !tursoToken) {
  console.error("TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not found in .env");
  process.exit(1);
}

// 2. Connect to local dev.db using Prisma
process.env.DATABASE_URL = "file:./dev.db";
const localPrisma = new PrismaClient({
  datasources: { db: { url: "file:./dev.db" } },
});

// 3. Connect to Turso using @libsql/client
const tursoClient = createClient({
  url: tursoUrl,
  authToken: tursoToken,
});

async function main() {
  console.log("Reading data from local dev.db...");

  const genres = await localPrisma.genre.findMany();
  const artists = await localPrisma.artist.findMany();
  const albums = await localPrisma.album.findMany();
  const tracks = await localPrisma.track.findMany();
  const users = await localPrisma.user.findMany();
  const playlists = await localPrisma.playlist.findMany();
  const playlistTracks = await localPrisma.playlistTrack.findMany();

  console.log(`Found in local dev.db:
  - ${genres.length} genres
  - ${artists.length} artists
  - ${albums.length} albums
  - ${tracks.length} tracks
  - ${users.length} users
  - ${playlists.length} playlists
  - ${playlistTracks.length} playlist tracks
  `);

  console.log("Connecting to Turso:", tursoUrl);

  // Disable foreign keys temporarily during data replacement
  await tursoClient.execute("PRAGMA foreign_keys = OFF;");

  console.log("Clearing outdated rows in Turso...");
  await tursoClient.execute("DELETE FROM PlaylistTrack;");
  await tursoClient.execute("DELETE FROM Track;");
  await tursoClient.execute("DELETE FROM Album;");
  await tursoClient.execute("DELETE FROM Artist;");
  await tursoClient.execute("DELETE FROM Genre;");
  await tursoClient.execute("DELETE FROM Playlist;");
  await tursoClient.execute("DELETE FROM User;");

  console.log("Inserting clean synced data from dev.db...");

  // 1. Genres
  for (const g of genres) {
    await tursoClient.execute({
      sql: `INSERT INTO Genre (id, name, slug, colorHex, imageUrl) VALUES (?, ?, ?, ?, ?)`,
      args: [g.id, g.name, g.slug, g.colorHex, g.imageUrl],
    });
  }
  console.log("✓ Genres synced:", genres.length);

  // 2. Artists
  for (const a of artists) {
    await tursoClient.execute({
      sql: `INSERT INTO Artist (id, name, avatarUrl, headerUrl, bio, verified, monthlyListeners, rankGlobal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [a.id, a.name, a.avatarUrl, a.headerUrl, a.bio, a.verified ? 1 : 0, a.monthlyListeners, a.rankGlobal],
    });
  }
  console.log("✓ Artists synced:", artists.length);

  // 3. Albums
  for (const al of albums) {
    await tursoClient.execute({
      sql: `INSERT INTO Album (id, title, coverUrl, releaseYear, releaseDate, type, copyright, artistId, genreId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [al.id, al.title, al.coverUrl, al.releaseYear, al.releaseDate, al.type, al.copyright, al.artistId, al.genreId],
    });
  }
  console.log("✓ Albums synced:", albums.length);

  // 4. Tracks
  for (const t of tracks) {
    await tursoClient.execute({
      sql: `INSERT INTO Track (id, title, duration, streamCount, audioUrl, lyrics, explicit, trackNumber, discNumber, albumId, artistId, genreId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [t.id, t.title, t.duration, t.streamCount, t.audioUrl, t.lyrics, t.explicit ? 1 : 0, t.trackNumber, t.discNumber, t.albumId, t.artistId, t.genreId],
    });
  }
  console.log("✓ Tracks synced:", tracks.length);

  // 5. Users
  for (const u of users) {
    await tursoClient.execute({
      sql: `INSERT INTO User (id, email, passwordHash, displayName, avatarUrl, role, plan, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        u.id,
        u.email,
        u.passwordHash,
        u.displayName,
        u.avatarUrl,
        u.role,
        u.plan,
        u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
        u.updatedAt ? u.updatedAt.toISOString() : new Date().toISOString(),
      ],
    });
  }
  console.log("✓ Users synced:", users.length);

  // 6. Playlists
  for (const p of playlists) {
    await tursoClient.execute({
      sql: `INSERT INTO Playlist (id, title, description, coverUrl, isPublic, ownerId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        p.id,
        p.title,
        p.description || null,
        p.coverUrl || null,
        p.isPublic ? 1 : 0,
        p.ownerId || p.userId || "usr_demo",
        p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
        p.updatedAt ? p.updatedAt.toISOString() : new Date().toISOString(),
      ],
    });
  }
  console.log("✓ Playlists synced:", playlists.length);

  // 7. PlaylistTracks
  let ptCount = 0;
  for (const pt of playlistTracks) {
    try {
      await tursoClient.execute({
        sql: `INSERT INTO PlaylistTrack (id, playlistId, trackId, addedAt, position) VALUES (?, ?, ?, ?, ?)`,
        args: [
          pt.id,
          pt.playlistId,
          pt.trackId,
          pt.addedAt ? pt.addedAt.toISOString() : new Date().toISOString(),
          pt.position ?? 0,
        ],
      });
      ptCount++;
    } catch {
      // Ignore duplicates
    }
  }
  console.log("✓ PlaylistTracks synced:", ptCount);

  // Re-enable foreign keys
  await tursoClient.execute("PRAGMA foreign_keys = ON;");

  // Verify
  const trackCheck = await tursoClient.execute("SELECT COUNT(*) as count FROM Track");
  console.log(`\n🎉 Turso verification complete: ${trackCheck.rows[0].count} tracks now in Turso.`);

  // Test first 5 tracks in Turso
  const sampleTracks = await tursoClient.execute("SELECT title, audioUrl FROM Track WHERE audioUrl LIKE 'http%' LIMIT 5");
  console.log("\nVerifying live audio stream URLs from Turso:");
  for (const row of sampleTracks.rows) {
    try {
      const res = await fetch(row.audioUrl, { method: "HEAD" });
      console.log(`  - [HTTP ${res.status} ${res.statusText}] ${row.title}: ${row.audioUrl.slice(0, 55)}...`);
    } catch (e) {
      console.warn(`  - [ERROR] ${row.title}:`, e.message);
    }
  }

  await localPrisma.$disconnect();
  tursoClient.close();
}

main().catch(async (e) => {
  console.error("Sync error:", e);
  await localPrisma.$disconnect();
  process.exit(1);
});
