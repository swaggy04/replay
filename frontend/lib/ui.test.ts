import test from "node:test";
import assert from "node:assert/strict";

import { activeNavForPathname, getMethodClass, getStatusClass } from "./ui";

test("activeNavForPathname defaults to requests", () => {
  assert.equal(activeNavForPathname(null), "requests");
  assert.equal(activeNavForPathname(undefined), "requests");
  assert.equal(activeNavForPathname("/"), "requests");
});

test("activeNavForPathname maps the replays route", () => {
  assert.equal(activeNavForPathname("/replays"), "replays");
  assert.equal(activeNavForPathname("/replays/abc123"), "replays");
  assert.equal(activeNavForPathname("/replaysx"), "requests");
});

test("activeNavForPathname maps the collections route", () => {
  assert.equal(activeNavForPathname("/collections"), "collections");
  assert.equal(activeNavForPathname("/collections/team-a"), "collections");
  assert.equal(activeNavForPathname("/collectionsx"), "requests");
});

test("activeNavForPathname maps the settings route", () => {
  assert.equal(
    activeNavForPathname("/projects/cmw1/settings"),
    "settings",
  );
  assert.equal(activeNavForPathname("/projects/cmw1"), "requests");
});

test("getMethodClass colors methods", () => {
  assert.equal(getMethodClass("GET"), "text-[#e4e4e7]");
  assert.equal(getMethodClass("post"), "text-[#fafafa]");
  assert.equal(getMethodClass("DELETE"), "text-[#a1a1aa]");
  assert.equal(getMethodClass("OPTIONS"), "text-[#a1a1aa]");
  assert.equal(getMethodClass("SOMETHING"), "text-[#e4e4e7]");
});

test("getStatusClass colors statuses", () => {
  assert.equal(getStatusClass(200), "text-emerald-400");
  assert.equal(getStatusClass(204), "text-emerald-400");
  assert.equal(getStatusClass(302), "text-amber-400");
  assert.equal(getStatusClass(404), "text-orange-400");
  assert.equal(getStatusClass(503), "text-red-400");
  assert.equal(getStatusClass(null), "text-[#71717a]");
});
