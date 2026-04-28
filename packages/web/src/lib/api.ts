const BASE_URL = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly bodySnippet: string
  ) {
    super(`API error ${status} on ${path}${bodySnippet ? `: ${bodySnippet}` : ""}`);
    this.name = "ApiError";
  }
}

async function readBodySnippet(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.length > 200 ? `${text.slice(0, 200)}…` : text;
  } catch {
    return "";
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, init);
  if (!response.ok) {
    const snippet = await readBodySnippet(response);
    throw new ApiError(response.status, path, snippet);
  }
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => fetchJson<T>(path),
  post: <T>(path: string) => fetchJson<T>(path, { method: "POST" }),
};
