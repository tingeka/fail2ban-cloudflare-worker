import { Env } from "../src/types";

export const mockEnv: Env = {
	ALLOWED_DOMAINS: "example.com, another.com",
	ALLOWED_IPS: "", // Added the required ALLOWED_IPS property
	RULE_NAME: "test-rule",
	ZONE_ID_EXAMPLE_COM: "zoneid-abc",
	API_TOKEN_EXAMPLE_COM: "token-abc",
	ZONE_ID_ANOTHER_COM: "zoneid-xyz",
	API_TOKEN_ANOTHER_COM: "token-xyz",
};
