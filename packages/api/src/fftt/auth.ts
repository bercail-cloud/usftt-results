import { createHash, createHmac } from "node:crypto";

export function generateTimestamp(): string {
  const now = new Date();
  const pad = (n: number, len: number) => String(n).padStart(len, "0");
  return (
    pad(now.getFullYear(), 4) +
    pad(now.getMonth() + 1, 2) +
    pad(now.getDate(), 2) +
    pad(now.getHours(), 2) +
    pad(now.getMinutes(), 2) +
    pad(now.getSeconds(), 2) +
    pad(now.getMilliseconds(), 3)
  );
}

export function generateTmc(timestamp: string, password: string): string {
  const key = createHash("md5").update(password).digest("hex");
  return createHmac("sha1", key).update(timestamp).digest("hex");
}

export function buildAuthParams(appId: string, serie: string, password: string) {
  const tm = generateTimestamp();
  const tmc = generateTmc(tm, password);
  return { id: appId, serie, tm, tmc };
}
