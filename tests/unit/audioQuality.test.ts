import test from "node:test";
import assert from "node:assert/strict";
import { getQualityTierFromBitrate, resolveStreamQuality } from "../../lib/audioQuality";

test("getQualityTierFromBitrate maps 320kbps to ULTRA HD", () => {
  assert.equal(getQualityTierFromBitrate(320), "ULTRA HD");
  assert.equal(getQualityTierFromBitrate("320"), "ULTRA HD");
});

test("getQualityTierFromBitrate maps 160-256kbps to HD", () => {
  assert.equal(getQualityTierFromBitrate(160), "HD");
  assert.equal(getQualityTierFromBitrate(256), "HD");
});

test("getQualityTierFromBitrate maps <= 128kbps to SD", () => {
  assert.equal(getQualityTierFromBitrate(96), "SD");
  assert.equal(getQualityTierFromBitrate(128), "SD");
});

test("resolveStreamQuality parses direct JioSaavn CDN URLs", () => {
  const ultra = resolveStreamQuality("https://aac.saavncdn.com/123/sample_320.mp4", "jiosaavn");
  assert.equal(ultra.tier, "ULTRA HD");
  assert.equal(ultra.bitrate, 320);

  const hd = resolveStreamQuality("https://aac.saavncdn.com/123/sample_160.mp4", "jiosaavn");
  assert.equal(hd.tier, "HD");
  assert.equal(hd.bitrate, 160);

  const sd = resolveStreamQuality("https://aac.saavncdn.com/123/sample_96.mp4", "jiosaavn");
  assert.equal(sd.tier, "SD");
  assert.equal(sd.bitrate, 96);
});

test("resolveStreamQuality handles YouTube source as SD", () => {
  const yt = resolveStreamQuality(null, "youtube");
  assert.equal(yt.tier, "SD");
  assert.equal(yt.bitrate, 128);
});

test("resolveStreamQuality falls back to user preferences when URL is generic", () => {
  assert.equal(resolveStreamQuality("/api/stream?title=test", undefined, "HIGH").tier, "ULTRA HD");
  assert.equal(resolveStreamQuality("/api/stream?title=test", undefined, "NORMAL").tier, "HD");
  assert.equal(resolveStreamQuality("/api/stream?title=test", undefined, "LOW").tier, "SD");
});
