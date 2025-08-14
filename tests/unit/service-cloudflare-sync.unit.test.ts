import { CloudflareSyncService } from "../../src/services/cloudflare-sync.services";
import { mockEnv } from "../fixtures/env.mock";
import { mockLogger } from "../fixtures/logger.mock";

describe("CloudflareSyncService Unit Tests", () => {
  let service: CloudflareSyncService;

  beforeEach(() => {
    service = new CloudflareSyncService(mockEnv, mockLogger);
  });

  describe("sanitizeKey", () => {
        
    it("should convert domain to uppercase with underscores", () => {
      const testService = service as unknown as { sanitizeKey(key: string): string };
      expect(testService.sanitizeKey("example.com")).toBe("EXAMPLE_COM");
      expect(testService.sanitizeKey("my-domain.co.uk")).toBe("MY_DOMAIN_CO_UK");
    });

    it("should throw error for empty domain", () => {
      const testService = service as unknown as { sanitizeKey(key: string): string };
      expect(() => testService.sanitizeKey("")).toThrow("Domain cannot be empty");
      expect(() => testService.sanitizeKey("   ")).toThrow("Domain cannot be empty");
    });
    
    it("should handle special characters", () => {
      const testService = service as unknown as { sanitizeKey(key: string): string };
      expect(testService.sanitizeKey("my-app.example-site.com")).toBe("MY_APP_EXAMPLE_SITE_COM");
      expect(testService.sanitizeKey("test.sub-domain.co.uk")).toBe("TEST_SUB_DOMAIN_CO_UK");
    });

    it("should throw error for empty domain", () => {
      const testService = service as unknown as { sanitizeKey(key: string): string };
      expect(() => testService.sanitizeKey("")).toThrow("Domain cannot be empty");
      expect(() => testService.sanitizeKey("   ")).toThrow("Domain cannot be empty");
    });
  });

  // Other pure business logic methods without external dependencies
});