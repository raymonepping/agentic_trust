// services/missionService.js
import { v4 as uuidv4 } from "uuid";
import { getCollection, getCluster } from "./db/couchbaseClient.js";
import { encryptText, decryptText } from "./vault/transit.js";
import { withUserChildToken } from "./vault/agenticTokens.js";
import logger from "../configurations/logger.js";

/**
 * Create a mission and store it in Couchbase.
 * Encryption is performed with a short lived child Vault token
 * that carries user + mission metadata so audit logs can attribute requests.
 *
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.body
 * @param {string|null} [params.ownerId]
 * @param {string|null} [params.ownerName]
 * @param {string[]} [params.tags]
 * @param {string} [params.summary]
 * @param {string} [params.summaryStatus]
 */
export async function createMission({
  title,
  body,
  ownerId,
  ownerName,
  tags = [],
  summary,
  summaryStatus,
}) {
  const collection = await getCollection();

  const id = uuidv4();
  const createdAt = new Date().toISOString();

  // Encrypt using a child token that has user + mission metadata
  const encryptedBody = await withUserChildToken(
    {
      userId: ownerId || null,
      userName: ownerName || null,
      missionId: id,
    },
    async childToken => encryptText(body, childToken),
  );

  const doc = {
    id,
    title,
    owner: ownerName || null,
    owner_id: ownerId || null,
    owner_name: ownerName || null,
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
    owner_id: ownerId,
    owner_name: ownerName,
    hasSummary: Boolean(summary),
    summaryStatus: doc.summary_status,
  });

  // API response
  return {
    id,
    title,
    owner: doc.owner,
    owner_id: doc.owner_id,
    owner_name: doc.owner_name,
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

  return { ...value, body: decryptedBody };
}