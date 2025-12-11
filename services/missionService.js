// services/missionService.js
import { v4 as uuidv4 } from "uuid";
import { getCollection, getCluster } from "./db/couchbaseClient.js";
import { encryptText, decryptText } from "./vault/transit.js";
import logger from "../configurations/logger.js";

/**
 * Create a mission and store it in Couchbase.
 * Optionally includes an AI-generated summary and status.
 *
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.body
 * @param {string|null} [params.owner]
 * @param {string[]} [params.tags]
 * @param {string} [params.summary]
 * @param {string} [params.summaryStatus]
 */
export async function createMission({
  title,
  body,
  owner,
  tags = [],
  summary,
  summaryStatus,
}) {
  const collection = await getCollection();

  const id = uuidv4();
  const createdAt = new Date().toISOString();

  const encryptedBody = await encryptText(body);

  const doc = {
    id,
    title,
    owner: owner || null,
    tags,
    created_at: createdAt,
    encrypted_body: encryptedBody,

    // Enrichment fields
    summary: summary ?? "",
    summary_status: summaryStatus ?? "n/a",
  };

  await collection.insert(id, doc);

  logger.debug("Created mission", {
    id,
    hasSummary: Boolean(summary),
    summaryStatus: doc.summary_status,
  });

  // What the API returns to the frontend
  return {
    id,
    title,
    owner: owner || null,
    tags,
    created_at: createdAt,
    summary: doc.summary,
    summary_status: doc.summary_status,
  };
}

export async function listMissions(limit = 20) {
  const bucketName = process.env.CB_BUCKET || "missions";
  const scopeName = process.env.CB_SCOPE || "_default";
  const collName = process.env.CB_COLLECTION || "_default";

  const query = `
    SELECT m.*
    FROM \`${bucketName}\`.\`${scopeName}\`.\`${collName}\` AS m
    ORDER BY m.created_at DESC
    LIMIT $1
  `;

  try {
    const cluster = await getCluster();
    const result = await cluster.query(query, {
      parameters: [limit],
    });
    return result.rows || [];
  } catch (err) {
    logger.error("listMissions query failed", {
      message: err?.message,
      code: err?.code,
      ctx: err?.context,
    });
    throw err;
  }
}

export async function getMissionById(id) {
  const collection = await getCollection();

  const { value } = await collection.get(id);
  const decryptedBody = await decryptText(value.encrypted_body);

  // value already includes summary / summary_status if present
  return { ...value, body: decryptedBody };
}
