// tests/service.sync.test.ts
import { CloudflareSyncService } from "../src/services/cloudflare-sync.services";
import { RulesetResponseSchema, CloudflareAPISuccessResponseSchema, Env } from "../src/types";
import { ConfigError, DisallowedDomainError } from "../src/lib/throws";
import { mockEnv } from "./env.mock";
import { z, ZodError } from "zod";

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("CloudflareSyncService", () => {
  let service: CloudflareSyncService;

  beforeEach(() => {
    service = new CloudflareSyncService(mockEnv);
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should reject disallowed domain", async () => {
    await expect(service.syncBans("notallowed.com", {})).rejects.toThrow(
      DisallowedDomainError
    );
  });

  it("should reject missing zoneId or apiToken", async () => {
    // Corrected type assertion for the `brokenService` object.
    const brokenService = new CloudflareSyncService({
      ALLOWED_DOMAINS: "example.com",
      ALLOWED_IPS: "1.1.1.1",
      RULE_NAME: "test-rule",
    } as unknown as Env);
    await expect(brokenService.syncBans("example.com", {})).rejects.toThrow(
      ConfigError
    );
  });

  it("should use the environment variable for rule name if available", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        errors: [],
        messages: [],
        result: {
          id: "ruleset123",
          rules: [{ id: "rule123", description: "test-rule" }],
        },
      }),
    });
    const { rulesetId, ruleId } = await service.getRulesetAndRuleId("zoneId", "apiToken", "test-rule");
    expect(rulesetId).toBeDefined();
    expect(ruleId).toBe("rule123");
  });

  it("should correctly sanitize the domain key", () => {
    // Corrected: Use `as unknown as` to cast to a type that exposes the private method.
    const testService = service as unknown as { sanitizeKey(key: string): string };
    expect(testService.sanitizeKey("example.com")).toBe("EXAMPLE_COM");
    expect(testService.sanitizeKey("my-domain.co.uk")).toBe("MY_DOMAIN_CO_UK");
  });

  it("should throw an error on an unsuccessful fetch response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "Forbidden",
      json: async () => ({}),
    });

    // Corrected: Use `as unknown as` to cast to a type that exposes the private method.
    const testService = service as unknown as { fetchJson: (url: string, schema: z.ZodSchema<unknown>) => Promise<unknown> };
    await expect(testService.fetchJson("some-url", RulesetResponseSchema))
        .rejects.toThrow(/HTTP 403: Forbidden/);
  });

  it("should throw a Zod validation error with detailed issues for a complex malformed response", async () => {
    // A generic malformed payload that is guaranteed to fail validation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      statusText: "OK",
      json: async () => ({
        notTheExpectedKey: "some value"
      }),
    });

    try {
      // Corrected: Use `as unknown as` to cast to a type that exposes the private method.
      const testService = service as unknown as { fetchJson: (url: string, schema: z.ZodSchema<unknown>) => Promise<unknown> };
      await testService.fetchJson("some-url", CloudflareAPISuccessResponseSchema(z.any()));
      fail("fetchJson should have thrown an error");
    } catch (error) {
      const err = error as Error;
      expect(err).toBeInstanceOf(Error);
      
      // Check the error message's prefix
      expect(err.message).toContain("API response validation failed: ");

      // Check for the `cause` property and its type to avoid `any`
      expect(error).toHaveProperty("cause");
      const causeError = (error as { cause: unknown }).cause;
      expect(causeError).toBeInstanceOf(ZodError);
    }
  });

  it("should sync bans successfully when rule exists", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: { id: "ruleset123", rules: [{ id: "rule123", description: "test-rule" }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: { id: "ruleset123", rules: [{ id: "rule123", description: "test-rule" }] },
        }),
      });

    const message = await service.syncBans("example.com", { "1.1.1.1": 3600 });
    expect(message).toMatch(/Successfully synced 1 IP bans for example.com/);
  });

  it("should create a new rule and then sync bans successfully when rule does not exist", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: { id: "ruleset123", rules: [] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: { id: "ruleset123", rules: [{ id: "new-rule-id", description: "test-rule" }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: { id: "ruleset123", rules: [{ id: "new-rule-id", description: "test-rule" }] },
        }),
    });

    const message = await service.syncBans("example.com", { "1.1.1.1": 3600, "2.2.2.2": 1800 });
    expect(message).toMatch(/Successfully synced 2 IP bans for example.com/);
  });

  it("should sync successfully with an empty bans map", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: { id: "ruleset123", rules: [{ id: "rule123", description: "test-rule" }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: { id: "ruleset123", rules: [{ id: "rule123", description: "test-rule" }] },
        }),
      });

    const message = await service.syncBans("example.com", {});
    expect(message).toMatch(/Successfully synced 0 IP bans for example.com/);
  });
});