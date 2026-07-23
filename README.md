# Geo Service

[![CI](https://github.com/SubZtep/geo-service/actions/workflows/ci.yml/badge.svg)](https://github.com/SubZtep/geo-service/actions/workflows/ci.yml)

Lightweight IP geolocation service using MaxMind GeoLite2 database.

## Features

- Fast IP-to-location lookups (city, country, continent, coordinates)
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
    "lookup": "GET /lookup/:ip?lang=xx (requires X-API-Key header; lang defaults to en)"
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
