// routes/audit.js
import { Router } from "express";
import fs from "fs/promises";
import logger from "../configurations/logger.js";

const router = Router();

// You can also add a dedicated VAULT_AUDIT_LOG env var if you prefer
const AUDIT_LOG_PATH =
  process.env.VAULT_AUDIT_LOG ||
  process.env.VAULT_LOG || // fallback
  "/Users/raymon.epping/Documents/VSC/MacOS_Environment/vault_chronicles/ops/vault/node-1/logs/vault_audit.log";

/**
 * Extract human + mission metadata from a Vault audit entry.
 *
 * - For token/create responses: response.auth.metadata contains clear values.
 * - For transit requests using the child token: auth.metadata contains clear values.
 */
function extractInitiator(json) {
  const meta = json.auth?.metadata || json.response?.auth?.metadata;

  if (!meta) {
    return null;
  }

  const initiator = {
    user_id: meta.user_id || null,
    user_name: meta.user_name || null,
    mission_id: meta.mission_id || null,
  };

  if (!initiator.user_id && !initiator.user_name && !initiator.mission_id) {
    return null;
  }

  return initiator;
}

router.get("/tail", async (req, res, next) => {
  const linesParam = Number.parseInt(req.query.lines, 10);
  const linesToReturn = Number.isNaN(linesParam) ? 10 : Math.max(1, linesParam);

  try {
    const data = await fs.readFile(AUDIT_LOG_PATH, "utf8");
    const allLines = (data || "")
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    const tailLines = allLines.slice(-linesToReturn);

    const now = Date.now();

    const entries = tailLines.map((line, idx) => {
      try {
        const json = JSON.parse(line);

        const initiator = extractInitiator(json);

        // Prefer auth on the entry itself, fall back to response.auth
        const auth = json.auth || json.response?.auth;

        return {
          id: `${now}-${idx}`,
          raw: line,
          parsed: {
            time: json.time || null,
            type: json.type || null,
            path: json.request?.path || null,
            operation: json.request?.operation || null,
            mount_type:
              json.request?.mount_type || json.response?.mount_type || null,

            display_name: auth?.display_name || null,
            role_name:
              auth?.metadata?.role_name ||
              json.auth?.metadata?.role_name ||
              json.response?.auth?.metadata?.role_name ||
              null,
            remote_address: json.request?.remote_address || null,
            token_policies:
              auth?.token_policies || auth?.policies || json.auth?.policies || null,

            // New: who actually initiated this, based on token metadata
            initiator,
          },
        };
      } catch (_e) {
        return {
          id: `${now}-${idx}`,
          raw: line,
          parsed: null,
        };
      }
    });

    res.json({
      path: AUDIT_LOG_PATH,
      totalLines: allLines.length,
      returned: entries.length,
      entries,
    });
  } catch (err) {
    logger.error("Failed to read audit log", {
      path: AUDIT_LOG_PATH,
      error: err.message,
    });
    next(err);
  }
});

export default router;
