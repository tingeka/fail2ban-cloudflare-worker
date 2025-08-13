# fail2ban-cloudflare-worker

This repository contains a Cloudflare Worker designed to sync IP bans from a fail2ban instance to a Cloudflare firewall rule. It provides a simple API endpoint that fail2ban can call to automatically update a list of blocked IP addresses.

## 🚀 Features

- **Automatic IP Banning**: Syncs IP bans from your fail2ban server directly to Cloudflare.
- **Secure API Endpoint**: The API endpoint is protected with an optional IP allowlist to ensure only authorized fail2ban instances can update the rules.
- **Dynamic Rule Management**: Automatically creates a new Cloudflare firewall rule if one doesn't already exist and updates it with the banned IP addresses.
- **Multiple Domain Support**: Can manage bans for multiple domains, with separate API tokens and Zone IDs for each.
- **Robust Error Handling**: Provides detailed error messages for issues like invalid domains, missing configurations, or API failures.

## 🛠️ Configuration

The worker's behavior is controlled by environment variables. These are defined in your `wrangler.jsonc` file when you deploy the worker.

- `ALLOWED_DOMAINS`: A comma-separated list of domains that the worker is allowed to manage.
- `ALLOWED_IPS`: (Optional) A comma-separated list of IP addresses that are authorized to call the API endpoint. If this is not set, any IP can call the endpoint.
- `RULE_NAME`: The name of the Cloudflare firewall rule to be managed (e.g., `fail2ban`).
- `ZONE_ID_<DOMAIN>`: The Cloudflare Zone ID for a specific domain. The domain should be sanitized by converting it to uppercase and replacing non-alphanumeric characters with underscores (e.g., for `example.com`, the variable would be `ZONE_ID_EXAMPLE_COM`).
- `API_TOKEN_<DOMAIN>`: The Cloudflare API Token for the specified domain. The domain name in the variable should be sanitized in the same way as for `ZONE_ID_<DOMAIN>`.

## 📋 Installation

### Clone the repository

```bash
git clone https://github.com/your-username/fail2ban-cloudflare-worker.git
cd fail2ban-cloudflare-worker
npm install
```

### Configure environment variables

If deploying via `wrangler`, add your configuration details in `wrangler.jsonc`, including your Cloudflare API tokens and Zone IDs for each domain you want to protect. You can use secrets for sensitive data.

If deploying via Cloudflare Git integration, you can set the env variables via the dashboard.

### Deploy

If using wrangler:

```bash
npx wrangler deploy
```

If using Git integration, the deployment is handled via Cloudflare.

## Usage

Once deployed, the Cloudflare Worker will expose a single API endpoint: `/api/sync`. 

You can configure your fail2ban instance to call this endpoint whenever it bans an IP address.

> **How it works**
>
> This integration assumes a specific server-side architecture:
>
> - **Custom fail2ban action** – On the server where fail2ban runs, a custom action maintains the state of banned IPs.
> - **Deduplication logic** – All jails using the custom action log bans to a shared state file. If multiple jails ban the same IP, the highest bantime wins.
> - **State file format** – The state file is a JSON object with:
>   1. A `domain` string.
>   2. A `bans` object mapping `ip` → `bantime` in seconds.
> - **Ban/unban logic** – All add/remove operations happen locally on the server before syncing.
> - **Sync behavior** – The server periodically sends the entire state file to this API. The Cloudflare rule is overwritten with the provided list (partial updates are not supported).


### Request Body

The API expects a JSON body with the following structure:

```json
{
  "domain": "example.com",
  "bans": {
    "1.1.1.1": 3600,
    "2.2.2.2": 1800
  }
}
```

- `domain`: The domain for which the firewall rule should be updated. This domain must be in the ALLOWED_DOMAINS list in your worker's environment variables.

- `bans`: A key-value map where the key is the banned IP address and the value is the ban duration in seconds.

### Example fail2ban Action

To integrate with fail2ban, you would create a custom action that makes an HTTP POST request to your worker's URL. The action script would need to collect the banned IP and duration from fail2ban and send them to the worker.

### Testing

The repository includes a suite of tests to ensure the worker functions correctly, using **Jest** under the hood.

To run all tests:

```bash
npm test
```

The tests validate the API schemas and verify the core functionality of the Cloudflare sync service. Mocked environments and API responses are used to isolate the business logic and ensure reliable testing.