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

  async function batchWithRetry(statements, retries = 3) {
    if (!statements.length) return;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await tursoClient.batch(statements, "write");
      } catch (err) {
        if (attempt === retries) throw err;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  // Disable foreign keys temporarily during data replacement
  await tursoClient.execute("PRAGMA foreign_keys = OFF;");

  console.log("Clearing outdated rows in Turso...");
  await batchWithRetry([
    "DELETE FROM PlaylistTrack;",
    "DELETE FROM Track;",
    "DELETE FROM Album;",
    "DELETE FROM Artist;",
    "DELETE FROM Genre;",
    "DELETE FROM Playlist;",
    "DELETE FROM User;",
  ]);

  console.log("Inserting clean synced data from dev.db in batches...");

  // 1. Genres
  const genreStmts = genres.map((g) => ({
    sql: `INSERT INTO Genre (id, name, slug, colorHex, imageUrl) VALUES (?, ?, ?, ?, ?)`,
    args: [g.id, g.name, g.slug, g.colorHex, g.imageUrl],
  }));
  await batchWithRetry(genreStmts);
  console.log("✓ Genres synced:", genres.length);

  // 2. Artists
  const artistStmts = artists.map((a) => ({
    sql: `INSERT INTO Artist (id, name, avatarUrl, headerUrl, bio, verified, monthlyListeners, rankGlobal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [a.id, a.name, a.avatarUrl, a.headerUrl, a.bio, a.verified ? 1 : 0, a.monthlyListeners, a.rankGlobal],
  }));
  await batchWithRetry(artistStmts);
  console.log("✓ Artists synced:", artists.length);

  // 3. Albums
  const albumStmts = albums.map((al) => ({
    sql: `INSERT INTO Album (id, title, coverUrl, releaseYear, releaseDate, type, copyright, artistId, genreId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [al.id, al.title, al.coverUrl, al.releaseYear, al.releaseDate, al.type, al.copyright, al.artistId, al.genreId],
  }));
  await batchWithRetry(albumStmts);
  console.log("✓ Albums synced:", albums.length);

  // 4. Tracks in chunks of 25
  for (let i = 0; i < tracks.length; i += 25) {
    const chunk = tracks.slice(i, i + 25);
    const trackStmts = chunk.map((t) => ({
      sql: `INSERT INTO Track (id, title, duration, streamCount, audioUrl, lyrics, explicit, trackNumber, discNumber, albumId, artistId, genreId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [t.id, t.title, t.duration, t.streamCount, t.audioUrl, t.lyrics, t.explicit ? 1 : 0, t.trackNumber, t.discNumber, t.albumId, t.artistId, t.genreId],
    }));
    await batchWithRetry(trackStmts);
  }
  console.log("✓ Tracks synced:", tracks.length);

  // 5. Users
  const userStmts = users.map((u) => ({
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
  }));
  await batchWithRetry(userStmts);
  console.log("✓ Users synced:", users.length);

  // 6. Playlists in chunks of 15
  for (let i = 0; i < playlists.length; i += 15) {
    const chunk = playlists.slice(i, i + 15);
    const playlistStmts = chunk.map((p) => ({
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
    }));
    await batchWithRetry(playlistStmts);
  }
  console.log("✓ Playlists synced:", playlists.length);

  // 7. PlaylistTracks in chunks of 20
  for (let i = 0; i < playlistTracks.length; i += 20) {
    const chunk = playlistTracks.slice(i, i + 20);
    const ptStmts = chunk.map((pt) => ({
      sql: `INSERT OR IGNORE INTO PlaylistTrack (id, playlistId, trackId, addedAt, position) VALUES (?, ?, ?, ?, ?)`,
      args: [
        pt.id,
        pt.playlistId,
        pt.trackId,
        pt.addedAt ? pt.addedAt.toISOString() : new Date().toISOString(),
        pt.position ?? 0,
      ],
    }));
    await batchWithRetry(ptStmts);
  }
  console.log("✓ PlaylistTracks synced:", playlistTracks.length);

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
