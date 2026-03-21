import { describe, it, expect } from "vitest";
import { generateTimestamp, generateTmc, buildAuthParams } from "../../fftt/auth.js";

describe("FFTT Auth", () => {
  it("generates timestamp in YYYYMMDDHHMMSSmmm format", () => {
    const ts = generateTimestamp();
    expect(ts).toMatch(/^\d{17}$/);
  });

  it("generates correct tmc using FFTT spec example", () => {
    // From FFTT API spec: timestamp=20150611140022081, password=FFTT
    // Expected tmc=517b27013dd619db47f2bf4c50ae504acbb33980
    const tmc = generateTmc("20150611140022081", "FFTT");
    expect(tmc).toBe("517b27013dd619db47f2bf4c50ae504acbb33980");
  });

  it("generates auth params with all required fields", () => {
    const params = buildAuthParams("A001", "ABC123DEF456GHI", "FFTT");
    expect(params).toHaveProperty("id", "A001");
    expect(params).toHaveProperty("serie", "ABC123DEF456GHI");
    expect(params).toHaveProperty("tm");
    expect(params).toHaveProperty("tmc");
    expect(params.tm).toMatch(/^\d{17}$/);
    expect(params.tmc).toHaveLength(40); // SHA1 hex = 40 chars
  });
});
