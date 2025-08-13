// In a new file, e.g., errors.ts
export class DisallowedIpError extends Error {
  constructor(ip: string) {
    super(`IP ${ip} not allowed`);
    this.name = 'DisallowedIpError';
  }
}

export class DisallowedDomainError extends Error {
  constructor(domain: string) {
    super(`Domain ${domain} not allowed`);
    this.name = 'DisallowedDomainError';
  }
}

export class ConfigError extends Error {
	private static readonly errorMap = {
		missingZone: 'Zone ID missing',
		missingApiToken: 'API token missing',
	} as const;

	constructor(errorType: keyof typeof ConfigError.errorMap) {
		super(ConfigError.errorMap[errorType]);
		this.name = `ConfigError[${errorType}]`;
	}
}
