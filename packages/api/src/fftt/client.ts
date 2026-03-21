import { buildAuthParams } from "./auth.js";

const BASE_URL = "https://www.fftt.com/mobile/pxml";

let lastCallTime = 0;

export async function fetchFftt(
  endpoint: string,
  params: Record<string, string>,
  appId: string,
  serie: string,
  password: string
): Promise<string> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < 200) {
    await new Promise((resolve) => setTimeout(resolve, 200 - elapsed));
  }
  lastCallTime = Date.now();

  const authParams = buildAuthParams(appId, serie, password);
  const allParams = { ...authParams, ...params };
  const query = new URLSearchParams(allParams).toString();
  const url = `${BASE_URL}/${endpoint}.php?${query}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FFTT API error: ${response.status} ${response.statusText}`);
  }
  return response.text();
}
