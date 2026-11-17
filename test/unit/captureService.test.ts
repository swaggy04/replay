import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "../../src/generated/prisma/client.js";
import { isPermanentCaptureError } from "../../src/services/captureService.js";

function makePrismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("test error", {
    code,
    clientVersion: "7.9.1",
  });
}

test("transient Prisma errors are not permanent", () => {
  for (const code of ["P1001", "P1002", "P1017", "P2024"]) {
    assert.equal(
      isPermanentCaptureError(makePrismaError(code)),
      false,
      `${code} should be transient`,
    );
  }
});

test("permanent Prisma error P2003 is permanent", () => {
  assert.equal(isPermanentCaptureError(makePrismaError("P2003")), true);
});

test("Prisma validation errors are permanent", () => {
  assert.equal(
    isPermanentCaptureError(new Prisma.PrismaClientValidationError("bad", { clientVersion: "7.9.1" } as any)),
    true,
  );
});

test("connection init errors are transient", () => {
  assert.equal(
    isPermanentCaptureError(new Prisma.PrismaClientInitializationError("conn", "7.9.1")),
    false,
  );
});

test("generic network errors are transient", () => {
  assert.equal(isPermanentCaptureError(new Error("fetch failed")), false);
  assert.equal(isPermanentCaptureError(new Error("connect ECONNREFUSED")), false);
  assert.equal(isPermanentCaptureError(new Error("timeout")), false);
});