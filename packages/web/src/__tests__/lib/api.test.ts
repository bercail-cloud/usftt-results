import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../../lib/api";

describe("api client", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed JSON on a successful GET", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const data = await api.get<{ ok: boolean }>("/api/health");
    expect(data).toEqual({ ok: true });
  });

  it("uses POST method for api.post", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await api.post("/api/sync/trigger/criterium");

    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
  });

  it("throws ApiError preserving status and body on non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Invalid id: must be an integer", {
        status: 400,
        statusText: "Bad Request",
      })
    );

    let caught: unknown;
    try {
      await api.get("/api/equipes/abc");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    const err = caught as ApiError;
    expect(err.status).toBe(400);
    expect(err.body).toBe("Invalid id: must be an integer");
    expect(err.message).toContain("/api/equipes/abc");
    expect(err.message).toContain("400");
  });
});
