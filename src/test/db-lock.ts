import { createHash } from "crypto";
import { linkSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

interface AcquireOptions {
  pollMs?: number;
  onWait?: (holderPid: number) => void;
}

/** One lock per Supabase stack, shared by every checkout and worktree on the machine. */
export function dbLockPath(supabaseUrl: string): string {
  const urlHash = createHash("sha256").update(supabaseUrl).digest("hex").slice(0, 12);
  return path.join(tmpdir(), `okaeri-vitest-db-${urlHash}.lock`);
}

function readHolderPid(lockPath: string): number | undefined {
  try {
    return Number(readFileSync(lockPath, "utf8")) || undefined;
  } catch {
    return undefined;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function tryCreateLock(lockPath: string): boolean {
  // Write the PID to a private file, then hard-link it into place: the link is
  // atomic, so no reader ever sees a lock file without its PID.
  const pendingPath = `${lockPath}.${process.pid}`;
  writeFileSync(pendingPath, String(process.pid));
  try {
    linkSync(pendingPath, lockPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  } finally {
    unlinkSync(pendingPath);
  }
}

/** Waits for a cross-process lock file, and returns the function that releases it. */
export async function acquireDbLock(
  lockPath: string,
  { pollMs = 1000, onWait }: AcquireOptions = {}
): Promise<() => void> {
  let toldToWait = false;

  while (!tryCreateLock(lockPath)) {
    const holderPid = readHolderPid(lockPath);
    if (holderPid && !isAlive(holderPid)) {
      // shortcut: two waiters that see the same dead holder can both remove the lock, and a
      // reused PID looks alive; move to an OS-level flock if either ever shows up.
      rmSync(lockPath, { force: true });
      continue;
    }
    if (holderPid && !toldToWait) {
      onWait?.(holderPid);
      toldToWait = true;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  const release = () => {
    process.off("exit", release);
    if (readHolderPid(lockPath) === process.pid) unlinkSync(lockPath);
  };
  process.on("exit", release);
  return release;
}
