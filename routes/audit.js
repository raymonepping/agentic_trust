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

router.get("/tail", async (req, res, next) => {
  const linesParam = Number.parseInt(req.query.lines, 10);
  const linesToReturn = Number.isNaN(linesParam) ? 10 : Math.max(1, linesParam);

  try {
    const data = await fs.readFile(AUDIT_LOG_PATH, "utf8");
    const allLines = data
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    const tailLines = allLines.slice(-linesToReturn);

    const entries = tailLines.map((line, idx) => {
      try {
        const json = JSON.parse(line);
        return {
          id: `${Date.now()}-${idx}`,
          raw: line,
          parsed: {
            time: json.time || null,
            type: json.type || null,
            path: json.request?.path || null,
            operation: json.request?.operation || null,
            display_name: json.auth?.display_name || null,
            role_name: json.auth?.metadata?.role_name || null,
            remote_address: json.request?.remote_address || null,
            token_policies: json.auth?.token_policies || null,
          },
        };
      } catch (_e) {
        return {
          id: `${Date.now()}-${idx}`,
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
