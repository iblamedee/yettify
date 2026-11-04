async function verify(q) {
  const res = await fetch(`http://localhost:3000/api/search?q=${encodeURIComponent(q)}`);
  const data = await res.json();
  const t = data.tracks?.[0];
  if (t) {
    const head = await fetch(t.audioUrl, { method: 'HEAD' });
    console.log(`[PASS] Search "${q}" -> "${t.title}" by ${t.artist?.name} | Stream: ${head.status} (${(parseInt(head.headers.get('content-length')||'0')/1024/1024).toFixed(1)} MB)`);
  } else {
    console.log(`[FAIL] Search "${q}" -> No tracks found`);
  }
}

async function run() {
  await verify('Die With A Smile');
  await verify('Eminem Lose Yourself');
  await verify('Arijit Singh Kesariya');
  await verify('Billie Eilish BIRDS OF A FEATHER');
}

run().catch(console.error);
