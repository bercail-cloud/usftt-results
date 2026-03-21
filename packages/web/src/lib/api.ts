const BASE_URL = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

async function post<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { method: "POST" });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string) => post<T>(path),
};
