import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

// Import routes
import { tenantRouter } from "./routes/tenants";
import { tournamentRouter } from "./routes/tournaments";
import { leaderboardRouter } from "./routes/leaderboards";
import { healthRouter } from "./routes/health";
import { publicRouter } from "./routes/public";
import { themeRouter } from "./routes/theme";

// Create main app
const app = new Hono();

// Global middleware
app.use("*", logger());
app.use("*", cors());

// Mount routes
app.route("/", healthRouter);
app.route("/api/public", publicRouter);
app.route("/api/tenants", tenantRouter);
app.route("/api/tenants", themeRouter); // theme routes share /api/tenants/:id prefix
app.route("/api/tournaments", tournamentRouter);
app.route("/api/leaderboards", leaderboardRouter);

// Start server
const port = process.env.PORT ?? 3001;

export default {
  port,
  fetch: app.fetch,
};

console.log(`API server running on port ${port}`);
