// File: tests/integration/service-cloudflare-sync.integration.test.ts
import { CloudflareSyncService } from "../../src/services/cloudflare-sync.service";
import { CloudflareAPI } from "../../src/clients/cloudflare.client";
import { BansMap } from "../../src/endpoints/sync/types";
import { RulesetResult } from "../../src/types";
import { mockEnv } from "../fixtures/env.mock";
import { mockLogger } from "../fixtures/logger.mock";
import { DisallowedDomainError, ConfigError } from "../../src/lib/throws";

// Only mock the HTTP client, not the business logic
jest.mock("../../src/clients/cloudflare.client");

describe("CloudflareSyncService Integration Tests", () => {
  let service: CloudflareSyncService;
  let mockCloudflareClient: jest.Mocked<CloudflareAPI>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCloudflareClient = new CloudflareAPI(mockLogger) as jest.Mocked<CloudflareAPI>;
    service = new CloudflareSyncService(mockEnv, mockCloudflareClient, mockLogger);
  });

  // Test the complete flow with real utility functions
  describe("End-to-End Sync Flow", () => {
    it("should complete full sync workflow from validation to API calls", async () => {
      // Setup mocks for successful API responses
      mockCloudflareClient.getRulesetByPhase
        .mockResolvedValueOnce(null) // First call: no existing ruleset
        .mockResolvedValueOnce({     // Second call: after creation
          id: "new-ruleset-id",
          rules: [],
        });
      mockCloudflareClient.createRuleset.mockResolvedValue({
        id: "new-ruleset-id",
        rules: [],
      });
      mockCloudflareClient.createRule.mockResolvedValue("new-rule-id");
      mockCloudflareClient.updateRule.mockResolvedValue(undefined);

      const bans: BansMap = { "192.168.1.1": 3600, "10.0.0.1": 7200 };
      
      const result = await service.syncBans("example.com", bans);

      // Verify the complete workflow
      expect(mockCloudflareClient.getRulesetByPhase).toHaveBeenCalledWith(
        "zoneid-abc",
        "token-abc", 
        "http_request_firewall_custom"
      );
      expect(mockCloudflareClient.createRuleset).toHaveBeenCalled();
      expect(mockCloudflareClient.createRule).toHaveBeenCalledWith(
        "zoneid-abc",
        "new-ruleset-id",
        "token-abc",
        expect.objectContaining({
          action: "block",
          description: "test-rule",
          expression: "ip.src eq 0.0.0.0", // Initial rule creation uses fallback
          enabled: true
        })
      );
      expect(mockCloudflareClient.updateRule).toHaveBeenCalledWith(
        "zoneid-abc",
        "new-ruleset-id", 
        "new-rule-id",
        "token-abc",
        expect.objectContaining({
          expression: "ip.src in {192.168.1.1 10.0.0.1}" // Update has the real bans
        })
      );
      expect(result).toBe("Successfully synced 2 IP bans for example.com");
    });

    it("should handle domain validation with real utility functions", async () => {
      // Test actual domain validation logic
      await expect(
        service.syncBans("unauthorized-domain.com", {})
      ).rejects.toThrow(DisallowedDomainError);
    });

    it("should handle missing configuration for allowed domain", async () => {
      // Use a domain that's allowed but has no config
      // First add it to the allowed domains by creating a custom env
      const envWithExtraDomain = {
        ...mockEnv,
        ALLOWED_DOMAINS: "example.com, another.com, missing-config.com"
      };
      const customService = new CloudflareSyncService(
        envWithExtraDomain, 
        mockCloudflareClient, 
        mockLogger
      );

      // Test actual config validation logic - domain is allowed but no ZONE_ID/API_TOKEN
      await expect(
        customService.syncBans("missing-config.com", {})
      ).rejects.toThrow(ConfigError);
    });
  });

  // Test integration between service and multiple API calls
  describe("Multi-Step API Interactions", () => {
    it("should handle existing ruleset with new rule creation", async () => {
      const existingRuleset = {
        id: "existing-ruleset",
        rules: [{ id: "other-rule", description: "some-other-rule" }]
      };

      mockCloudflareClient.getRulesetByPhase.mockResolvedValue(existingRuleset);
      mockCloudflareClient.createRule.mockResolvedValue("new-rule-id");
      mockCloudflareClient.updateRule.mockResolvedValue(undefined);

      await service.syncBans("example.com", { "1.1.1.1": 300 });

      expect(mockCloudflareClient.getRulesetByPhase).toHaveBeenCalledTimes(1);
      expect(mockCloudflareClient.createRuleset).not.toHaveBeenCalled();
      expect(mockCloudflareClient.createRule).toHaveBeenCalledWith(
        "zoneid-abc",
        "existing-ruleset",
        "token-abc",
        expect.objectContaining({
          action: "block",
          description: "test-rule",
          expression: "ip.src eq 0.0.0.0", // Initial creation uses fallback
          enabled: true
        })
      );
      expect(mockCloudflareClient.updateRule).toHaveBeenCalledWith(
        "zoneid-abc",
        "existing-ruleset",
        "new-rule-id",
        "token-abc",
        expect.objectContaining({
          expression: "ip.src in {1.1.1.1}" // Update has the real bans
        })
      );
    });

    it("should update existing rule without creating new ones", async () => {
      const existingRuleset = {
        id: "existing-ruleset",
        rules: [{ id: "existing-rule", description: "test-rule" }]
      };

      mockCloudflareClient.getRulesetByPhase.mockResolvedValue(existingRuleset);
      mockCloudflareClient.updateRule.mockResolvedValue(undefined);

      await service.syncBans("example.com", { "2.2.2.2": 600 });

      expect(mockCloudflareClient.createRuleset).not.toHaveBeenCalled();
      expect(mockCloudflareClient.createRule).not.toHaveBeenCalled();
      expect(mockCloudflareClient.updateRule).toHaveBeenCalledWith(
        "zoneid-abc",
        "existing-ruleset",
        "existing-rule",
        "token-abc",
        expect.objectContaining({
          expression: "ip.src in {2.2.2.2}"
        })
      );
    });
  });

  // Test error handling across the integration
  describe("Error Handling Integration", () => {
    it("should propagate API errors through the service layer", async () => {
      mockCloudflareClient.getRulesetByPhase.mockRejectedValue(
        new Error("Cloudflare API timeout")
      );

      await expect(
        service.syncBans("example.com", { "1.1.1.1": 300 })
      ).rejects.toThrow("Cloudflare API timeout");
    });

    it("should handle invalid ruleset data after creation", async () => {
      mockCloudflareClient.getRulesetByPhase
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: undefined, rules: undefined } as unknown as RulesetResult);
      mockCloudflareClient.createRuleset.mockResolvedValue({
        id: "created-id",
        rules: [],
      });

      await expect(
        service.syncBans("example.com", {})
      ).rejects.toThrow("Failed to retrieve ruleset after creation");
    });
  });

  // Test cross-cutting concerns
  describe("Configuration and Environment Integration", () => {
    it("should use custom rule name from environment", async () => {
      const customEnv = { ...mockEnv, RULE_NAME: "custom-ban-rule" };
      const customService = new CloudflareSyncService(
        customEnv, 
        mockCloudflareClient, 
        mockLogger
      );

      mockCloudflareClient.getRulesetByPhase.mockResolvedValue({
        id: "ruleset-id",
        rules: [],
      });
      mockCloudflareClient.createRule.mockResolvedValue("rule-id");
      mockCloudflareClient.updateRule.mockResolvedValue(undefined);

      await customService.syncBans("example.com", {});

      expect(mockCloudflareClient.createRule).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          description: "custom-ban-rule"
        })
      );
    });

    it("should handle multiple domains with different configurations", async () => {
      mockCloudflareClient.getRulesetByPhase.mockResolvedValue(null);
      mockCloudflareClient.createRuleset.mockResolvedValue({
        id: "new-ruleset",
        rules: [],
      });
      mockCloudflareClient.getRulesetByPhase
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "new-ruleset", rules: [] })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "new-ruleset", rules: [] });
      mockCloudflareClient.createRule.mockResolvedValue("rule-id");
      mockCloudflareClient.updateRule.mockResolvedValue(undefined);

      // Test first domain
      await service.syncBans("example.com", { "1.1.1.1": 300 });
      
      // Test second domain
      await service.syncBans("another.com", { "2.2.2.2": 600 });

      // Verify each domain used its own configuration
      expect(mockCloudflareClient.createRuleset).toHaveBeenCalledWith(
        "zoneid-abc", "token-abc", expect.any(Object)
      );
      expect(mockCloudflareClient.createRuleset).toHaveBeenCalledWith(
        "zoneid-xyz", "token-xyz", expect.any(Object)
      );
    });
  });
});