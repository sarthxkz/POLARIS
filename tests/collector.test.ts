import { describe, expect, it } from "vitest";
import { createCollector, statusOf } from "@/server/collector";
import { ProviderError } from "@/server/http";

const id = () => `test-${Math.random()}`;

describe("collector", () => {
  it("makes one upstream request for many concurrent callers", async () => {
    let calls = 0;
    const c = createCollector({
      id: id(),
      ttlMs: 60_000,
      load: async () => {
        calls++;
        return "data";
      },
    });
    await Promise.all([c.get(), c.get(), c.get()]);
    expect(calls).toBe(1);
    await c.get();
    expect(calls).toBe(1);
  });

  it("keeps the last good data through a failure and backs off", async () => {
    let fail = false;
    const c = createCollector({
      id: id(),
      ttlMs: 0,
      load: async () => {
        if (fail) throw new Error("boom");
        return "good";
      },
    });
    expect((await c.get()).data).toBe("good");
    fail = true;
    const s = await c.get();
    expect(s.data).toBe("good");
    expect(s.lastError).toBe("boom");
    expect(s.nextAttempt).toBeGreaterThan(Date.now() + 10_000);
    expect(statusOf(s, null, 60_000)).toBe("stale");
  });

  it("waits as long as the provider's Retry-After asks when that exceeds the backoff", async () => {
    const c = createCollector({
      id: id(),
      ttlMs: 0,
      load: async () => {
        throw new ProviderError("quota", 429, 3600);
      },
    });
    const s = await c.get();
    expect(s.limited).toBe(true);
    expect(s.nextAttempt - Date.now()).toBeGreaterThan(3_590_000);
    expect(statusOf(s, null, 60_000)).toBe("limited");
  });

  it("reports idle before the first request and down when nothing ever loaded", async () => {
    const c = createCollector({
      id: id(),
      ttlMs: 0,
      load: async () => {
        throw new Error("x");
      },
    });
    expect(statusOf(c.peek(), null, 1000)).toBe("idle");
    await c.get();
    expect(statusOf(c.peek(), null, 1000)).toBe("down");
  });
});
