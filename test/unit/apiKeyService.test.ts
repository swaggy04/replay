import test from "node:test";
import assert from "node:assert/strict";

import prisma from "../../src/lib/prisma.js";
import { getProjectApiKeys, revealApiKey } from "../../src/services/apiKeyService.js";
import { encryptApiKey } from "../../src/utils/apiKeyEncryption.js";

const TEST_MASTER_KEY = Buffer.alloc(32, 9).toString("base64");

function withEncryptionKey<T>(value: string | undefined, fn: () => Promise<T> | T): Promise<T> | T {
  const previous = process.env.API_KEY_ENCRYPTION_KEY;
  if (value === undefined) {
    delete process.env.API_KEY_ENCRYPTION_KEY;
  } else {
    process.env.API_KEY_ENCRYPTION_KEY = value;
  }

  const restore = () => {
    if (previous === undefined) {
      delete process.env.API_KEY_ENCRYPTION_KEY;
    } else {
      process.env.API_KEY_ENCRYPTION_KEY = previous;
    }
  };

  try {
    const result = fn();
    if (result && typeof (result as Promise<T>).then === "function") {
      return (result as Promise<T>).finally(restore);
    }
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

test("getProjectApiKeys returns canReveal metadata without encrypted fields", async () => {
  const project = prisma.project as any;
  const apiKey = prisma.apiKey as any;
  const originalFindFirst = project.findFirst;
  const originalFindMany = apiKey.findMany;

  project.findFirst = async () => ({ id: "project-1" });
  apiKey.findMany = async () => [
    {
      id: "key-1",
      keyPrefix: "dr_live_abcd",
      createdAt: new Date("2026-11-26T10:00:00Z"),
      encryptedKey: "cipher",
    },
    {
      id: "key-2",
      keyPrefix: "dr_live_efgh",
      createdAt: new Date("2026-11-25T10:00:00Z"),
      encryptedKey: null,
    },
  ];

  try {
    const keys = await getProjectApiKeys("project-1", "owner-1");
    assert.ok(keys);
    assert.deepEqual(keys, [
      {
        id: "key-1",
        keyPrefix: "dr_live_abcd",
        createdAt: new Date("2026-11-26T10:00:00Z"),
        canReveal: true,
      },
      {
        id: "key-2",
        keyPrefix: "dr_live_efgh",
        createdAt: new Date("2026-11-25T10:00:00Z"),
        canReveal: false,
      },
    ]);
  } finally {
    project.findFirst = originalFindFirst;
    apiKey.findMany = originalFindMany;
  }
});

test("revealApiKey returns not_found for missing/unowned/revoked key", async () => {
  const apiKey = prisma.apiKey as any;
  const originalFindFirst = apiKey.findFirst;
  apiKey.findFirst = async (args: any) => {
    // Ensure we filter for active key and owner scope.
    assert.equal(args.where.revokedAt, null);
    assert.equal(args.where.project.is.ownerId, "owner-1");
    return null;
  };

  try {
    const result = await revealApiKey("project-1", "key-1", "owner-1");
    assert.deepEqual(result, { ok: false, reason: "not_found" });
  } finally {
    apiKey.findFirst = originalFindFirst;
  }
});

test("revealApiKey returns not_recoverable for legacy hash-only key", async () => {
  const apiKey = prisma.apiKey as any;
  const originalFindFirst = apiKey.findFirst;
  apiKey.findFirst = async () => ({
    encryptedKey: null,
    encryptionIv: null,
    encryptionTag: null,
  });

  try {
    const result = await revealApiKey("project-1", "key-legacy", "owner-1");
    assert.deepEqual(result, { ok: false, reason: "not_recoverable" });
  } finally {
    apiKey.findFirst = originalFindFirst;
  }
});

test("revealApiKey decrypts an active owned key", async () => {
  await withEncryptionKey(TEST_MASTER_KEY, async () => {
    const rawKey = "dr_live_0123456789abcdef0123456789abcdef0123456789abcdef0123456789ab";
    const encrypted = encryptApiKey(rawKey);

    const apiKey = prisma.apiKey as any;
    const originalFindFirst = apiKey.findFirst;
    apiKey.findFirst = async () => encrypted;

    try {
      const result = await revealApiKey("project-1", "key-1", "owner-1");
      assert.deepEqual(result, { ok: true, rawKey });
    } finally {
      apiKey.findFirst = originalFindFirst;
    }
  });
});

test("revealApiKey reports missing encryption config", async () => {
  await withEncryptionKey(undefined, async () => {
    const apiKey = prisma.apiKey as any;
    const originalFindFirst = apiKey.findFirst;
    apiKey.findFirst = async () => ({
      encryptedKey: "x",
      encryptionIv: "y",
      encryptionTag: "z",
    });

    try {
      const result = await revealApiKey("project-1", "key-1", "owner-1");
      assert.deepEqual(result, { ok: false, reason: "encryption_not_configured" });
    } finally {
      apiKey.findFirst = originalFindFirst;
    }
  });
});
