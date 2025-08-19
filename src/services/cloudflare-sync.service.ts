import { Env, RulesetResult } from "@src/types";
import { BansMap } from "@src/endpoints/sync/types";
import { buildBansExpression, findRuleByName, getDomainConfig, validateDomainAllowed } from "@src/lib/utils";
import { createLogger } from "@src/lib/logger";
import { CloudflareClient, CreateRulesetRequest, RuleData } from "@src/clients/cloudflare.client";

export class CloudflareSyncService {
  constructor(
    private env: Env,
    private cloudflareClient: CloudflareClient,
    private log: ReturnType<typeof createLogger>
  ) {}

  private async ensureRuleset(zoneId: string, apiToken: string): Promise<RulesetResult> {
    const existingRuleset = await this.cloudflareClient.getRulesetByPhase(
      zoneId, apiToken, "http_request_firewall_custom"
    );

    if (existingRuleset) {
      this.log.info(`[CloudflareSyncService] Using existing entrypoint ruleset ${existingRuleset.id}`);
      return existingRuleset;
    }

    this.log.info(`[CloudflareSyncService] No entrypoint ruleset found, creating new one`);

    const rulesetData: CreateRulesetRequest = {
      name: "default",
      kind: "zone",
      phase: "http_request_firewall_custom",
      description: "",
      rules: [],
    };

    await this.cloudflareClient.createRuleset(zoneId, apiToken, rulesetData);

    const latestRuleset = await this.cloudflareClient.getRulesetByPhase(
      zoneId, apiToken, "http_request_firewall_custom"
    );

    if (!latestRuleset?.id || !latestRuleset.rules) {
      throw new Error("[CloudflareSyncService] Failed to retrieve ruleset after creation");
    }

    return latestRuleset;
  }

  private async findOrCreateRule(
    zoneId: string,
    apiToken: string,
    ruleset: RulesetResult, // ⬅ accept whole object, not just ID
    ruleName: string
  ): Promise<string> {
    const existingRuleId = findRuleByName(ruleset.rules, ruleName);
    if (existingRuleId) {
      this.log.info(`[CloudflareSyncService] Using existing rule ${existingRuleId}`);
      return existingRuleId;
    }

    this.log.info(`[CloudflareSyncService] Rule "${ruleName}" not found, creating...`);

    const ruleData: RuleData = {
      action: "block",
      description: ruleName,
      expression: "ip.src eq 0.0.0.0",
      enabled: true,
    };

    return await this.cloudflareClient.createRule(zoneId, ruleset.id, apiToken, ruleData);
  }

  async syncBans(domain: string, bans: BansMap): Promise<string> {
    validateDomainAllowed(this.env, domain);
    const { zoneId, apiToken } = getDomainConfig(this.env, domain);
    this.log.info(`[CloudflareSyncService] Syncing ${Object.keys(bans).length} bans for ${domain}`);

    const ruleName = this.env.RULE_NAME || "fail2ban";
    this.log.info(`[CloudflareSyncService] Using rule name: ${ruleName}`);

    const ruleset = await this.ensureRuleset(zoneId, apiToken);
    const ruleId = await this.findOrCreateRule(zoneId, apiToken, ruleset, ruleName);

    const ruleData: RuleData = {
      action: "block",
      description: ruleName,
      expression: buildBansExpression(bans),
      enabled: true,
    };

    await this.cloudflareClient.updateRule(zoneId, ruleset.id, ruleId, apiToken, ruleData);

    return `Successfully synced ${Object.keys(bans).length} IP bans for ${domain}`;
  }
}
