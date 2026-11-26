import test from "node:test";
import assert from "node:assert/strict";

import {
  decryptApiKey,
  encryptApiKey,
  isApiKeyEncryptionConfigured,
} from "../../src/utils/apiKeyEncryption.js";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

function withEncryptionKey<T>(value: string | undefined, fn: () => T): T {
  const previous = process.env.API_KEY_ENCRYPTION_KEY;
  if (value === undefined) {
    delete process.env.API_KEY_ENCRYPTION_KEY;
  } else {
    process.env.API_KEY_ENCRYPTION_KEY = value;
  }

  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.API_KEY_ENCRYPTION_KEY;
    } else {
      process.env.API_KEY_ENCRYPTION_KEY = previous;
    }
  }
}

test("encryptApiKey/decryptApiKey round-trips the raw key", () => {
  withEncryptionKey(TEST_KEY, () => {
    const rawKey = "dr_live_0123456789abcdef0123456789abcdef0123456789abcdef0123456789ab";
    const encrypted = encryptApiKey(rawKey);

    assert.ok(encrypted.encryptedKey);
    assert.ok(encrypted.encryptionIv);
    assert.ok(encrypted.encryptionTag);
    assert.notEqual(encrypted.encryptedKey, rawKey);

    const decrypted = decryptApiKey(encrypted);
    assert.equal(decrypted, rawKey);
  });
});

test("decryptApiKey fails on invalid auth tag", () => {
  withEncryptionKey(TEST_KEY, () => {
    const encrypted = encryptApiKey("dr_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const tampered = {
      ...encrypted,
      encryptionTag: Buffer.alloc(16, 1).toString("base64"),
    };

    assert.throws(() => decryptApiKey(tampered), /Failed to decrypt API key/);
  });
});

test("decryptApiKey fails on invalid ciphertext", () => {
  withEncryptionKey(TEST_KEY, () => {
    const encrypted = encryptApiKey("dr_live_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    const tampered = {
      ...encrypted,
      encryptedKey: Buffer.from("not-the-right-ciphertext").toString("base64"),
    };

    assert.throws(() => decryptApiKey(tampered), /Failed to decrypt API key/);
  });
});

test("decryptApiKey reports legacy/not-recoverable records", () => {
  withEncryptionKey(TEST_KEY, () => {
    assert.throws(
      () =>
        decryptApiKey({
          encryptedKey: null,
          encryptionIv: null,
          encryptionTag: null,
        }),
      /not recoverable/,
    );
  });
});

test("encryption configuration is detected from env", () => {
  withEncryptionKey(undefined, () => {
    assert.equal(isApiKeyEncryptionConfigured(), false);
  });

  withEncryptionKey(TEST_KEY, () => {
    assert.equal(isApiKeyEncryptionConfigured(), true);
  });

  withEncryptionKey("too-short", () => {
    assert.equal(isApiKeyEncryptionConfigured(), false);
  });
});
