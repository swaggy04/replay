import test from "node:test";
import assert from "node:assert/strict";
import { redactHeaders, redactValue, redactJsonString, isSensitiveField } from "../../src/utils/redaction.js";

test("redactHeaders redacts sensitive headers", () => {
  const out = redactHeaders({ Authorization: "Bearer x", Cookie: "y", "X-Api-Key": "z", "Content-Type": "application/json" });
  assert.equal(out!["Authorization"], "[REDACTED]");
  assert.equal(out!["Cookie"], "[REDACTED]");
  assert.equal(out!["X-Api-Key"], "[REDACTED]");
  assert.equal(out!["Content-Type"], "application/json");
});

test("redactValue redacts nested sensitive fields", () => {
  const input = { user: { password: "secret", name: "alice" }, token: "t" };
  const out = redactValue(input) as any;
  assert.equal(out.user.password, "[REDACTED]");
  assert.equal(out.user.name, "alice");
  assert.equal(out.token, "[REDACTED]");
});

test("redactValue handles arrays of sensitive objects", () => {
  const input = [{ apiKey: "k1" }, { apiKey: "k2" }];
  const out = redactValue(input) as any[];
  assert.equal(out[0].apiKey, "[REDACTED]");
  assert.equal(out[1].apiKey, "[REDACTED]");
});

test("redactValue handles case variations and snake_case", () => {
  const input = { AccessToken: "a", refresh_token: "r", client_secret: "c", SessionToken: "s" };
  const out = redactValue(input) as any;
  assert.equal(out.AccessToken, "[REDACTED]");
  assert.equal(out.refresh_token, "[REDACTED]");
  assert.equal(out.client_secret, "[REDACTED]");
  assert.equal(out.SessionToken, "[REDACTED]");
});

test("redactJsonString redacts valid JSON", () => {
  const out = redactJsonString('{"password":"secret","ok":true}');
  assert.equal(JSON.parse(out).password, "[REDACTED]");
  assert.equal(JSON.parse(out).ok, true);
});

test("redactJsonString leaves malformed JSON unchanged", () => {
  const text = "{not json";
  assert.equal(redactJsonString(text), text);
});

test("redactJsonString leaves non-JSON text unchanged", () => {
  const text = "hello world";
  assert.equal(redactJsonString(text), text);
});

test("isSensitiveField recognizes variants", () => {
  assert.equal(isSensitiveField("access_token"), true);
  assert.equal(isSensitiveField("normalField"), false);
});