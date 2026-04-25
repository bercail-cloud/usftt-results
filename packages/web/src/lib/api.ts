const BASE_URL = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  readonly status: number;
  readonly body?: string;
  constructor(status: number, message: string, body?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function send<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, init);
  if (!response.ok) {
    const body = await response.text().catch(() => undefined);
    throw new ApiError(
      response.status,
      `API ${init?.method ?? "GET"} ${path} failed: ${response.status} ${response.statusText}`,
      body
    );
  }
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => send<T>(path),
  post: <T>(path: string) => send<T>(path, { method: "POST" }),
};
