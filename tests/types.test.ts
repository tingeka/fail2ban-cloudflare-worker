// tests/types.test.ts
import { CloudflareSyncSchema } from "../src/endpoints/sync/types";

describe("CloudflareSyncSchema schema validation", () => {
  it("should pass with valid data", () => {
    const valid = { domain: "example.com", bans: { "1.1.1.1": 3600 } };
    expect(() => CloudflareSyncSchema.parse(valid)).not.toThrow();
  });

  it("should pass with empty bans", () => {
    const valid = { domain: "example.com", bans: {} };
    expect(() => CloudflareSyncSchema.parse(valid)).not.toThrow();
  });

  it("should fail with bans omitted", () => {
    const valid = { domain: "example.com" };
    expect(() => CloudflareSyncSchema.parse(valid)).toThrow();
  });

  it("should fail with empty domain", () => {
    const invalid = { domain: "", bans: { "1.1.1.1": 3600 } };
    expect(() => CloudflareSyncSchema.parse(invalid)).toThrow();
  });

  it("should fail if bans is not a number map", () => {
    const invalid = { domain: "example.com", bans: { "1.1.1.1": "3600" } };
    expect(() => CloudflareSyncSchema.parse(invalid)).toThrow();
  });
});
