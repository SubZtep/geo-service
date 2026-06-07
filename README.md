# Geo Service

Lightweight IP geolocation service using MaxMind GeoLite2 database.

## Features

- Fast IP-to-location lookups (city, country, continent, coordinates)
- Simple API key authentication
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
docker run -p 3002:3002 \
  -e API_KEY=your-secret-api-key \
  -e GEOIP_ACCOUNT_ID=your-account-id \
  -e GEOIP_LICENSE_KEY=your-license-key \
  geo-service
```

The container will automatically download the MaxMind database on first start.

## API Usage

### Health Check

```bash
curl http://localhost:3002/
```

Response:

```json
{
  "status": "ok",
  "service": "geo-service"
}
```

### Lookup IP Location

```bash
curl -H "X-API-Key: your-secret-api-key" \
  http://localhost:3002/lookup/8.8.8.8
```

Response:

```json
{
  "continent": {
    "geonameId": 6255149,
    "name": "North America"
  },
  "country": {
    "geonameId": 6252001,
    "name": "United States"
  },
  "city": {
    "geonameId": 5375480,
    "name": "Mountain View"
  },
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

## Production Deployment

1. Generate a secure API key:

```bash
openssl rand -base64 32
```

2. Set environment variables in your deployment platform

3. Deploy the Docker container or build the service:

```bash
bun run build
bun run dist/index.js
```

## License

MIT
