import { BansMap } from "@src/endpoints/sync/types";
import { RulesetResult } from "@src/types/cloudflare-api.types";
import { ConfigError, DisallowedDomainError } from "./throws";
import { Env } from "@src/types";

export const parseCommaSeparatedList = (value: string | undefined): string[] => {
  if (!value) return [];
  return value.split(",").map(item => item.trim()).filter(Boolean);
};

export const asEnvKey = (domain: string): string => {
    if (!domain || domain.trim().length === 0) {
      throw new Error("Domain cannot be empty");
    }
    return domain.toUpperCase().replace(/[^A-Z0-9]/g, "_");
};

export const findRuleByName = (
    rules: RulesetResult["rules"],
    ruleName: string
  ): string | null => {
    const rule = rules.find(r => r.description === ruleName);
    return rule ? rule.id : null;
};

export const buildBansExpression = (bans: BansMap): string => {
    const ips = Object.keys(bans);
    return ips.length > 0 
      ? `ip.src in {${ips.join(" ")}}` 
      : "ip.src eq 0.0.0.0"; // Fallback that won't match anything
  }

export function validateDomainAllowed(env: Env, domain: string): void {
  const allowedDomains = parseCommaSeparatedList(env.ALLOWED_DOMAINS);
  if (!allowedDomains.includes(domain)) {
    throw new DisallowedDomainError(domain);
  }
}

interface DomainConfig {
  zoneId: string;
  apiToken: string;
}

export function getDomainConfig(env: Env, domain: string): DomainConfig {
  const safeDomain = asEnvKey(domain);
  const zoneId = env[`ZONE_ID_${safeDomain}`];
  const apiToken = env[`API_TOKEN_${safeDomain}`];

  if (!zoneId) {
    throw new ConfigError("missingZone");
  }

  if (!apiToken) {
    throw new ConfigError("missingApiToken");
  }

  return { zoneId, apiToken };
}