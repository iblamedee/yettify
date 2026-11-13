import test from "node:test";
import assert from "node:assert/strict";

// Test silent wav data URI used for priming
export const SILENT_AUDIO_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

test("SILENT_AUDIO_WAV is a valid base64 audio URI", () => {
  assert.ok(SILENT_AUDIO_WAV.startsWith("data:audio/wav;base64,"));
  const base64 = SILENT_AUDIO_WAV.split(",")[1];
  const buf = Buffer.from(base64, "base64");
  assert.equal(buf.subarray(0, 4).toString(), "RIFF");
  assert.equal(buf.subarray(8, 12).toString(), "WAVE");
});

test("Audio priming state transitions accurately without ghost playing", () => {
  let isPlaying = false;
  const mockPlay = () => Promise.reject(new Error("NotAllowedError: user gesture required"));

  // Simulated handler: catching error must NOT set isPlaying to true
  const handlePlay = async () => {
    try {
      await mockPlay();
      isPlaying = true;
    } catch {
      isPlaying = false;
    }
  };

  return handlePlay().then(() => {
    assert.equal(isPlaying, false, "isPlaying must remain false when play() is rejected");
  });
});
