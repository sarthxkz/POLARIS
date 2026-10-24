import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * A small JSON file cache that survives restarts, for providers that ask not to be re-polled
 * (CelesTrak refuses to resend unchanged element sets within its update window). Writes are
 * atomic (temp file + rename). Errors are swallowed: the cache only ever saves requests.
 */
const DIR = process.env.CACHE_DIR ?? join(process.cwd(), ".cache");

export interface Cached<T> {
  savedAt: number;
  value: T;
}

const safe = (key: string) => key.replace(/[^a-z0-9._-]/gi, "_");

export async function readCache<T>(key: string): Promise<Cached<T> | null> {
  try {
    return JSON.parse(await readFile(join(DIR, `${safe(key)}.json`), "utf8")) as Cached<T>;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await mkdir(DIR, { recursive: true });
    const file = join(DIR, `${safe(key)}.json`);
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify({ savedAt: Date.now(), value } satisfies Cached<T>));
    await rename(tmp, file);
  } catch {
    /* a failed cache write only costs a future request */
  }
}
