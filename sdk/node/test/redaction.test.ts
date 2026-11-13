import test from "node:test";
import assert from "node:assert/strict";
import { applyBodyLimit, redactAndClone, redactHeaders, sanitizeResponseBody } from "../src/middleware.js";

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

test("redacts sensitive body fields recursively in objects and arrays", () => {
  const redacted = redactAndClone(
    {
      password: "p",
      profile: {
        token: "t",
        accessToken: "at",
        refreshToken: "rt",
        secret: "s",
        apiKey: "k",
        safe: "ok",
      },
      list: [{ password: "p2" }, { nested: [{ apiKey: "k2" }] }],
    },
    new WeakSet(),
    0,
  ) as any;

  assert.equal(redacted.password, "[REDACTED]");
  assert.equal(redacted.profile.token, "[REDACTED]");
  assert.equal(redacted.profile.accessToken, "[REDACTED]");
  assert.equal(redacted.profile.refreshToken, "[REDACTED]");
  assert.equal(redacted.profile.secret, "[REDACTED]");
  assert.equal(redacted.profile.apiKey, "[REDACTED]");
  assert.equal(redacted.profile.safe, "ok");
  assert.equal(redacted.list[0].password, "[REDACTED]");
  assert.equal(redacted.list[1].nested[0].apiKey, "[REDACTED]");
});

test("applies max body size and marks truncated payloads clearly", () => {
  const limited = applyBodyLimit({ large: "x".repeat(500) } as any, 80) as any;
  assert.equal(limited.__devreplay_truncated, true);
  assert.equal(limited.message, "Payload exceeded maxBodySize and was truncated");
  assert.equal(typeof limited.originalBytes, "number");
  assert.equal(limited.maxBodySize, 80);
  assert.equal(typeof limited.preview, "string");
});

test("sanitizes JSON response bodies and redacts sensitive fields", () => {
  const body = sanitizeResponseBody(
    { ok: true, token: "secret-token", nested: { password: "pw" } },
    "application/json",
    64 * 1024,
  ) as any;
  assert.equal(body.ok, true);
  assert.equal(body.token, "[REDACTED]");
  assert.equal(body.nested.password, "[REDACTED]");
});
