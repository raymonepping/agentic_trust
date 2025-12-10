// configurations/morganLogger.js
import morgan from "morgan";
import logger from "./logger.js";

/**
 * HTTP logger that forwards morgan output into Winston.
 *
 * Rules:
 * - When LOG_LEVEL=debug, every request is logged at debug.
 * - 4xx responses are always logged at warn.
 * - 5xx responses are always logged at error.
 */
const httpLogger = morgan((tokens, req, res) => {
  const status = Number(tokens.status(req, res)) || 0;
  const method = tokens.method(req, res);
  const url = tokens.url(req, res);
  const responseTime = tokens["response-time"](req, res);
  const timestamp = tokens.date(req, res, "iso");

  const level =
    status >= 500 ? "error" :
    status >= 400 ? "warn"  :
    "info";

  const message = `${level.toUpperCase()} - ${timestamp} - [${method}] ${status} - ${url} - ${responseTime} ms`;

  if (process.env.LOG_LEVEL === "debug") {
    logger.debug(message);
  }

  if (status >= 500) {
    logger.error(message);
  } else if (status >= 400) {
    logger.warn(message);
  }

  // Tell morgan not to write to stdout
  return null;
});

export default httpLogger;
