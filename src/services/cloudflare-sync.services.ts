// src/services/cloudflareSyncService.ts
import { Env, RulesetResponseSchema } from "@src/types";
import { BansMap } from "@src/endpoints/sync/types";
import { ConfigError, DisallowedDomainError } from "@src/lib/throws";
import { ZodSchema } from "zod";
import { parseCommaSeparatedList } from "@src/lib/utils";
import { createLogger } from "@src/lib/logger";

export class CloudflareSyncService {
    constructor(
    private env: Env,
    private log: ReturnType<typeof createLogger>
  ) {}

  private sanitizeKey(domain: string): string {
    if (!domain || domain.trim().length === 0) {
      throw new Error("Domain cannot be empty");
    }
    return domain.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  }

    private async fetchJson<T>(
    input: RequestInfo,
    schema: ZodSchema<T>,
    init?: RequestInit,
    timeoutMs = 5000 // Default timeout of 5 seconds
  ): Promise<T> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(input, {
        ...init,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`HTTP ${res.status}: ${res.statusText} - ${errorBody}`);
      }
      
      const json = await res.json();
      const parsed = schema.safeParse(json);

      if (!parsed.success) {
        // Serialize Zod error issues into the message for better debugging
        const formattedErrors = JSON.stringify(parsed.error.issues, null, 2);
        throw new Error(`API response validation failed: ${formattedErrors}`, {
          cause: parsed.error
        });
      }

      return parsed.data;
    } finally {
      clearTimeout(id);
    }
  }

  /**
   * Fetches the ruleset entrypoint once, returns both ruleset ID and the ID of
   * the rule matching ruleName, or null if not found.
   */
  async getRulesetAndRuleId(
    zoneId: string,
    apiToken: string,
    ruleName: string
  ): Promise<{ rulesetId: string; ruleId: string | null }> {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint`;
    const rulesetResponse = await this.fetchJson(url, RulesetResponseSchema, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    const rulesetId = rulesetResponse.result.id;
    const rule = rulesetResponse.result.rules.find((r) => r.description === ruleName);
    const ruleId = rule ? rule.id : null;

    return { rulesetId, ruleId };
  }

  async createRule(
    zoneId: string,
    rulesetId: string,
    apiToken: string,
    ruleName: string
  ): Promise<string> {
    const body = {
      rules: [
        {
          action: "block",
          description: ruleName,
          expression: "ip.src eq 0.0.0.0", // Dummy expression
          enabled: true,
        },
      ],
    };

    const createResponse = await this.fetchJson(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/${rulesetId}/rules`,
      RulesetResponseSchema,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const rule = createResponse.result.rules.find((r) => r.description === ruleName);
    if (!rule) {
      throw new Error(`Failed to create rule: ${ruleName}`);
    }
    return rule.id;
  }

  async updateRule(
    zoneId: string,
    rulesetId: string,
    ruleId: string,
    apiToken: string,
    ruleName: string,
    bans: BansMap
  ): Promise<void> {
    const ips = Object.keys(bans);
    const expr = ips.length > 0 ? `ip.src in {${ips.join(" ")}}` : "ip.src eq 0.0.0.0";

    const body = {
      action: "block",
      description: ruleName,
      expression: expr,
      enabled: true,
    };

    await this.fetchJson(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/${rulesetId}/rules/${ruleId}`,
      RulesetResponseSchema,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
  }

async syncBans(domain: string, bans: BansMap): Promise<string> {
    // NOTE: The request body is already validated by the OpenAPIRoute in the endpoint,
    // so we can trust that the 'domain' and 'bans' are in the correct format.

    const allowedDomains = parseCommaSeparatedList(this.env.ALLOWED_DOMAINS);
    if (!allowedDomains.includes(domain)) {
      throw new DisallowedDomainError(`${domain} (current domains: ${this.env.ALLOWED_DOMAINS}`);
    }

    const safeDomain = this.sanitizeKey(domain);
    const zoneId = this.env[`ZONE_ID_${safeDomain}`];
    const apiToken = this.env[`API_TOKEN_${safeDomain}`];

    if (!zoneId) {
      throw new ConfigError("missingZone");
    }

    if (!apiToken) {
      throw new ConfigError("missingApiToken");
    }

    this.log.info(
      `[CloudflareSyncService] Syncing ${Object.keys(bans).length} bans for ${domain}`
    );

    const ruleName = this.env.RULE_NAME || "fail2ban";
    this.log.info(`[CloudflareSyncService] Using rule name: ${ruleName}`);

    const { rulesetId, ruleId: existingRuleId } = await this.getRulesetAndRuleId(
      zoneId,
      apiToken,
      ruleName
    );

    let ruleId = existingRuleId;

    if (!ruleId) {
      this.log.info(`[CloudflareSyncService] Creating new rule for ${domain}`);
      ruleId = await this.createRule(zoneId, rulesetId, apiToken, ruleName);
    }

    await this.updateRule(zoneId, rulesetId, ruleId, apiToken, ruleName, bans);

    return `Successfully synced ${Object.keys(bans).length} IP bans for ${domain}`;
  }
}
