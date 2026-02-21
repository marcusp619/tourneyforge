# TourneyForge API

Hono API running on Bun.

## Development

```bash
cd packages/api
bun run src/index.ts        # Start server
bun --watch src/index.ts    # Hot reload
```

API runs on port 3001 by available.

## Routes

- `GET /` - Health check
- `GET /api/tenants` - List tenants
- `POST /api/tenants` - Create tenant
- `GET /api/tournaments` - List tournaments (requires `x-tenant-id` header)
- `POST /api/tournaments` - Create tournament
- `GET /api/leaderboards/:tournamentId` - Get tournament leaderboard
