import {
  parseCommaSeparatedList,
  asEnvKey,
  findRuleByName,
  buildBansExpression,
  validateDomainAllowed,
  getDomainConfig
} from "../../src/lib/utils";
import { DisallowedDomainError, ConfigError } from "../../src/lib/throws";
import { Env } from "../../src/types";
import { mockEnv } from "../fixtures/env.mock";

describe("Utils Unit Tests", () => {
  describe("parseCommaSeparatedList", () => {
    it("should parse comma-separated values", () => {
      expect(parseCommaSeparatedList("a,b,c")).toEqual(["a", "b", "c"]);
    });

    it("should handle whitespace", () => {
      expect(parseCommaSeparatedList(" a , b , c ")).toEqual(["a", "b", "c"]);
    });

    it("should filter empty values", () => {
      expect(parseCommaSeparatedList("a,,b,")).toEqual(["a", "b"]);
    });

    it("should handle empty string", () => {
      expect(parseCommaSeparatedList("")).toEqual([]);
    });

    it("should handle undefined input", () => {
      expect(parseCommaSeparatedList(undefined)).toEqual([]);
    });
  });

  describe('asEnvKey', () => {
    it('should convert a domain to an uppercase key', () => {
      expect(asEnvKey('example.com')).toBe('EXAMPLE_COM');
    });

    it('should replace special characters with underscores', () => {
      expect(asEnvKey('another-domain.net')).toBe('ANOTHER_DOMAIN_NET');
    });

    it('should throw an error for an empty domain', () => {
      expect(() => asEnvKey('')).toThrow('Domain cannot be empty');
    });
  });

  describe('findRuleByName', () => {
    const mockRules = [
      { id: 'rule-1', description: 'test-rule-1' },
      { id: 'rule-2', description: 'test-rule-2' },
    ];
    
    it('should return the rule ID if a matching rule is found', () => {
      expect(findRuleByName(mockRules, 'test-rule-1')).toBe('rule-1');
    });
    
    it('should return null if no matching rule is found', () => {
      expect(findRuleByName(mockRules, 'non-existent-rule')).toBe(null);
    });
    
    it('should return null for an empty rules array', () => {
      expect(findRuleByName([], 'any-rule')).toBe(null);
    });
  });
  
  describe('buildBansExpression', () => {
    it('should create an expression for a single IP', () => {
      const bans = { '1.1.1.1': 3600 };
      expect(buildBansExpression(bans)).toBe('ip.src in {1.1.1.1}');
    });

    it('should create an expression for multiple IPs', () => {
      const bans = { '1.1.1.1': 3600, '8.8.8.8': 7200 };
      expect(buildBansExpression(bans)).toBe('ip.src in {1.1.1.1 8.8.8.8}');
    });

    it('should return a non-matching fallback expression for an empty bans map', () => {
      const bans = {};
      expect(buildBansExpression(bans)).toBe('ip.src eq 0.0.0.0');
    });
  });
  
  describe('validateDomainAllowed', () => {
    it('should not throw for an allowed domain', () => {
      expect(() => validateDomainAllowed(mockEnv, 'example.com')).not.toThrow();
    });
    
    it('should throw DisallowedDomainError for a disallowed domain', () => {
      expect(() => validateDomainAllowed(mockEnv, 'bad-domain.com')).toThrow(DisallowedDomainError);
    });
  });
  
  describe('getDomainConfig', () => {
    it('should return the correct config for a valid domain', () => {
      const config = getDomainConfig(mockEnv, 'example.com');
      expect(config.zoneId).toBe('zoneid-abc');
      expect(config.apiToken).toBe('token-abc');
    });

    it('should throw a ConfigError if ZONE_ID is missing', () => {
      
      const incompleteEnv = { ...mockEnv, ZONE_ID_ANOTHER_COM: undefined };
      expect(() => getDomainConfig(incompleteEnv as unknown as Env, 'another.com')).toThrow(ConfigError);
    });

    it('should throw a ConfigError if API_TOKEN is missing', () => {
      const incompleteEnv = { ...mockEnv, API_TOKEN_ANOTHER_COM: undefined };
      expect(() => getDomainConfig(incompleteEnv as unknown as Env, 'another.com')).toThrow(ConfigError);
    });
  });
});
