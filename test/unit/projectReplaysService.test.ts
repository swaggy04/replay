import test from "node:test";
import assert from "node:assert/strict";

import prisma from "../../src/lib/prisma.js";
import { getProjectReplays } from "../../src/services/replayService.js";

const createdAt = new Date("2026-11-25T10:00:00Z");

test("getProjectReplays lists replays of the owned project, newest first", async () => {
  const project = prisma.project as any;
  const replayExecution = prisma.replayExecution as any;

  const originalFindFirst = project.findFirst;
  const originalFindMany = replayExecution.findMany;
  const originalCount = replayExecution.count;

  project.findFirst = async () => ({ id: "project-1" });
  replayExecution.findMany = async () => [
    {
      id: "replay-1",
      requestLogId: "request-1",
      statusCode: 201,
      durationMs: 84,
      createdAt,
      requestLog: { id: "request-1", method: "POST", path: "/api/users" },
    },
  ];
  replayExecution.count = async () => 3;

  try {
    const result = await getProjectReplays("project-1", "owner-1", 2, 20);

    assert.ok(result);
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].requestLog.method, "POST");
    assert.equal(result.data[0].requestLog.path, "/api/users");
    assert.equal(result.data[0].statusCode, 201);
    assert.equal(result.data[0].durationMs, 84);
    assert.equal(result.total, 3);
    assert.equal(result.page, 2);
    assert.equal(result.totalPages, 1);
  } finally {
    project.findFirst = originalFindFirst;
    replayExecution.findMany = originalFindMany;
    replayExecution.count = originalCount;
  }
});

test("getProjectReplays returns null when the project is not owned", async () => {
  const project = prisma.project as any;

  const originalFindFirst = project.findFirst;
  project.findFirst = async () => null;

  try {
    const result = await getProjectReplays("project-2", "owner-1", 1, 20);
    assert.equal(result, null);
  } finally {
    project.findFirst = originalFindFirst;
  }
});
