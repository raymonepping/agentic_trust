// Node core utilities
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Third-party libraries
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import swaggerUi from "swagger-ui-express";

// Application routes
import missionsRouter from "./routes/missions.js";
import aiRouter from "./routes/ai.js";
import auditRouter from "./routes/audit.js";

// Logging and HTTP diagnostics
import httpLogger from "./configurations/morganLogger.js";
import logger from "./configurations/logger.js";

// Couchbase + Vault integration
import {
  getLeaseExpiry,
  pingCouchbase,
  closeCouchbase,
  startCouchbaseRotation,
  getLastPingOkAt,
} from "./services/db/couchbaseClient.js";

// Load environment variables from .env file
dotenv.config({ quiet: true });

// Grace window for health checks
const HEALTH_GRACE_TTL_SECONDS = Number(
  process.env.HEALTH_GRACE_TTL_SECONDS ?? 30
);
const HEALTH_GRACE_LASTOK_SECONDS = Number(
  process.env.HEALTH_GRACE_LASTOK_SECONDS ?? 120
);

// Helper to format TTL in human-readable HH:MM:SS
function formatTTL(seconds) {
  if (seconds == null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v, i) => (i === 0 ? v : String(v).padStart(2, "0"))).join(":");
}

// Helper to format Date as ISO string or null
function formatDate(date) {
  if (!date) return null;
  return new Date(date).toLocaleString("nl-NL", {
    hour12: false,
  });
}

// Determine __dirname in ES module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();

// Global middleware: CORS, HTTP logging, JSON body parsing
app.use(cors());
app.use(httpLogger);
app.use(express.json());

// Attach remaining DB credential lease TTL as a response header (if available)
app.use((req, res, next) => {
  const expiry = getLeaseExpiry();
  if (expiry) {
    const ttlSeconds = Math.max(
      0,
      Math.floor((expiry.getTime() - Date.now()) / 1000),
    );
    res.setHeader("X-DB-Creds-Expires-In", formatTTL(ttlSeconds));
  }
  next();
});

// Core API routers
app.use("/missions", missionsRouter);
app.use("/ai", aiRouter);
app.use("/audit", auditRouter);

// Load OpenAPI spec
const openapiPath = path.join(__dirname, "openapi.json");
const openapiSpec = JSON.parse(fs.readFileSync(openapiPath, "utf8"));

// OpenAPI / Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Simple root endpoint for quick sanity checks
app.get("/", (req, res) => {
  res.json({
    name: "agentic_trust_backend",
    status: "ok",
    endpoints: {
      health: "/health",
      missions: "/missions",
      mission_detail: "/missions/:id",
      mission_qna: "/ai/mission/:id",
    },
  });
});

// Health endpoint including Couchbase + lease view
app.get("/health", async (req, res) => {
  const dbOk = await pingCouchbase();
  const expiry = getLeaseExpiry();
  const ttl = expiry
    ? Math.max(0, Math.floor((expiry.getTime() - Date.now()) / 1000))
    : null;

  let ok = dbOk;
  let graceApplied = false;
  let secondsSinceLastOk = null;

  const lastOk = getLastPingOkAt();
  if (lastOk) {
    secondsSinceLastOk = Math.floor((Date.now() - lastOk.getTime()) / 1000);
  }

  // Grace rule:
  // If DB just rotated and TTL is low, and we had a recent successful ping,
  // keep health green for a short window.
  if (
    !dbOk &&
    ttl != null &&
    ttl <= HEALTH_GRACE_TTL_SECONDS &&
    secondsSinceLastOk != null &&
    secondsSinceLastOk <= HEALTH_GRACE_LASTOK_SECONDS
  ) {
    ok = true;
    graceApplied = true;
  }

  const statusCode = ok ? 200 : 503;

  res.status(statusCode).json({
    ok,
    service: "agentic_trust_backend",
    couchbase: {
      ok: dbOk,
      bucket: process.env.CB_BUCKET || "missions",
      leaseExpiresAt: formatDate(expiry),
      leaseSecondsRemaining: ttl,
      leaseHumanReadable: ttl != null ? formatTTL(ttl) : null,
    },
    grace: {
      applied: graceApplied,
      ttlThresholdSeconds: HEALTH_GRACE_TTL_SECONDS,
      lastOkThresholdSeconds: HEALTH_GRACE_LASTOK_SECONDS,
      secondsSinceLastOk,
    },
  });
});

// Lease-only view
app.get("/db/lease", (req, res) => {
  const expiry = getLeaseExpiry();
  const ttl = expiry
    ? Math.max(0, Math.floor((expiry.getTime() - Date.now()) / 1000))
    : null;

  res.json({
    expiresAt: formatDate(expiry),
    secondsRemaining: ttl,
    humanReadable: ttl != null ? formatTTL(ttl) : null,
  });
});

// Compact DB diagnostics
app.get("/db/diagnostics", async (req, res) => {
  const ok = await pingCouchbase();
  const expiry = getLeaseExpiry();
  const ttl = expiry
    ? Math.max(0, Math.floor((expiry.getTime() - Date.now()) / 1000))
    : null;

  res.json({
    ok,
    bucket: process.env.CB_BUCKET || "missions",
    expiresAt: formatDate(expiry),
    secondsRemaining: ttl,
    humanReadable: ttl != null ? formatTTL(ttl) : null,
  });
});

// Basic error handler
app.use((err, req, res, _next) => {
  logger.error("Unhandled application error", {
    path: req.path,
    method: req.method,
    message: err?.message,
    stack: err?.stack,
  });

  res.status(500).json({ error: "Internal server error" });
});

// Start the server
const port = process.env.PORT || 3001;

// Log the current log level on startup
logger.info(`Current LOG_LEVEL from .env is: ${process.env.LOG_LEVEL}`);

// Small helper to show how the backend is wired
function logStartupSummary() {
  const aiProvider = process.env.AI_PROVIDER || "ollama";
  const vaultAddr = process.env.VAULT_ADDR || "not set";
  const vaultTransitKey = process.env.VAULT_TRANSIT_KEY || "missions";
  const vaultDbRole = process.env.VAULT_DB_ROLE || "not configured";

  const cbConnStr = process.env.CB_CONN_STR || "not set";
  const cbBucket = process.env.CB_BUCKET || "missions";

  const dbMode =
    process.env.VAULT_TOKEN && process.env.VAULT_DB_ROLE
      ? "vault dynamic couchbase creds"
      : process.env.CB_USERNAME && process.env.CB_PASSWORD
      ? "static couchbase env creds"
      : "couchbase config incomplete";

  logger.info("Agentic_trust backend started");
  logger.info("");
  logger.debug(`HTTP           : http://localhost:${port}`);
  logger.debug("Health         : GET /health");
  logger.debug("Missions       :");
  logger.debug("  - list       : GET /missions");
  logger.debug("  - create     : POST /missions");
  logger.debug("  - detail     : GET /missions/:id");
  logger.debug("Mission QnA    : POST /ai/mission/:id");
  logger.debug("");
  logger.debug(`AI provider    : ${aiProvider}`);
  logger.debug(`Couchbase      : ${cbConnStr} (bucket ${cbBucket})`);
  logger.debug(`DB auth mode   : ${dbMode}`);
  logger.debug(`Vault addr     : ${vaultAddr}`);
  logger.debug(`Transit key    : ${vaultTransitKey}`);
  logger.debug(`Vault DB role  : ${vaultDbRole}`);
  logger.debug("");
}

// Start Express server
const server = app.listen(port, () => {
  logStartupSummary();

  // Start background rotation of dynamic Couchbase credentials
  startCouchbaseRotation().catch(err => {
    logger.error(`Failed to start Couchbase rotation: ${err.message}`);
  });
});

// Global unhandled rejection handler
process.on("unhandledRejection", err => {
  logger.error(`UnhandledRejection: ${err.message}`, { stack: err.stack });
});

// Graceful shutdown
async function shutdown(signal) {
  logger.debug(`Received ${signal}. Shutting down agentic_trust backend...`);
  server.close(async () => {
    logger.debug("HTTP server closed");
    try {
      await closeCouchbase();
      logger.debug("Couchbase connection closed");
    } catch (err) {
      logger.warn(`Error while closing Couchbase: ${err.message}`);
    }
    process.exit(0);
  });

  setTimeout(() => {
    logger.warn("Forcing shutdown after 10s");
    process.exit(1);
  }, 10_000).unref();
}

// Handle termination signals
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
