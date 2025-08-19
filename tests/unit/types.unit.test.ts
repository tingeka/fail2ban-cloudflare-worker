import { z } from "zod";

// Schemas to be tested
import {
  CloudflareSyncSchema,
} from "../../src/endpoints/sync/types";
import {
  ApiSuccessResponseSchema,
  ApiErrorResponseSchema,
} from "../../src/types/api.types";
import {
  CloudflareMessageSchema,
  CloudflareAPISuccessResponseSchema,
  CloudflareAPIErrorResponseSchema,
  RuleSchema,
  RulesetResultSchema,
  RulesetResponseSchema,
} from "../../src/types/cloudflare-api.types";
import { IpAddressSchema, BanDurationSchema } from "../../src/types";


describe("Zod Schemas Unit Tests", () => {
  // We'll organize tests into logical blocks for clarity.
  // The goal is to test the contract of each schema, not Zod's internal behavior.

  describe("CloudflareSyncSchema", () => {
    it("should pass with a valid payload", () => {
      const validPayload = {
        domain: "example.com",
        bans: {
          "1.1.1.1": 3600,
          "8.8.8.8": 7200,
        },
      };
      expect(() => CloudflareSyncSchema.parse(validPayload)).not.toThrow();
    });

    it("should pass with a valid domain and an empty bans map", () => {
      const validPayload = { domain: "example.com", bans: {} };
      expect(() => CloudflareSyncSchema.parse(validPayload)).not.toThrow();
    });

    it.each([
      // Missing field cases
      { domain: "example.com" }, // missing bans
      // Invalid domain cases
      { domain: "", bans: { "1.1.1.1": 3600 } },
      // Invalid bans key/value cases
      { domain: "example.com", bans: { "not-an-ip": 3600 } },
      { domain: "example.com", bans: { "1.1.1.1": "3600" } },
    ])("should fail with invalid data: %j", (invalidPayload) => {
      expect(() => CloudflareSyncSchema.parse(invalidPayload)).toThrow(z.ZodError);
    });
  });

  describe("API Response Schemas", () => {
    it("ApiSuccessResponseSchema should pass with valid data and fail with invalid data", () => {
      const valid = { success: true, message: "OK" };
      const invalid = { success: false, message: "Error" };
      expect(() => ApiSuccessResponseSchema.parse(valid)).not.toThrow();
      expect(() => ApiSuccessResponseSchema.parse(invalid)).toThrow(z.ZodError);
    });

    it("ApiErrorResponseSchema should pass with valid data and fail with invalid data", () => {
      const valid = { success: false, message: "Error" };
      const invalid = { success: true, message: "OK" };
      expect(() => ApiErrorResponseSchema.parse(valid)).not.toThrow();
      expect(() => ApiErrorResponseSchema.parse(invalid)).toThrow(z.ZodError);
    });
  });

  describe("Cloudflare API Schemas", () => {
    it("CloudflareAPISuccessResponseSchema should pass with valid data", () => {
      const valid = {
        success: true,
        errors: [],
        messages: [],
      };
      expect(() => CloudflareAPISuccessResponseSchema.parse(valid)).not.toThrow();
    });

    it("CloudflareAPIErrorResponseSchema should pass with valid data", () => {
      const valid = {
        success: false,
        errors: [{ message: "Some error" }],
        messages: [],
      };
      expect(() => CloudflareAPIErrorResponseSchema.parse(valid)).not.toThrow();
    });

    it("CloudflareMessageSchema should pass for minimal and full data", () => {
      const minimal = { message: "Test message" };
      const full = {
        message: "Test message",
        code: 1000,
        source: { pointer: "/rules" },
      };
      expect(() => CloudflareMessageSchema.parse(minimal)).not.toThrow();
      expect(() => CloudflareMessageSchema.parse(full)).not.toThrow();
    });
  });

  describe("Ruleset Schemas", () => {
    it("RuleSchema should pass with valid data, including passthrough fields", () => {
      const valid = { id: "rule-id-1", description: "Test rule" };
      const passthrough = { ...valid, action: "block", otherField: 123 };
      expect(() => RuleSchema.parse(valid)).not.toThrow();
      expect(() => RuleSchema.parse(passthrough)).not.toThrow();
    });

    it("RulesetResultSchema should pass with a valid ID and array of rules", () => {
      const valid = {
        id: "ruleset-id",
        rules: [{ id: "rule-1", description: "d" }],
      };
      expect(() => RulesetResultSchema.parse(valid)).not.toThrow();
    });
    
    it("RulesetResponseSchema should pass with valid data", () => {
      const valid = {
        success: true,
        errors: [],
        messages: [],
        result: {
          id: "ruleset-id",
          rules: [{ id: "rule-1", description: "d" }],
        },
      };
      expect(() => RulesetResponseSchema.parse(valid)).not.toThrow();
    });
  });

  describe("Primitive Schemas", () => {
    it("IpAddressSchema should pass with valid IPv4 and IPv6 addresses", () => {
      expect(() => IpAddressSchema.parse("192.168.1.1")).not.toThrow();
      expect(() => IpAddressSchema.parse("2001:db8::1")).not.toThrow();
    });

    it("BanDurationSchema should pass with a valid positive integer", () => {
      expect(() => BanDurationSchema.parse(3600)).not.toThrow();
    });
  });
});
