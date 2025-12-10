// configurations/logger.js
import dotenv from "dotenv";
import winston from "winston";

// Ensure env is loaded before we read LOG_LEVEL
dotenv.config({ quiet: true });

const LOG_LEVEL = (process.env.LOG_LEVEL || "info").toLowerCase();
const CONTAINER_NAME = process.env.CONTAINER_NAME || "agentic_trust";

const consoleTransport = new winston.transports.Console({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
      let logMessage = `${timestamp} [${level.toUpperCase()}] [${CONTAINER_NAME}]: ${message}`;
      if (Object.keys(metadata).length > 0) {
        logMessage += ` ${JSON.stringify(metadata)}`;
      }
      return logMessage;
    }),
  ),
});

const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports: [consoleTransport],
  exitOnError: false,
});

// These should now appear when LOG_LEVEL=debug
logger.debug(
  `Current log level is set to: ${LOG_LEVEL}, running in container: ${CONTAINER_NAME}`,
);
logger.debug("Initializing logger with console transport.");

const handleShutdown = async signal => {
  logger.info(`Received ${signal}. Shutting down gracefully...`, {
    containerName: CONTAINER_NAME,
  });
  process.exit(0);
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

export default logger;
