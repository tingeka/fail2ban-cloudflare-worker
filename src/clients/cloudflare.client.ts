import type { z } from "zod";
import { RulesetResponseSchema, RulesetResult } from "@src/types";
import { createLogger } from "@src/lib/logger";

/**
 * Interface for interacting with Cloudflare's Firewall Rules API
 */
export interface CloudflareClient {

  getRulesetByPhase(
    zoneId: string,
    apiToken: string,
    phase: string
  ): Promise<RulesetResult | null>;
  
  createRuleset(
    zoneId: string,
    apiToken: string,
    rulesetData: CreateRulesetRequest
  ): Promise<RulesetResult | null>;

  createRule(
    zoneId: string,
    rulesetId: string,
    apiToken: string,
    ruleData: RuleData
  ): Promise<string>;

  updateRule(
    zoneId: string,
    rulesetId: string,
    ruleId: string,
    apiToken: string,
    ruleData: RuleData
  ): Promise<void>;
}

export interface CreateRulesetRequest {
  name: string;
  kind: string;
  phase: string;
  description: string;
  rules: never[];
}

export interface RuleData {
  action: string;
  description: string;
  expression: string;
  enabled: boolean;
}

export class CloudflareAPI implements CloudflareClient {
  constructor(private log: ReturnType<typeof createLogger>) {}

  private async fetchJson<S extends z.ZodTypeAny>(
    input: RequestInfo,
    schema: S,
    init?: RequestInit,
    timeoutMs = 5000
  ): Promise<z.infer<S>> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(input, { ...init, signal: controller.signal });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`HTTP ${res.status}: ${res.statusText} - ${errorBody}`);
      }

      const json = await res.json();
      const parsed = schema.safeParse(json);

      if (!parsed.success) {
        const formattedErrors = JSON.stringify(parsed.error.issues, null, 2);
        throw new Error(`API response validation failed: ${formattedErrors}`, {
          cause: parsed.error,
        });
      }

      return parsed.data;
    } finally {
      clearTimeout(id);
    }
  }

  async getRulesetByPhase(zoneId: string, apiToken: string, phase: string) {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`;
    try {
      const rulesetResponse = await this.fetchJson(url, RulesetResponseSchema, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      // Explicitly return the result, which is the type the interface expects.
      return rulesetResponse.result;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("10003")) {
        this.log.info(`[CloudflareAPI] Entrypoint ruleset not found for zone ${zoneId}`);
        return null;
      }
      throw err;
    }
  }


  async createRuleset(zoneId: string, apiToken: string, rulesetData: CreateRulesetRequest) {
    this.log.info(`[CloudflareAPI] Creating entrypoint ruleset for zone ${zoneId}`);

    const createResponse = await this.fetchJson(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets`,
      RulesetResponseSchema,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rulesetData),
      }
    );
    const result = createResponse.result;
    return result;
  }

  async createRule(zoneId: string, rulesetId: string, apiToken: string, ruleData: RuleData) {
    this.log.info(`[CloudflareAPI] Creating rule "${ruleData.description}" in ruleset ${rulesetId}`);

    const body = { rules: [ruleData] };

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

    const rule = createResponse.result.rules.find(r => r.description === ruleData.description);
    if (!rule) {
      throw new Error(`Failed to create rule: ${ruleData.description}`);
    }

    this.log.info(`[CloudflareAPI] Created rule "${ruleData.description}" with ID ${rule.id}`);
    return rule.id;
  }

  async updateRule(zoneId: string, rulesetId: string, ruleId: string, apiToken: string, ruleData: RuleData) {
    this.log.info(`[CloudflareAPI] Updating rule "${ruleData.description}" (${ruleId})`);

    await this.fetchJson(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/${rulesetId}/rules/${ruleId}`,
      RulesetResponseSchema,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ruleData),
      }
    );

    this.log.info(`[CloudflareAPI] Successfully updated rule "${ruleData.description}"`);
  }
}
