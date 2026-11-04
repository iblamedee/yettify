const { PrismaClient } = require('@prisma/client');
const CryptoJS = require('crypto-js');

const prisma = new PrismaClient();

function decryptSaavnUrl(encUrl) {
  if (!encUrl) return null;
  try {
    const key = CryptoJS.enc.Utf8.parse('38346591');
    const decrypted = CryptoJS.DES.decrypt(
      { ciphertext: CryptoJS.enc.Base64.parse(encUrl) },
      key,
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
    );
    const rawUrl = decrypted.toString(CryptoJS.enc.Utf8).trim();
    if (!rawUrl || !rawUrl.startsWith('http')) return null;
    return rawUrl.replace(/_96\./, '_320.');
  } catch {
    return null;
  }
}

async function resolveAudio(title, artistName) {
  const query = `${artistName} ${title}`.trim();
  try {
    const res = await fetch(`https://www.jiosaavn.com/api.php?__call=search.getResults&_marker=0&api_version=4&_format=json&p=1&n=3&q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const data = await res.json();
    const results = data.results || [];
    for (const song of results) {
      const encUrl = song.encrypted_media_url || song.more_info?.encrypted_media_url;
      const url = decryptSaavnUrl(encUrl);
      if (url) {
        // verify head
        const head = await fetch(url, { method: 'HEAD' });
        if (head.status === 200) {
          return {
            url,
            duration: parseInt(song.duration || '210', 10),
            has320: true
          };
        }
      }
    }
  } catch (err) {
    console.error(`Error resolving ${query}:`, err.message);
  }
  return null;
}

async function updateAllTracks() {
  const tracks = await prisma.track.findMany({
    include: { artist: true }
  });

  console.log(`Found ${tracks.length} tracks in database. Updating audio URLs...`);

  let updated = 0;
  for (const track of tracks) {
    console.log(`Resolving: "${track.title}" by ${track.artist.name}...`);
    const resolved = await resolveAudio(track.title, track.artist.name);
    if (resolved) {
      await prisma.track.update({
        where: { id: track.id },
        data: {
          audioUrl: resolved.url,
          duration: resolved.duration || track.duration
        }
      });
      console.log(`  -> SUCCESS! 320kbps Stream: ${resolved.url.slice(0, 60)}...`);
      updated++;
    } else {
      console.log(`  -> Kept existing audioUrl.`);
    }
  }

  console.log(`\nDone! Successfully updated ${updated}/${tracks.length} tracks with real full-length 320kbps streams.`);
}

updateAllTracks()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
