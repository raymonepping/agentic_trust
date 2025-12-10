// services/db/couchbaseClient.js
import couchbase from "couchbase";
import logger from "../../configurations/logger.js";
import { getDynamicCouchbaseCreds } from "../vault/dbCreds.js";

const CONNSTR = process.env.CB_CONN_STR || "couchbase://localhost";
const BUCKET_NAME = process.env.CB_BUCKET || "missions";

// Retry/backoff knobs
const CONNECT_RETRY_ATTEMPTS = Number(process.env.CB_CONNECT_RETRY_ATTEMPTS ?? 10 );
const ROTATION_RETRY_ATTEMPTS = Number(process.env.CB_ROTATION_RETRY_ATTEMPTS ?? 5);

const RETRY_INITIAL_MS = Number(process.env.CB_AUTH_RETRY_INITIAL_MS ?? 400);
const RETRY_MAX_MS = Number(process.env.CB_AUTH_RETRY_MAX_MS ?? 2000);
const RETRY_JITTER_MS = Number(process.env.CB_AUTH_RETRY_JITTER_MS ?? 250);

// Rotation lead / minimum spacing
const DB_LEAD_SECONDS = Number(process.env.VAULT_DB_LEAD_SECONDS ?? 60);
const DB_MIN_SECONDS = Number(process.env.VAULT_DB_MIN_SECONDS ?? 30);

let cluster = null;
let bucket = null;
let cachedScope = null;
let cachedCollection = null;
let currentUser = null;
let leaseExpiry = null;
let lastPingOkAt = null;
let rotationTimer = null;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const jittered = ms => {
  const j = Math.floor((Math.random() * 2 - 1) * RETRY_JITTER_MS);
  return Math.max(0, ms + j);
};

function ensureEnv() {
  if (!CONNSTR || !BUCKET_NAME) {
    throw new Error("CB_CONN_STR or CB_BUCKET missing");
  }
}

export function getLeaseExpiry() {
  return leaseExpiry;
}

async function connectWithDynamicCreds() {
  ensureEnv();

  if (cluster) {
    try {
      await cluster.close();
    } catch {
      // ignore
    }
    cluster = null;
    bucket = null;
    cachedScope = null;
    cachedCollection = null;
  }

  const { username, password, leaseTtl } = await getDynamicCouchbaseCreds();

  currentUser = String(username).trim();
  leaseExpiry = leaseTtl ? new Date(Date.now() + leaseTtl * 1000) : null;

  logger.info(
    `Connecting with dynamic user '${currentUser}' (lease ~${leaseTtl || "?"}s)`
  );

  let lastErr;
  let delay = RETRY_INITIAL_MS;

  // Small initial wait to let RBAC settle
  await sleep(jittered(delay));

  for (let attempt = 1; attempt <= CONNECT_RETRY_ATTEMPTS; attempt++) {
    try {
      cluster = await couchbase.connect(CONNSTR, {
        username: currentUser,
        password,
      });

      bucket = cluster.bucket(BUCKET_NAME);

      // Light ping to verify connectivity
      try {
        await cluster.ping();
      } catch {
        // ignore ping errors here
      }

      logger.info(
        `Connected as '${currentUser}' on attempt ${attempt}`
      );

      // Mark last successful contact with Couchbase
      lastPingOkAt = new Date();
      
      return;
    } catch (e) {
      lastErr = e;
      const msg = e?.message || String(e);

      if (/auth/i.test(msg) || /authentication/i.test(msg) || /timeout/i.test(msg)) {
        if (attempt < RETRY_ATTEMPTS) {
          logger.warn(
            `Connect attempt ${attempt}/${CONNECT_RETRY_ATTEMPTS} failed (${msg}). ` +
              `Retrying in ${delay} ms`
          );
          await sleep(jittered(delay));
          delay = Math.min(
            RETRY_MAX_MS,
            Math.floor(delay * 1.6) || RETRY_INITIAL_MS,
          );
          continue;
        }
      }

      throw e;
    }
  }

  throw lastErr || new Error("Failed to connect to Couchbase with dynamic credentials");
}

export async function getCluster() {
  if (!cluster) {
    await connectWithDynamicCreds();
  }
  return cluster;
}

export async function getBucket() {
  if (!bucket) {
    await connectWithDynamicCreds();
  }
  return bucket;
}

export async function getScope() {
  if (cachedScope) {
    return cachedScope;
  }
  const b = await getBucket();
  const scopeName = process.env.CB_SCOPE || "_default";
  cachedScope = b.scope(scopeName);
  return cachedScope;
}

export async function getCollection() {
  if (cachedCollection) {
    return cachedCollection;
  }
  const scope = await getScope();
  const collName = process.env.CB_COLLECTION || "missions";
  cachedCollection = scope.collection(collName);
  return cachedCollection;
}

export async function pingCouchbase() {
  const now = Date.now();
  const graceSeconds = Number(process.env.CB_PING_GRACE_SECONDS ?? 20);

  // 1) If we have no active cluster
  if (!cluster) {
    // But we had a successful ping recently → stay green within grace window
    if (
      lastPingOkAt &&
      (now - lastPingOkAt.getTime()) / 1000 <= graceSeconds
    ) {
      logger.info(
        "Couchbase cluster currently disconnected, but last ping was within grace window; reporting ok for health"
      );
      return true;
    }

    // No cluster and no recent success → report down quickly, no connect attempts
    logger.warn(
      "Couchbase ping requested but cluster is not connected and no recent success; reporting down"
    );
    return false;
  }

  // 2) We have a cluster → do a real ping
  try {
    await cluster.ping();
    lastPingOkAt = new Date();
    logger.debug("Couchbase ping ok");
    return true;
  } catch (err) {
    // If ping fails but we had a recent good ping, stay green within grace window
    if (
      lastPingOkAt &&
      (now - lastPingOkAt.getTime()) / 1000 <= graceSeconds
    ) {
      logger.warn(
        `Couchbase ping failed (${err.message}), but within grace window; reporting ok for health`
      );
      return true;
    }

    logger.warn(`Couchbase ping failed: ${err.message}`);
    return false;
  }
}

export async function closeCouchbase() {
  try {
    if (rotationTimer) {
      clearTimeout(rotationTimer);
      rotationTimer = null;
    }
    if (cluster) {
      await cluster.close();
    }
  } catch {
    // ignore close errors
  } finally {
    cluster = null;
    bucket = null;
    cachedScope = null;
    cachedCollection = null;
    currentUser = null;
    leaseExpiry = null;
  }
}

/**
 * Background loop:
 * - fetch new dynamic creds from Vault
 * - if user changed or not connected, reconnect
 * - schedule next run before TTL expires
 */
export async function startCouchbaseRotation() {
  if (rotationTimer) {
    // already running
    return;
  }

  async function tick() {
  try {
    const { username, password, leaseTtl } = await getDynamicCouchbaseCreds();
    const newUser = String(username).trim();

    const changedUser = newUser !== currentUser;
    if (changedUser || !cluster) {
      logger.info(`Rotating dynamic creds for user '${newUser}', reconnecting`);

      ensureEnv();

      // 1. Build a new cluster without touching the old one
      let newCluster = null;
      let newBucket = null;

      let lastErr;
      let delay = RETRY_INITIAL_MS;

      await sleep(jittered(delay));

      for (let attempt = 1; attempt <= ROTATION_RETRY_ATTEMPTS; attempt++) {
        try {
          newCluster = await couchbase.connect(CONNSTR, {
            username: newUser,
            password,
          });
          newBucket = newCluster.bucket(BUCKET_NAME);
          try {
            await newCluster.ping();
          } catch {
            // ignore ping errors here
          }

          logger.info(
            `Reconnected as '${newUser}' on attempt ${attempt}`
          );
          break;
        } catch (e) {
          lastErr = e;
          const msg = e?.message || String(e);

          if (/auth/i.test(msg) || /authentication/i.test(msg) || /timeout/i.test(msg)) {
            if (attempt < RETRY_ATTEMPTS) {
              logger.warn(
                `Rotation connect attempt ${attempt}/${ROTATION_RETRY_ATTEMPTS} failed (${msg}). ` +
                `Retrying in ${delay} ms`
              );
              await sleep(jittered(delay));
              delay = Math.min(RETRY_MAX_MS, Math.floor(delay * 1.6) || RETRY_INITIAL_MS);
              continue;
            }
          }
          throw e;
        }
      }

      if (!newCluster && lastErr) {
        throw lastErr;
      }

      // 2. Only now swap references and close the old cluster
      const oldCluster = cluster;
      cluster = newCluster;
      bucket = newBucket;
      cachedScope = null;
      cachedCollection = null;
      currentUser = newUser;
      leaseExpiry = leaseTtl ? new Date(Date.now() + leaseTtl * 1000) : null;

      if (oldCluster) {
        try {
          await oldCluster.close();
        } catch {
          // ignore close errors
        }
      }
    } else {
      // user unchanged, just refresh lease expiry
      leaseExpiry = leaseTtl ? new Date(Date.now() + leaseTtl * 1000) : leaseExpiry;
    }

    const ttl = leaseTtl || 300;
    const wait = Math.max(DB_MIN_SECONDS, ttl - DB_LEAD_SECONDS);
    rotationTimer = setTimeout(tick, wait * 1000);
  } catch (err) {
    logger.warn(`Rotation error: ${err.message}`);
    rotationTimer = setTimeout(tick, 10_000);
  }
}


  await tick();
}

export function getCurrentUser() {
  return currentUser;
}

export function getLastPingOkAt() {
  return lastPingOkAt;
}
