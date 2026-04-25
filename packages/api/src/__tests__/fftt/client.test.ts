import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchFftt } from "../../fftt/client.js";

const APP = "A001";
const SERIE = "ABC123DEF456GHI";
const PASSWORD = "FFTT";

function makeResponse(body: BodyInit, init?: ResponseInit): Response {
  return new Response(body, init);
}

function utf8Buffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer as ArrayBuffer;
}

function latin1Buffer(str: string): ArrayBuffer {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out.buffer;
}

describe("fetchFftt", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Move clock forward enough that internal rate limiter (200ms) doesn't pause tests.
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("includes auth params and forwards endpoint params in the URL", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(makeResponse(utf8Buffer("<root/>")));

    await fetchFftt("xml_test", { foo: "bar" }, APP, SERIE, PASSWORD);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).toContain("https://www.fftt.com/mobile/pxml/xml_test.php?");
    expect(url).toContain("id=A001");
    expect(url).toContain("serie=ABC123DEF456GHI");
    expect(url).toContain("foo=bar");
    expect(url).toMatch(/[?&]tm=\d{17}/);
    expect(url).toMatch(/[?&]tmc=[a-f0-9]{40}/);
  });

  it("throws with status text on non-2xx responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeResponse("oops", { status: 502, statusText: "Bad Gateway" })
    );

    await expect(
      fetchFftt("xml_test", {}, APP, SERIE, PASSWORD)
    ).rejects.toThrow(/502 Bad Gateway/);
  });

  it("throws a timeout error when fetch is aborted", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((_, init) => {
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit | undefined)?.signal;
        signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const promise = fetchFftt("xml_test", {}, APP, SERIE, PASSWORD);
    // Advance past the 30s timeout to trigger the AbortController.
    await vi.advanceTimersByTimeAsync(30_001);
    await expect(promise).rejects.toThrow(/FFTT API timeout/);
  });

  it("returns UTF-8 decoded body when valid UTF-8", async () => {
    const xml = "<root>café</root>";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeResponse(utf8Buffer(xml))
    );

    const result = await fetchFftt("xml_test", {}, APP, SERIE, PASSWORD);
    expect(result).toBe(xml);
  });

  it("falls back to ISO-8859-1 when bytes are not valid UTF-8", async () => {
    // "café" encoded in Latin-1 is invalid UTF-8 and must round-trip via fallback.
    const xml = "<root>café</root>";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeResponse(latin1Buffer(xml))
    );

    const result = await fetchFftt("xml_test", {}, APP, SERIE, PASSWORD);
    expect(result).toBe(xml);
  });
});
