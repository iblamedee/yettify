async function checkSearchArtists() {
  const queries = ["phonk", "lofi", "gaming", "remix", "bollywood", "krishnahazar", "anime"];
  for (const q of queries) {
    const res = await fetch(`http://localhost:3000/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    console.log(`\n=== QUERY: "${q}" ===`);
    const tracks = data.tracks || [];
    let missingOrGeneric = 0;
    tracks.forEach((t, i) => {
      const art = t.artist?.name;
      if (!art || art === "Various Artists" || art === "undefined" || art === "YouTube Music" || art.trim() === "") {
        missingOrGeneric++;
        console.log(`  [MISSING/GENERIC ARTIST] Title: "${t.title}", Artist: "${art}", Source: ${t.id}`);
      }
    });
    console.log(`Total tracks: ${tracks.length}, Missing/Generic: ${missingOrGeneric}`);
  }
}

checkSearchArtists();
