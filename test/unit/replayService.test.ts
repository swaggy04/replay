import test from "node:test";
import assert from "node:assert/strict";

import { allowLoopbackForReplayTarget } from "../../src/services/replayService.js";

test("NODE_ENV=development allows loopback replay targets", () => {
  const env = { NODE_ENV: "development" };
  assert.equal(allowLoopbackForReplayTarget("localhost", env), true);
  assert.equal(allowLoopbackForReplayTarget("127.0.0.1", env), true);
  assert.equal(allowLoopbackForReplayTarget("::1", env), true);
  // Non-loopback hostnames stay blocked in dev mode too.
  assert.equal(allowLoopbackForReplayTarget("example.com", env), false);
  assert.equal(allowLoopbackForReplayTarget("10.0.0.1", env), false);
});

test("NODE_ENV=production keeps loopback replay blocked by default", () => {
  const env = { NODE_ENV: "production" };
  assert.equal(allowLoopbackForReplayTarget("localhost", env), false);
  assert.equal(allowLoopbackForReplayTarget("127.0.0.1", env), false);
  assert.equal(allowLoopbackForReplayTarget("::1", env), false);
});

test("NODE_ENV=test keeps loopback replay blocked by default", () => {
  const env = { NODE_ENV: "test" };
  assert.equal(allowLoopbackForReplayTarget("localhost", env), false);
  assert.equal(allowLoopbackForReplayTarget("127.0.0.1", env), false);
});

test("unset NODE_ENV keeps loopback replay blocked by default", () => {
  const env = {};
  assert.equal(allowLoopbackForReplayTarget("localhost", env), false);
  assert.equal(allowLoopbackForReplayTarget("127.0.0.1", env), false);
  assert.equal(allowLoopbackForReplayTarget("::1", env), false);
});

test("REPLAY_ALLOW_LOOPBACK=true is the explicit operator override in any mode", () => {
  const env = { NODE_ENV: "production", REPLAY_ALLOW_LOOPBACK: "true" };
  assert.equal(allowLoopbackForReplayTarget("localhost", env), true);
  assert.equal(allowLoopbackForReplayTarget("127.0.0.1", env), true);
  assert.equal(allowLoopbackForReplayTarget("::1", env), true);
});

test("REPLAY_ALLOW_LOOPBACK=true override works without NODE_ENV set", () => {
  const env = { REPLAY_ALLOW_LOOPBACK: "true" };
  assert.equal(allowLoopbackForReplayTarget("localhost", env), true);
});

test("NODE_ENV with trailing whitespace is treated as development", () => {
  const env = { NODE_ENV: "development " };
  assert.equal(allowLoopbackForReplayTarget("localhost", env), true);
  assert.equal(allowLoopbackForReplayTarget("127.0.0.1", env), true);
  assert.equal(allowLoopbackForReplayTarget("::1", env), true);
  assert.equal(allowLoopbackForReplayTarget("example.com", env), false);
});
