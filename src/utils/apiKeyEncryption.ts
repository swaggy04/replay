import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

export type EncryptedApiKey = {
  encryptedKey: string;
  encryptionIv: string;
  encryptionTag: string;
};

function parseMasterKey(raw: string): Buffer {
  const trimmed = raw.trim();

  // Accept 64-char hex or base64 encoding of 32 bytes.
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    key = Buffer.from(trimmed, "hex");
  } else {
    key = Buffer.from(trimmed, "base64");
  }

  if (key.length !== 32) {
    throw new Error(
      "API_KEY_ENCRYPTION_KEY must be 32 bytes (base64 or 64-char hex).",
    );
  }

  return key;
}

function getMasterKey(): Buffer {
  const raw = process.env.API_KEY_ENCRYPTION_KEY;
  if (!raw || !raw.trim()) {
    throw new Error("API_KEY_ENCRYPTION_KEY is not configured.");
  }

  return parseMasterKey(raw);
}

export function isApiKeyEncryptionConfigured(): boolean {
  const raw = process.env.API_KEY_ENCRYPTION_KEY;
  if (!raw || !raw.trim()) return false;
  try {
    parseMasterKey(raw);
    return true;
  } catch {
    return false;
  }
}

export function encryptApiKey(rawKey: string): EncryptedApiKey {
  const key = getMasterKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(rawKey, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    encryptedKey: ciphertext.toString("base64"),
    encryptionIv: iv.toString("base64"),
    encryptionTag: tag.toString("base64"),
  };
}

export function decryptApiKey(record: {
  encryptedKey: string | null;
  encryptionIv: string | null;
  encryptionTag: string | null;
}): string {
  if (!record.encryptedKey || !record.encryptionIv || !record.encryptionTag) {
    throw new Error("API key is not recoverable.");
  }

  const key = getMasterKey();
  const iv = Buffer.from(record.encryptionIv, "base64");
  const tag = Buffer.from(record.encryptionTag, "base64");
  const ciphertext = Buffer.from(record.encryptedKey, "base64");

  if (iv.length !== IV_BYTES) {
    throw new Error("Invalid API key encryption metadata.");
  }
  if (tag.length !== 16) {
    throw new Error("Invalid API key encryption metadata.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    throw new Error("Failed to decrypt API key.");
  }
}
