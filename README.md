# Geo Service

[![CI](https://github.com/SubZtep/geo-service/actions/workflows/ci.yml/badge.svg)](https://github.com/SubZtep/geo-service/actions/workflows/ci.yml)

Lightweight IP geolocation service using MaxMind GeoLite2 database.

## Call as a service

```bash
curl -H "X-API-Key: guest" https://ip2geo.demo.land/lookup/77.100.193.121?summary=true
```

<details>
<summary>Response</summary>

```json
{
  "continent": {
    "geonameId": 6255148,
    "name": "Europe",
    "code": "EU"
  },
  "country": {
    "geonameId": 2635167,
    "name": "United Kingdom",
    "isoCode": "GB",
    "isInEuropeanUnion": false
  },
  "timeZone": "Europe/London"
}
```

</details>

## Connect to MCP server

```json
{
  "mcpServers": {
    "ip2geo": {
      "url": "https://ip2geo.demo.land/mcp",
      "headers": {
        "Authorization": "Bearer guest"
      }
    }
  }
}
```

![Screenshot](https://repository-images.githubusercontent.com/1261703568/a89da771-e555-4d06-9496-69636892a8e4)

## Features

- Fast IP-to-location lookups (city, country, continent, coordinates)
- MCP server (Model Context Protocol) exposing a `my-location` tool for AI agents
- Request queuing with configurable concurrency control
- Simple API key authentication
- Comprehensive integration test suite
- Docker-ready with automatic MaxMind database downloads
- Built with Hono and Bun for performance

## Quick Start

### Development

1. Copy environment file:

```bash
cp .env.example .env
```

2. Set your configuration in `.env`:

```env
API_KEY=your-secret-api-key
GEOIP_ACCOUNT_ID=your-maxmind-account-id
GEOIP_LICENSE_KEY=your-maxmind-license-key
```

3. Install dependencies:

```bash
bun install
```

4. Download MaxMind database manually (first time):

```bash
# Get a free account at https://www.maxmind.com/en/geolite2/signup
# Download GeoLite2-City.mmdb and place it at /usr/share/GeoIP/GeoLite2-City.mmdb
# Or set GEOIP_DB_PATH in .env to your local path
```

5. Start development server:

```bash
bun dev
```

### Docker

Build and run:

```bash
docker build -t geo-service .
docker run -p 3000:3000 \
  -e API_KEY=your-secret-api-key \
  -e GEOIP_ACCOUNT_ID=your-account-id \
  -e GEOIP_LICENSE_KEY=your-license-key \
  geo-service
```

The container will automatically download the MaxMind database on first start.

## API Usage

### Health Check

```bash
curl http://localhost:3000/
```

Response:

```json
{
  "status": "ok",
  "service": "geo-service",
  "version": "1.0.1",
  "uptime": 3600,
  "timestamp": "2026-06-07T12:00:00.000Z",
  "database": {
    "path": "/usr/share/GeoIP/GeoLite2-City.mmdb",
    "lastModified": "2026-06-01T00:00:00.000Z"
  },
  "queue": {
    "pending": 0,
    "size": 0,
    "isPaused": false
  },
  "endpoints": {
    "health": "GET /",
    "lookup": "GET /lookup/:ip?lang=xx&summary=true (requires X-API-Key header; lang defaults to en; summary returns only continent/country/timeZone)"
  }
}
```

### Lookup IP Location

```bash
curl -H "X-API-Key: your-secret-api-key" \
  http://localhost:3000/lookup/8.8.8.8
```

Response:

```json
{
  "continent": {
    "geonameId": 6255149,
    "name": "North America",
    "code": "NA"
  },
  "country": {
    "geonameId": 6252001,
    "name": "United States",
    "isoCode": "US",
    "isInEuropeanUnion": false
  },
  "subdivisions": [
    {
      "geonameId": 5332921,
      "name": "California",
      "isoCode": "CA"
    }
  ],
  "city": {
    "geonameId": 5375480,
    "name": "Mountain View"
  },
  "postalCode": "94043",
  "location": {
    "accuracyRadius": 1000,
    "latitude": 37.386,
    "longitude": -122.0838,
    "timeZone": "America/Los_Angeles"
  }
}
```

`country.isoCode` is the ISO 3166-1 alpha-2 code (e.g. `"US"`) — handy for APIs that key off country codes rather than names. `subdivisions` is ordered most-specific-first (state/province before county); most callers just want `subdivisions[0]`.

#### Localized names

Pass `?lang=xx` to get continent/country/city names in another locale (MaxMind GeoLite2-City ships `en`, `de`, `es`, `fr`, `ja`, `pt-BR`, `ru`, `zh-CN`). Falls back to English, then to any available name, if the requested locale isn't present for a given place.

```bash
curl -H "X-API-Key: your-secret-api-key" \
  http://localhost:3000/lookup/8.8.8.8?lang=de
```

```json
{
  "continent": { "geonameId": 6255149, "name": "Nordamerika", "code": "NA" },
  "country": { "geonameId": 6252001, "name": "Vereinigte Staaten", "isoCode": "US", "isInEuropeanUnion": false },
  "subdivisions": [{ "geonameId": 5332921, "name": "Kalifornien", "isoCode": "CA" }],
  "city": { "geonameId": 5375480, "name": "Mountain View" },
  "postalCode": "94043",
  "location": {
    "accuracyRadius": 1000,
    "latitude": 37.386,
    "longitude": -122.0838,
    "timeZone": "America/Los_Angeles"
  }
}
```

#### Summary mode

Pass `?summary=true` to get a reduced response with just `continent`, `country`, and a top-level `timeZone` — omitting `subdivisions`, `city`, `postalCode`, and precise coordinates. Useful when you only need coarse location data.

```bash
curl -H "X-API-Key: your-secret-api-key" \
  http://localhost:3000/lookup/8.8.8.8?summary=true
```

```json
{
  "continent": { "geonameId": 6255149, "name": "North America", "code": "NA" },
  "country": { "geonameId": 6252001, "name": "United States", "isoCode": "US", "isInEuropeanUnion": false },
  "timeZone": "America/Los_Angeles"
}
```

`summary` composes with `lang`, e.g. `?summary=true&lang=de`.

### MCP Server

The service exposes an MCP (Model Context Protocol) server at `POST /mcp` using the Streamable HTTP transport, so AI agents/clients can connect and call tools directly. Requires an `Authorization: Bearer` header using the same `API_KEY` (or `API_KEY2`) as `/lookup/:ip`.

It exposes one tool:

- **`my-location`** — geolocates the caller, using the same MaxMind lookup as `/lookup/:ip`.
  - `ip` (optional) — look up this IP instead of the detected caller IP.
  - `lang` (optional) — locale for place names, e.g. `hu`, `de`. Defaults to `en`.
  - `summary` (optional) — when `true`, returns only `continent`, `country`, and `timeZone`, omitting city/postal/coordinates. Defaults to `false`.

The caller's IP is detected from the first hop of the `X-Forwarded-For` header, as set by the reverse proxy in front of this service. If no `ip` argument is given and no `X-Forwarded-For` header is present, the tool returns an error.

Example with an MCP-compatible client, or manually via curl:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer your-secret-api-key" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"my-location","arguments":{}}}'
```

To use summary mode, pass `summary: true` in the tool arguments:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer your-secret-api-key" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"my-location","arguments":{"summary":true}}}'
```

Or with the MCP TypeScript SDK client:

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

const transport = new StreamableHTTPClientTransport(new URL(server.url), {
  requestInit: { headers: server.headers }
})

const client = new Client({ name: "my-client", version: "1.0.0" })
await client.connect(transport)

const result = await client.callTool({
  name: "my-location",
  arguments: { summary: true }
})
```

## Environment Variables

| Variable            | Required | Default                               | Description                                |
| ------------------- | -------- | ------------------------------------- | ------------------------------------------ |
| `PORT`              | No       | `3000`                                | Server port                                |
| `API_KEY`           | Yes      | -                                     | API authentication key                     |
| `API_KEY2`          | No       | -                                     | API authentication key                     |
| `QUEUE_CONCURRENCY` | No       | `2`                                   | Max concurrent MaxMind lookups             |
| `GEOIP_DB_PATH`     | No       | `/usr/share/GeoIP/GeoLite2-City.mmdb` | Path to MaxMind database file              |
| `GEOIP_ACCOUNT_ID`  | Yes      | -                                     | MaxMind account ID for database downloads  |
| `GEOIP_LICENSE_KEY` | Yes      | -                                     | MaxMind license key for database downloads |

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Missing X-API-Key header"
}
```

### 403 Forbidden

```json
{
  "error": "Invalid API key"
}
```

### 400 Bad Request

```json
{
  "error": "Invalid IP address format"
}
```

### 404 Not Found

```json
{
  "error": "Location not found for IP"
}
```

## Development

### Running Tests

```bash
bun test
```

### Linting

```bash
bun run lint        # Check for issues
bun run lint:fix    # Auto-fix issues
```

### Building

```bash
bun run build       # Output to dist/
```

## Production Deployment

1. Generate a secure API key:

```bash
uuidgen -7
```

2. Set environment variables in your deployment platform

3. Deploy the Docker container or build the service:

```bash
bun run build
bun run dist/index.js
```

## CI/CD

This project includes GitHub Actions workflows for:

- **CI Pipeline**: Runs linting, tests, and build on PRs and pushes to main
- **Docker Build**: Builds and pushes Docker images to GitHub Container Registry
- **Dependabot**: Automated dependency updates

Status badges are shown at the top of this README.
