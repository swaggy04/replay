import test from "node:test";
import assert from "node:assert/strict";

import { rawKeyForKeyId } from "./apiKeys";
import type { CreatedApiKey } from "@/components/requestsApi";

const createdKey: CreatedApiKey = {
  id: "key-1",
  keyPrefix: "dr_live_abcd",
  projectId: "project-1",
  createdAt: "2026-11-25T10:00:00Z",
  rawKey: "dr_live_secretsecretsecret",
};

test("rawKeyForKeyId exposes the raw secret only for the just-created key", () => {
  assert.equal(rawKeyForKeyId("key-1", createdKey), "dr_live_secretsecretsecret");
});

test("rawKeyForKeyId returns undefined for other keys and when none was created", () => {
  assert.equal(rawKeyForKeyId("key-2", createdKey), undefined);
  assert.equal(rawKeyForKeyId("key-1", null), undefined);
});

test("existing listed keys never expose a copyable plaintext secret", () => {
  // Listed keys have only the masked prefix (no rawKey). As long as
  // newApiKey is null, no row may be treated as copyable.
  const existingKey = { id: "key-2", keyPrefix: "dr_live_efgh", createdAt: "2026-11-24T10:00:00Z" };
  assert.equal("rawKey" in existingKey, false);
  assert.equal(rawKeyForKeyId(existingKey.id, createdKey), undefined);
});
