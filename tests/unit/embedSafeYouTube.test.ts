import test from "node:test";
import assert from "node:assert/strict";
import { isChannelEmbedRestricted } from "../../lib/musicEngine";

test("isChannelEmbedRestricted flags VEVO channels as restricted", () => {
  assert.equal(isChannelEmbedRestricted("TheWeekndVEVO"), true);
  assert.equal(isChannelEmbedRestricted("TaylorSwiftVEVO"), true);
  assert.equal(isChannelEmbedRestricted("vevo"), true);
  assert.equal(isChannelEmbedRestricted("VEVO Official"), true);
  assert.equal(isChannelEmbedRestricted("The Weeknd", "https://youtube.com/@TheWeekndVEVO"), true);
});

test("isChannelEmbedRestricted flags auto-generated Topic channels as restricted", () => {
  assert.equal(isChannelEmbedRestricted("The Weeknd - Topic"), true);
  assert.equal(isChannelEmbedRestricted("Kendrick Lamar - Topic"), true);
  assert.equal(isChannelEmbedRestricted("Artist-Topic"), true);
  assert.equal(isChannelEmbedRestricted("Artist - Topic"), true);
});

test("isChannelEmbedRestricted allows clean audio and lyric channels", () => {
  assert.equal(isChannelEmbedRestricted("7clouds"), false);
  assert.equal(isChannelEmbedRestricted("Dan Music"), false);
  assert.equal(isChannelEmbedRestricted("Shadow Music"), false);
  assert.equal(isChannelEmbedRestricted("The Weeknd"), false);
  assert.equal(isChannelEmbedRestricted("Kendrick Lamar"), false);
});
