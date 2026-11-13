// @vitest-environment node
import { spawnSync } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { acquireDbLock, dbLockPath, runHoldingLock } from "./db-lock";

describe("dbLockPath", () => {
  it("gives every spelling of the local stack's URL the same lock", () => {
    const lockPath = dbLockPath("http://127.0.0.1:54321");

    expect(dbLockPath("http://localhost:54321")).toBe(lockPath);
    expect(dbLockPath("http://127.0.0.1:54321/")).toBe(lockPath);
  });
});

describe("acquireDbLock", () => {
  let dir: string;
  let lockPath: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "db-lock-test-"));
    lockPath = path.join(dir, "db.lock");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("makes a second holder wait, and tells it so, until the first releases", async () => {
    const releaseFirst = await acquireDbLock(lockPath);
    const waitedFor: number[] = [];
    let secondAcquired = false;

    const second = acquireDbLock(lockPath, {
      pollMs: 10,
      onWait: (holderPid) => waitedFor.push(holderPid),
    }).then((release) => {
      secondAcquired = true;
      return release;
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(secondAcquired).toBe(false);
    expect(waitedFor).toEqual([process.pid]);

    releaseFirst();
    const releaseSecond = await second;
    expect(secondAcquired).toBe(true);
    releaseSecond();
  });

  it("takes over a lock left by a process that died without releasing it", async () => {
    const deadPid = spawnSync(process.execPath, ["-e", ""]).pid;
    writeFileSync(lockPath, String(deadPid));
    const waitedFor: number[] = [];

    const release = await acquireDbLock(lockPath, {
      pollMs: 10,
      onWait: (holderPid) => waitedFor.push(holderPid),
    });

    expect(waitedFor).toEqual([]);
    expect(readFileSync(lockPath, "utf8")).toBe(String(process.pid));
    release();
  });
});

describe("runHoldingLock", () => {
  let dir: string;
  let lockPath: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "db-lock-test-"));
    lockPath = path.join(dir, "db.lock");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("holds the lock while the command runs, and releases it after", async () => {
    const exitCode = await runHoldingLock(lockPath, process.execPath, [
      "-e",
      "process.exit(require('fs').existsSync(process.argv[1]) ? 0 : 9)",
      lockPath,
    ]);

    expect(exitCode).toBe(0);
    expect(existsSync(lockPath)).toBe(false);
  });

  it("resolves to the command's exit code", async () => {
    const exitCode = await runHoldingLock(lockPath, process.execPath, ["-e", "process.exit(3)"]);

    expect(exitCode).toBe(3);
  });
});
