const { PrismaClient } = require("@prisma/client");
const { PrismaLibSQL } = require("@prisma/adapter-libsql");
const { createClient } = require("@libsql/client");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

// Load .env
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[key] = val;
    }
  }
}

let prisma;
if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
  const libsql = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const adapter = new PrismaLibSQL(libsql);
  prisma = new PrismaClient({ adapter });
} else {
  prisma = new PrismaClient();
}

// High-fidelity royalty-free MP3 audio streams for genuine web playback
const SAMPLE_AUDIO = [
  "https://cdn.freesound.org/previews/612/612613_5674468-lq.mp3",
  "https://cdn.freesound.org/previews/682/682631_11861866-lq.mp3",
  "https://cdn.freesound.org/previews/573/573577_11861866-lq.mp3",
  "https://cdn.freesound.org/previews/530/530704_11861866-lq.mp3",
  "https://cdn.freesound.org/previews/515/515632_11861866-lq.mp3",
  "https://cdn.freesound.org/previews/462/462809_9961300-lq.mp3",
];

const SAMPLE_LYRICS_BIRDS = `[00:00.00] (Instrumental intro)
[00:12.50] I want you to stay
[00:15.30] 'Til I'm in the grave
[00:18.20] 'Til I rot away, dead and buried
[00:22.00] 'Til I'm in the casket you carry
[00:25.50] If you go, I'm goin' too, uh
[00:29.00] 'Cause it was always you, alright
[00:32.40] And if I'm turnin' blue, please don't save me
[00:35.80] Nothin' in this world to distrust me
[00:39.10] Birds of a feather, we should stick together, I know
[00:46.00] I said I'd never think I wasn't better alone
[00:52.80] Can't change the weather, might not be forever
[00:57.20] But if it's forever, it's even better
[01:03.50] And I don't know what I'm cryin' for
[01:07.00] I don't think I could love you more
[01:10.50] It might not be long, but baby, I
[01:14.20] I'll love you 'til the day that I die`;

const SAMPLE_LYRICS_ESPRESSO = `[00:00.00] Now he's thinkin' 'bout me every night, oh
[00:03.80] Is it that sweet? I guess so
[00:07.50] Say you can't sleep, baby, I know
[00:11.20] That's that me, espresso
[00:14.90] Move it up, down, left, right, oh
[00:18.50] Switch it up like Nintendo
[00:22.10] Say you can't sleep, baby, I know
[00:25.80] That's that me, espresso
[00:29.50] I can't relate to desperation
[00:33.20] My give-a-fucks are on vacation`;

async function main() {
  console.log("Seeding database...");

  // Clean existing tables
  await prisma.playHistory.deleteMany();
  await prisma.playlistTrack.deleteMany();
  await prisma.userLikedTrack.deleteMany();
  await prisma.userSavedAlbum.deleteMany();
  await prisma.userFollowedArtist.deleteMany();
  await prisma.userPreferences.deleteMany();
  await prisma.track.deleteMany();
  await prisma.album.deleteMany();
  await prisma.playlist.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.genre.deleteMany();
  await prisma.user.deleteMany();

  // 1. Seed Genres
  const genresData = [
    { name: "Pop", slug: "pop", colorHex: "#148a08", imageUrl: "https://i.scdn.co/image/ab67fb8200005caf7be0c1d957dcc71a7241cc85" },
    { name: "Hip-Hop", slug: "hip-hop", colorHex: "#bc5900", imageUrl: "https://i.scdn.co/image/ab676d630000e1f065710a92b40492f6e3dbb819" },
    { name: "Rock", slug: "rock", colorHex: "#e91429", imageUrl: "https://i.scdn.co/image/ab67fb8200005cafda4c849095796a9e5d2c4ddb" },
    { name: "Indie", slug: "indie", colorHex: "#608108", imageUrl: "https://i.scdn.co/image/ab67fb8200005cafc16563d1c10280c1e7b21ac0" },
    { name: "Dance/Electronic", slug: "dance-electronic", colorHex: "#0d73ec", imageUrl: "https://i.scdn.co/image/ab67fb8200005caf26ada793217994216c79dad8" },
    { name: "Chill", slug: "chill", colorHex: "#d84000", imageUrl: "https://i.scdn.co/image/ab67fb8200005caf330ca3a3bfaf8b18407fb33e" },
    { name: "Mood", slug: "mood", colorHex: "#8d67ab", imageUrl: "https://i.scdn.co/image/ab67fb8200005cafe542e9b59b1d2ae04b46b91c" },
    { name: "Charts", slug: "charts", colorHex: "#8d67ab", imageUrl: "https://charts-images.scdn.co/assets/locale_en/regional/weekly/region_global_default.jpg" },
    { name: "Podcasts", slug: "podcasts", colorHex: "#006450", imageUrl: "https://i.scdn.co/image/ab67fb8200005caf6cc0187b9ea66de1525c3cec" },
  ];

  const genres = {};
  for (const g of genresData) {
    genres[g.slug] = await prisma.genre.create({ data: g });
  }

  // 2. Seed Demo User
  const passwordHash = await bcrypt.hash("demopassword123", 10);
  const demoUser = await prisma.user.create({
    data: {
      id: "usr_demo",
      email: "demo@spotify.com",
      passwordHash,
      displayName: "Alex Rivers",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop",
      role: "USER",
      plan: "PREMIUM",
      preferences: {
        create: {
          autoplay: true,
          crossfadeSeconds: 4,
          normalizeVolume: true,
          audioQuality: "HIGH",
          explicitContentFilter: false,
          language: "en",
        },
      },
    },
  });

  // 3. Seed Artists
  const billie = await prisma.artist.create({
    data: {
      id: "art_billie",
      name: "Billie Eilish",
      avatarUrl: "https://i.scdn.co/image/ab676161000051744a21b4760d2ecb7b0dcdc8da",
      headerUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1600&h=600&fit=crop",
      verified: true,
      monthlyListeners: 80983733,
      rankGlobal: 15,
      bio: "Billie Eilish remains one of the biggest stars to emerge in the 21st century. Her third studio album, HIT ME HARD AND SOFT features 10 tracks written and recorded in Los Angeles with her brother and producer FINNEAS. 9-time GRAMMY® Award-winner.",
    },
  });

  const sabrina = await prisma.artist.create({
    data: {
      id: "art_sabrina",
      name: "Sabrina Carpenter",
      avatarUrl: "https://i.scdn.co/image/ab676161000051740c68f6c95232e716f0abee8d",
      headerUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1600&h=600&fit=crop",
      verified: true,
      monthlyListeners: 84310000,
      rankGlobal: 8,
      bio: "Sabrina Carpenter has enchanted millions of fans worldwide as an acclaimed singer, songwriter, and powerhouse pop icon.",
    },
  });

  const kendrick = await prisma.artist.create({
    data: {
      id: "art_kendrick",
      name: "Kendrick Lamar",
      avatarUrl: "https://i.scdn.co/image/ab6761610000517439ba6dcd4355c03de0b50918",
      headerUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1600&h=600&fit=crop",
      verified: true,
      monthlyListeners: 72400000,
      rankGlobal: 12,
      bio: "Kendrick Lamar is a Pulitzer Prize and multi-Grammy winning artist known for GNX, DAMN, and good kid, m.A.A.d city.",
    },
  });

  const weeknd = await prisma.artist.create({
    data: {
      id: "art_weeknd",
      name: "The Weeknd",
      avatarUrl: "https://i.scdn.co/image/ab67616100005174c1719ac9e6a75c1c25835018",
      verified: true,
      monthlyListeners: 108200000,
      rankGlobal: 1,
      bio: "The Weeknd is a Canadian singer, songwriter, and record producer renowned for sonic innovation and chart dominance.",
    },
  });

  const taylor = await prisma.artist.create({
    data: {
      id: "art_taylor",
      name: "Taylor Swift",
      avatarUrl: "https://i.scdn.co/image/ab6761610000517412184bdd29403de54cb9d9c7",
      verified: true,
      monthlyListeners: 95400000,
      rankGlobal: 2,
      bio: "Taylor Swift is one of the best-selling music artists of all time with 14 Grammy Awards.",
    },
  });

  // 4. Seed Albums & Tracks
  // Album 1: HIT ME HARD AND SOFT
  const hmhas = await prisma.album.create({
    data: {
      id: "alb_hmhas",
      title: "HIT ME HARD AND SOFT",
      coverUrl: "https://i.scdn.co/image/ab67616d00001e0271d62ea7ea8a5be92d3c1f62",
      releaseYear: 2024,
      releaseDate: "May 17, 2024",
      type: "album",
      copyright: "© 2024 Darkroom/Interscope Records ℗ 2024 Darkroom/Interscope Records",
      artistId: billie.id,
      genreId: genres["pop"].id,
    },
  });

  const billieTracksData = [
    { id: "trk_skinny", title: "SKINNY", duration: 219, streamCount: 420500120, explicit: false, trackNumber: 1 },
    { id: "trk_lunch", title: "LUNCH", duration: 179, streamCount: 890120300, explicit: true, trackNumber: 2 },
    { id: "trk_chihiro", title: "CHIHIRO", duration: 303, streamCount: 1316452644, explicit: false, trackNumber: 3 },
    { id: "trk_birds", title: "BIRDS OF A FEATHER", duration: 210, streamCount: 4057634268, explicit: false, trackNumber: 4, lyrics: SAMPLE_LYRICS_BIRDS },
    { id: "trk_wildflower", title: "WILDFLOWER", duration: 261, streamCount: 2321757168, explicit: false, trackNumber: 5 },
    { id: "trk_greatest", title: "THE GREATEST", duration: 293, streamCount: 389201900, explicit: false, trackNumber: 6 },
    { id: "trk_lamour", title: "L'AMOUR DE MA VIE", duration: 333, streamCount: 512900400, explicit: false, trackNumber: 7 },
    { id: "trk_diner", title: "THE DINER", duration: 186, streamCount: 298100200, explicit: false, trackNumber: 8 },
    { id: "trk_bittersuite", title: "BITTERSUITE", duration: 298, streamCount: 341000900, explicit: false, trackNumber: 9 },
    { id: "trk_blue", title: "BLUE", duration: 343, streamCount: 472190000, explicit: false, trackNumber: 10 },
  ];

  const allTracks = [];
  for (let i = 0; i < billieTracksData.length; i++) {
    const t = billieTracksData[i];
    const created = await prisma.track.create({
      data: {
        id: t.id,
        title: t.title,
        duration: t.duration,
        streamCount: t.streamCount,
        audioUrl: SAMPLE_AUDIO[i % SAMPLE_AUDIO.length],
        lyrics: t.lyrics || null,
        explicit: t.explicit,
        trackNumber: t.trackNumber,
        discNumber: 1,
        albumId: hmhas.id,
        artistId: billie.id,
        genreId: genres["pop"].id,
      },
    });
    allTracks.push(created);
  }

  // Album 2: Short n' Sweet by Sabrina Carpenter
  const shortNSweet = await prisma.album.create({
    data: {
      id: "alb_short",
      title: "Short n' Sweet",
      coverUrl: "https://i.scdn.co/image/ab67616d00001e02fd8d7a8d96871e791cb1f626",
      releaseYear: 2024,
      releaseDate: "August 23, 2024",
      type: "album",
      copyright: "© 2024 Island Records ℗ 2024 Island Records",
      artistId: sabrina.id,
      genreId: genres["pop"].id,
    },
  });

  const sabrinaTracksData = [
    { id: "trk_taste", title: "Taste", duration: 157, streamCount: 920000000, explicit: true, trackNumber: 1 },
    { id: "trk_please", title: "Please Please Please", duration: 186, streamCount: 1650000000, explicit: true, trackNumber: 2 },
    { id: "trk_espresso", title: "Espresso", duration: 175, streamCount: 1980000000, explicit: false, trackNumber: 3, lyrics: SAMPLE_LYRICS_ESPRESSO },
    { id: "trk_coincidence", title: "Coincidence", duration: 164, streamCount: 450000000, explicit: false, trackNumber: 4 },
    { id: "trk_bedchem", title: "Bed Chem", duration: 171, streamCount: 680000000, explicit: true, trackNumber: 5 },
  ];

  for (let i = 0; i < sabrinaTracksData.length; i++) {
    const t = sabrinaTracksData[i];
    const created = await prisma.track.create({
      data: {
        id: t.id,
        title: t.title,
        duration: t.duration,
        streamCount: t.streamCount,
        audioUrl: SAMPLE_AUDIO[(i + 2) % SAMPLE_AUDIO.length],
        lyrics: t.lyrics || null,
        explicit: t.explicit,
        trackNumber: t.trackNumber,
        discNumber: 1,
        albumId: shortNSweet.id,
        artistId: sabrina.id,
        genreId: genres["pop"].id,
      },
    });
    allTracks.push(created);
  }

  // Album 3: GNX by Kendrick Lamar
  const gnx = await prisma.album.create({
    data: {
      id: "alb_gnx",
      title: "GNX",
      coverUrl: "https://i.scdn.co/image/ab67616d00001e02e2a0a166493a2bde5480a420",
      releaseYear: 2024,
      releaseDate: "November 22, 2024",
      type: "album",
      copyright: "© 2024 pgLang/Interscope Records",
      artistId: kendrick.id,
      genreId: genres["hip-hop"].id,
    },
  });

  const kendrickTracksData = [
    { id: "trk_wacced", title: "wacced out murals", duration: 315, streamCount: 310000000, explicit: true, trackNumber: 1 },
    { id: "trk_squabble", title: "squabble up", duration: 157, streamCount: 520000000, explicit: true, trackNumber: 2 },
    { id: "trk_luther", title: "luther (feat. SZA)", duration: 177, streamCount: 680000000, explicit: false, trackNumber: 3 },
    { id: "trk_tvoff", title: "tv off", duration: 220, streamCount: 410000000, explicit: true, trackNumber: 4 },
  ];

  for (let i = 0; i < kendrickTracksData.length; i++) {
    const t = kendrickTracksData[i];
    const created = await prisma.track.create({
      data: {
        id: t.id,
        title: t.title,
        duration: t.duration,
        streamCount: t.streamCount,
        audioUrl: SAMPLE_AUDIO[(i + 4) % SAMPLE_AUDIO.length],
        explicit: t.explicit,
        trackNumber: t.trackNumber,
        discNumber: 1,
        albumId: gnx.id,
        artistId: kendrick.id,
        genreId: genres["hip-hop"].id,
      },
    });
    allTracks.push(created);
  }

  // 5. Seed Playlists
  const top50 = await prisma.playlist.create({
    data: {
      id: "pl_top50",
      title: "Top 50 - Global",
      description: "Your daily update of the most played tracks right now - Global.",
      coverUrl: "https://charts-images.scdn.co/assets/locale_en/regional/daily/region_global_default.jpg",
      isPublic: true,
      ownerId: demoUser.id,
    },
  });

  const todaysHits = await prisma.playlist.create({
    data: {
      id: "pl_todayshits",
      title: "Today's Top Hits",
      description: "Sabrina Carpenter is on top of the Hottest 50!",
      coverUrl: "https://i.scdn.co/image/ab67706f000000020f97a2e6102ec66249888e81",
      isPublic: true,
      ownerId: demoUser.id,
    },
  });

  const roadtrip = await prisma.playlist.create({
    data: {
      id: "pl_roadtrip",
      title: "Summer Roadtrip Vibes",
      description: "Upbeat pop and hip-hop for driving with windows down.",
      coverUrl: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=500&h=500&fit=crop",
      isPublic: true,
      ownerId: demoUser.id,
    },
  });

  // Attach tracks to playlists
  for (let i = 0; i < allTracks.length; i++) {
    await prisma.playlistTrack.create({
      data: {
        playlistId: top50.id,
        trackId: allTracks[i].id,
        position: i,
      },
    });
  }

  for (let i = 0; i < 5; i++) {
    await prisma.playlistTrack.create({
      data: {
        playlistId: roadtrip.id,
        trackId: allTracks[i].id,
        position: i,
      },
    });
  }

  // 6. Seed User Likes & Saves for demo user
  for (let i = 0; i < 6; i++) {
    await prisma.userLikedTrack.create({
      data: {
        userId: demoUser.id,
        trackId: allTracks[i].id,
      },
    });
  }

  await prisma.userSavedAlbum.create({
    data: {
      userId: demoUser.id,
      albumId: hmhas.id,
    },
  });

  await prisma.userFollowedArtist.create({
    data: {
      userId: demoUser.id,
      artistId: billie.id,
    },
  });

  console.log("Database seeded successfully with artists, albums, tracks, playlists, and demo user!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
