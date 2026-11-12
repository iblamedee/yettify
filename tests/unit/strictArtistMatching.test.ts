import test from "node:test";
import assert from "node:assert/strict";
import { checkJioSaavnVerified } from "../../lib/musicEngine";

test("checkJioSaavnVerified rejects candidate when artist does not match requested artist", async () => {
  // Starboy by idontknowjeffery must NOT match The Weeknd's Starboy on JioSaavn
  const result = await checkJioSaavnVerified("Starboy", "idontknowjeffery");
  assert.equal(result, null, "Should return null when artist does not match requested artist");
});

test("checkJioSaavnVerified accepts candidate when artist matches requested artist", async () => {
  // Starboy by The Weeknd should match
  const result = await checkJioSaavnVerified("Starboy", "The Weeknd");
  assert.ok(result, "Should match when artist is The Weeknd");
  assert.ok(result?.audioUrl.includes("saavncdn.com"));
});
