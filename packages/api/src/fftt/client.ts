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
  const buffer = await response.arrayBuffer();
  // Try UTF-8 first (some FFTT endpoints return UTF-8 despite declaring ISO-8859-1)
  // If UTF-8 decoding produces replacement characters, fall back to ISO-8859-1
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (!utf8.includes("\uFFFD")) {
    return utf8;
  }
  return new TextDecoder("iso-8859-1").decode(buffer);
}
