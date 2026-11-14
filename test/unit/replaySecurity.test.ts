import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import {
  isBlockedIP,
  validateReplayBaseUrl,
  secureFetch,
  resolveAndValidateHost,
} from "../../src/services/replaySecurity.js";

test("blocks private/loopback/metadata IPv4 addresses", () => {
  for (const ip of ["127.0.0.1", "10.0.0.1", "192.168.1.1", "172.16.0.1", "169.254.169.254", "0.0.0.0"]) {
    assert.equal(isBlockedIP(ip), true, ip);
  }
});

test("allows public IPv4 addresses", () => {
  assert.equal(isBlockedIP("8.8.8.8"), false);
  assert.equal(isBlockedIP("1.1.1.1"), false);
});

test("blocks IPv6 loopback/private/link-local", () => {
  for (const ip of ["::1", "fc00::1", "fd12::1", "fe80::1", "ff02::1"]) {
    assert.equal(isBlockedIP(ip), true, ip);
  }
});

test("blocks IPv4-mapped IPv6 (dotted and hex forms)", () => {
  assert.equal(isBlockedIP("::ffff:127.0.0.1"), true);
  assert.equal(isBlockedIP("::ffff:7f00:1"), true);
  assert.equal(isBlockedIP("::ffff:10.0.0.1"), true);
  assert.equal(isBlockedIP("::ffff:8.8.8.8"), false);
});

test("DNS resolution failure throws", async () => {
  await assert.rejects(
    () => resolveAndValidateHost("this-host-should-not-resolve.invalid", false),
    /DNS resolution failed/i,
  );
});

test("allowLoopback permits 127.0.0.1", () => {
  assert.equal(isBlockedIP("127.0.0.1", true), false);
});

test("validateReplayBaseUrl accepts valid http/https origins", () => {
  assert.equal(validateReplayBaseUrl("https://api.example.com"), "https://api.example.com");
  assert.equal(validateReplayBaseUrl("http://localhost:3000/"), "http://localhost:3000");
});

test("validateReplayBaseUrl rejects invalid schemes and userinfo", () => {
  assert.equal(validateReplayBaseUrl("ftp://example.com"), null);
  assert.equal(validateReplayBaseUrl("http://user:pass@example.com"), null);
  assert.equal(validateReplayBaseUrl("not a url"), null);
  assert.equal(validateReplayBaseUrl(""), null);
});

test("secureFetch connects to pinned host and returns response (loopback allowed in test)", async () => {
  const server = http.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true, path: req.url }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as any).port;

  const result = await secureFetch(`http://127.0.0.1:${port}/hello?q=1`, {
    method: "GET",
    allowLoopback: true,
    maxBytes: 1024,
    totalTimeoutMs: 2000,
  });

  assert.equal(result.status, 200);
  assert.equal(JSON.parse(result.body).ok, true);

  server.close();
});

test("secureFetch follows redirects to validated hosts", async () => {
  const server = http.createServer((req, res) => {
    if (req.url === "/start") {
      res.statusCode = 302;
      res.setHeader("location", "/final");
      res.end();
      return;
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true, path: req.url }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as any).port;

  const result = await secureFetch(`http://127.0.0.1:${port}/start`, {
    method: "GET",
    allowLoopback: true,
    maxBytes: 1024,
    totalTimeoutMs: 2000,
  });

  assert.equal(result.status, 200);
  assert.equal(JSON.parse(result.body).path, "/final");

  server.close();
});

test("secureFetch enforces max response size", async () => {
  const server = http.createServer((req, res) => {
    res.setHeader("content-type", "text/plain");
    res.end("x".repeat(1000));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as any).port;

  await assert.rejects(
    () =>
      secureFetch(`http://127.0.0.1:${port}/big`, {
        method: "GET",
        allowLoopback: true,
        maxBytes: 100,
        totalTimeoutMs: 2000,
      }),
    /maximum size/i,
  );

  server.close();
});