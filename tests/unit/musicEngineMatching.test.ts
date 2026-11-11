import test from "node:test";
import assert from "node:assert/strict";
import {
  stripTrackArtifacts,
  cleanText,
  FORBIDDEN_COVER_KEYWORDS,
  FORBIDDEN_COVER_ARTISTS,
  decryptSaavnUrl,
} from "../../lib/musicEngine";

test("stripTrackArtifacts removes features, official video tags, and single tags", () => {
  assert.equal(stripTrackArtifacts("Blinding Lights (Official Music Video)"), "Blinding Lights");
  assert.equal(stripTrackArtifacts("Starboy (feat. Daft Punk)"), "Starboy");
  assert.equal(stripTrackArtifacts("Levitating - Featuring DaBaby"), "Levitating");
  assert.equal(stripTrackArtifacts("Flowers - Single"), "Flowers");
  assert.equal(stripTrackArtifacts("Numb [Official Video]"), "Numb");
});

test("cleanText normalizes case and removes special characters", () => {
  assert.equal(cleanText("Hello, World!"), "helloworld");
  assert.equal(cleanText("Rock & Roll"), "rockandroll");
  assert.equal(cleanText("The Weeknd"), "theweeknd");
});

test("FORBIDDEN_COVER_KEYWORDS contains all prominent spoof keywords", () => {
  const essentialKeywords = ["cover", "karaoke", "tribute", "instrumental", "lullaby", "party tyme", "lullapop"];
  for (const kw of essentialKeywords) {
    assert.ok(
      FORBIDDEN_COVER_KEYWORDS.includes(kw),
      `Expected ${kw} in FORBIDDEN_COVER_KEYWORDS`
    );
  }
});

test("FORBIDDEN_COVER_ARTISTS contains spoof artist bands", () => {
  const essentialArtists = ["lullapop", "party tyme", "the neon crew", "zzang karaoke", "midifine"];
  for (const art of essentialArtists) {
    assert.ok(
      FORBIDDEN_COVER_ARTISTS.includes(art),
      `Expected ${art} in FORBIDDEN_COVER_ARTISTS`
    );
  }
});

test("decryptSaavnUrl handles encrypted payload or returns null for invalid input", () => {
  assert.equal(decryptSaavnUrl(""), null);
  assert.equal(decryptSaavnUrl("invalid-base64-random-string"), null);
});
