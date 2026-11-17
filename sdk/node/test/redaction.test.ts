import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPayloadLimit,
  redactAndClone,
  redactHeaders,
  sanitizeQuery,
  sanitizeResponseBody,
} from "../src/middleware.js";

test("redacts sensitive headers", () => {
  const headers = redactHeaders({
    authorization: "Bearer secret",
    cookie: "a=b",
    "set-cookie": "c=d",
    "x-api-key": "key",
    "x-devreplay-api-key": "dr_live_x",
    "content-type": "application/json",
    accept: "application/json",
  } as any);

  assert.equal(headers?.authorization, "[REDACTED]");
  assert.equal(headers?.cookie, "[REDACTED]");
  assert.equal(headers?.["set-cookie"], "[REDACTED]");
  assert.equal(headers?.["x-api-key"], "[REDACTED]");
  assert.equal(headers?.["x-devreplay-api-key"], "[REDACTED]");
  assert.equal(headers?.["content-type"], "application/json");
  assert.equal(headers?.accept, "application/json");
});

test("redacts sensitive body fields recursively including common variants and preserves ordinary fields", () => {
  const redacted = redactAndClone(
    {
      password: "p",
      access_token: "at1",
      refresh_token: "rt1",
      api_key: "k1",
      client_secret: "cs",
      privateKey: "pk",
      session: "sess",
      profile: {
        TOKEN: "t",
        "access-token": "at2",
        refreshToken: "rt2",
        "client-secret": "cs2",
        "private-key": "pk2",
        sessionId: "sid",
        apiKey: "k2",
        secret: "s",
        safe: "ok",
        sessionCount: 3,
        tokenLimit: 10,
      },
      list: [{ password: "p2" }, { nested: [{ api_key: "k3" }] }],
    },
    new WeakSet(),
    0,
  ) as any;

  assert.equal(redacted.password, "[REDACTED]");
  assert.equal(redacted.access_token, "[REDACTED]");
  assert.equal(redacted.refresh_token, "[REDACTED]");
  assert.equal(redacted.api_key, "[REDACTED]");
  assert.equal(redacted.client_secret, "[REDACTED]");
  assert.equal(redacted.privateKey, "[REDACTED]");
  assert.equal(redacted.session, "[REDACTED]");
  assert.equal(redacted.profile.TOKEN, "[REDACTED]");
  assert.equal(redacted.profile["access-token"], "[REDACTED]");
  assert.equal(redacted.profile.refreshToken, "[REDACTED]");
  assert.equal(redacted.profile["client-secret"], "[REDACTED]");
  assert.equal(redacted.profile["private-key"], "[REDACTED]");
  assert.equal(redacted.profile.sessionId, "[REDACTED]");
  assert.equal(redacted.profile.apiKey, "[REDACTED]");
  assert.equal(redacted.profile.secret, "[REDACTED]");
  assert.equal(redacted.profile.safe, "ok");
  assert.equal(redacted.profile.sessionCount, 3);
  assert.equal(redacted.profile.tokenLimit, 10);
  assert.equal(redacted.list[0].password, "[REDACTED]");
  assert.equal(redacted.list[1].nested[0].api_key, "[REDACTED]");
});

test("handles repeated references without marking them circular and preserves true circular markers", () => {
  const shared = { value: "ok", token: "secret" };
  const input: any = { a: shared, b: shared };
  const redacted = redactAndClone(input, new WeakSet(), 0) as any;
  assert.deepEqual(redacted.a, { value: "ok", token: "[REDACTED]" });
  assert.deepEqual(redacted.b, { value: "ok", token: "[REDACTED]" });

  const circular: any = { name: "root" };
  circular.self = circular;
  const redactedCircular = redactAndClone(circular, new WeakSet(), 0) as any;
  assert.equal(redactedCircular.name, "root");
  assert.equal(redactedCircular.self, "[CIRCULAR]");
});

test("applies payload size limits with best-effort truncation markers", () => {
  const limited = applyPayloadLimit({ large: "x".repeat(500) } as any, 80) as any;
  assert.equal(limited.__devreplay_truncated, true);
  assert.match(limited.message, /best-effort/i);
  assert.equal(typeof limited.originalBytes, "number");
  assert.equal(limited.maxBodySize, 80);
  assert.equal(typeof limited.preview, "string");
});

test("applies size limits to query parameters", () => {
  const limited = sanitizeQuery({ q: "x".repeat(500), page: "1" }, 80) as any;
  assert.equal(limited.__devreplay_truncated, true);
  assert.equal(limited.maxBodySize, 80);
});

test("handles serialization failures safely", () => {
  const obj: any = { a: 1n }; // BigInt is stringified by our clone, but simulate unserializable via throwing toJSON
  const bad: any = {
    toJSON() {
      throw new Error("boom");
    },
  };
  // applyPayloadLimit receives already-cloned JsonValue in normal flow; emulate direct unsafe serialization path
  const limited = applyPayloadLimit(bad as any, 1024);
  assert.equal(limited, "[UNSERIALIZABLE_PAYLOAD]");
  // ensure BigInt path is still safe through redaction flow
  const redacted = redactAndClone({ obj }, new WeakSet(), 0) as any;
  assert.equal(redacted.obj.a, "1");
});

test("sanitizes JSON response bodies and redacts sensitive fields", () => {
  const body = sanitizeResponseBody(
    { ok: true, access_token: "secret-token", nested: { password: "pw" } },
    "application/json",
    64 * 1024,
  ) as any;
  assert.equal(body.ok, true);
  assert.equal(body.access_token, "[REDACTED]");
  assert.equal(body.nested.password, "[REDACTED]");
});
