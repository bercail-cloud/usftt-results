import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, ApiError } from "../../lib/api";

const originalFetch = globalThis.fetch;

describe("api", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns parsed JSON on success", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ hello: "world" }), { status: 200 })
    );

    const result = await api.get<{ hello: string }>("/api/things");
    expect(result).toEqual({ hello: "world" });
  });

  it("throws ApiError including status, path, and body snippet on failure", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid id" }), { status: 400 })
    );

    await expect(api.get("/api/equipes/abc")).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      path: "/api/equipes/abc",
    });
  });

  it("truncates long error bodies to 200 chars + ellipsis", async () => {
    const longBody = "x".repeat(500);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(longBody, { status: 500 })
    );

    try {
      await api.get("/api/oops");
      throw new Error("expected ApiError to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const err = e as ApiError;
      expect(err.bodySnippet.length).toBeLessThanOrEqual(201);
      expect(err.bodySnippet.endsWith("…")).toBe(true);
    }
  });

  it("issues POST requests with method=POST", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    await api.post("/api/sync/trigger/criterium");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/sync/trigger/criterium"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
