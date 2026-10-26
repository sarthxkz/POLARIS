import "server-only";

const USER_AGENT = `POLARIS/0.1 (${process.env.PROVIDER_CONTACT ?? "public earth-observation website"})`;

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    /** Seconds the provider asked us to wait, when it said so. */
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "ProviderError";
  }

  get isQuota() {
    return this.status === 429;
  }
}

interface FetchOptions {
  timeoutMs?: number;
  /** Extra attempts after the first, for network errors and 5xx only. */
  retries?: number;
  headers?: Record<string, string>;
  /** Read a numeric header such as a remaining-quota counter. */
  onHeaders?: (headers: Headers) => void;
}

function parseRetryAfter(headers: Headers): number | null {
  const raw =
    headers.get("x-rate-limit-retry-after-seconds") ?? headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, (date - Date.now()) / 1000) : null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GET a provider URL with a timeout, a bounded number of retries with exponential backoff
 * and jitter, and Retry-After respected. Quota (429) and client errors are never retried here;
 * the collector decides when to come back.
 */
export async function fetchProvider(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 20_000, retries = 2, headers = {}, onHeaders } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...headers },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      onHeaders?.(response.headers);

      if (response.ok) return response;

      const retryAfter = parseRetryAfter(response.headers);
      const error = new ProviderError(
        `HTTP ${response.status} from ${new URL(url).host}`,
        response.status,
        retryAfter,
      );
      if (response.status < 500) throw error;
      lastError = error;
      if (retryAfter !== null && retryAfter > 30) throw error;
      await sleep(retryAfter !== null ? retryAfter * 1000 : backoffMs(attempt));
    } catch (error) {
      if (error instanceof ProviderError && (error.status ?? 500) < 500) throw error;
      lastError = error;
      if (attempt < retries) await sleep(backoffMs(attempt));
    }
  }

  if (lastError instanceof ProviderError) throw lastError;
  const reason =
    lastError instanceof Error && lastError.name === "TimeoutError"
      ? "timed out"
      : "could not be reached";
  throw new ProviderError(`${new URL(url).host} ${reason}`, null);
}

export async function fetchJson<T = unknown>(url: string, options?: FetchOptions): Promise<T> {
  const response = await fetchProvider(url, options);
  try {
    return (await response.json()) as T;
  } catch (error) {
    // The timeout also covers reading the body, so a slow large download ends here mid-stream.
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new ProviderError(`${new URL(url).host} timed out while sending data`, null);
    }
    throw new ProviderError(`Malformed JSON from ${new URL(url).host}`, response.status);
  }
}

function backoffMs(attempt: number) {
  return 500 * 2 ** attempt + Math.random() * 250;
}
