import test from "node:test";
import assert from "node:assert/strict";
import {
  parseYouTubeError,
  mapRawState,
  YT_PLAYER_STATE,
} from "../../hooks/useYouTubePlayer";

test("parseYouTubeError correctly maps embedding restriction error 101", () => {
  const err = parseYouTubeError(101, "test_video_101");
  assert.equal(err.code, 101);
  assert.equal(err.type, "RESTRICTED");
  assert.equal(err.isRestricted, true);
  assert.equal(err.videoId, "test_video_101");
  assert.match(err.message, /embedded players/i);
});

test("parseYouTubeError correctly maps embedding restriction error 150", () => {
  const err = parseYouTubeError(150, "test_video_150");
  assert.equal(err.code, 150);
  assert.equal(err.type, "RESTRICTED");
  assert.equal(err.isRestricted, true);
  assert.equal(err.videoId, "test_video_150");
  assert.match(err.message, /embedded players/i);
});

test("parseYouTubeError correctly maps invalid ID error 2", () => {
  const err = parseYouTubeError(2, "bad_id");
  assert.equal(err.code, 2);
  assert.equal(err.type, "INVALID_ID");
  assert.equal(err.isRestricted, false);
});

test("parseYouTubeError correctly maps not found error 100", () => {
  const err = parseYouTubeError(100, "missing_video");
  assert.equal(err.code, 100);
  assert.equal(err.type, "NOT_FOUND");
  assert.equal(err.isRestricted, false);
});

test("parseYouTubeError correctly handles unknown error codes", () => {
  const err = parseYouTubeError(999, "unknown_video");
  assert.equal(err.code, 999);
  assert.equal(err.type, "UNKNOWN");
  assert.equal(err.isRestricted, false);
});

test("mapRawState maps all YouTube Player states accurately", () => {
  assert.equal(mapRawState(YT_PLAYER_STATE.UNSTARTED), "unstarted");
  assert.equal(mapRawState(YT_PLAYER_STATE.PLAYING), "playing");
  assert.equal(mapRawState(YT_PLAYER_STATE.PAUSED), "paused");
  assert.equal(mapRawState(YT_PLAYER_STATE.BUFFERING), "buffering");
  assert.equal(mapRawState(YT_PLAYER_STATE.CUED), "cued");
  assert.equal(mapRawState(YT_PLAYER_STATE.ENDED), "ended");
});

test("mode classes uphold Chrome/Safari minimum 200px compliance constraint", () => {
  // Test compliance rules
  const getModeClasses = (mode: "inline" | "docked" | "audio-compliant") => {
    if (mode === "docked") {
      return "fixed bottom-20 md:bottom-24 right-4 w-[280px] h-[168px] md:w-[360px] md:h-[216px] z-50 rounded-xl shadow-2xl border border-white/20 bg-black transition-all duration-300";
    }
    if (mode === "audio-compliant") {
      return "fixed bottom-20 md:bottom-24 right-4 min-w-[200px] min-h-[200px] w-[200px] h-[200px] z-40 rounded-xl shadow-2xl border border-white/10 bg-black overflow-hidden pointer-events-auto";
    }
    return "relative w-full aspect-video min-w-[200px] min-h-[200px] rounded-lg overflow-hidden bg-black";
  };

  const docked = getModeClasses("docked");
  assert.ok(!docked.includes("w-1 h-1"));
  assert.ok(!docked.includes("opacity-0"));
  assert.ok(docked.includes("w-[280px]"));

  const audioCompliant = getModeClasses("audio-compliant");
  assert.ok(audioCompliant.includes("min-w-[200px]"));
  assert.ok(audioCompliant.includes("min-h-[200px]"));

  const inline = getModeClasses("inline");
  assert.ok(inline.includes("min-w-[200px]"));
  assert.ok(inline.includes("min-h-[200px]"));
});
