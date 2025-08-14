import { CloudflareSyncService } from "../../src/services/cloudflare-sync.services";
import { RulesetResponseSchema, CloudflareAPISuccessResponseSchema, Env } from "../../src/types";
import { ConfigError, DisallowedDomainError } from "../../src/lib/throws";
import { mockEnv } from "../fixtures/env.mock";
import { z, ZodError } from "zod";
import { mockLogger } from "../fixtures/logger.mock";

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("CloudflareSyncService Integration Tests", () => {
  let service: CloudflareSyncService;

  beforeEach(() => {
    service = new CloudflareSyncService(mockEnv, mockLogger);
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("Domain Authorization", () => {
    it("should reject disallowed domain", async () => {
      await expect(service.syncBans("notallowed.com", {})).rejects.toThrow(
        DisallowedDomainError
      );
    });
  });

  describe("Configuration Validation", () => {
    it("should reject missing zoneId or apiToken", async () => {
      const brokenService = new CloudflareSyncService({
        ALLOWED_DOMAINS: "example.com",
        ALLOWED_IPS: "1.1.1.1",
        RULE_NAME: "test-rule",
      } as unknown as Env, mockLogger);
      
      await expect(brokenService.syncBans("example.com", {})).rejects.toThrow(
        ConfigError
      );
    });
  });

  describe("Cloudflare API Integration", () => {
    it("should successfully retrieve ruleset and rule ID", async () => {
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
      expect(rulesetId).toBe("ruleset123");
      expect(ruleId).toBe("rule123");
    });

    it("should handle HTTP errors from Cloudflare API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: async () => "Forbidden",
        json: async () => ({}),
      });

      const testService = service as unknown as { fetchJson: (url: string, schema: z.ZodSchema<unknown>) => Promise<unknown> };
      await expect(testService.fetchJson("some-url", RulesetResponseSchema))
          .rejects.toThrow(/HTTP 403: Forbidden/);
    });

    it("should handle malformed API responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        statusText: "OK",
        json: async () => ({ notTheExpectedKey: "some value" }),
      });

      try {
        const testService = service as unknown as { fetchJson: (url: string, schema: z.ZodSchema<unknown>) => Promise<unknown> };
        await testService.fetchJson("some-url", CloudflareAPISuccessResponseSchema(z.any()));
        fail("fetchJson should have thrown an error");
      } catch (error) {
        const err = error as Error;
        expect(err.message).toContain("API response validation failed");
        expect(error).toHaveProperty("cause");
        const causeError = (error as { cause: unknown }).cause;
        expect(causeError).toBeInstanceOf(ZodError);
      }
    });
  });

  describe("Full Sync Flow Integration", () => {
    it("should sync bans when rule exists", async () => {
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

    it("should create rule and sync when rule doesn't exist", async () => {
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
  });
});