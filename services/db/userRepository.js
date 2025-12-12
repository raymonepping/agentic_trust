// services/db/userRepository.js
import { getCluster } from "./couchbaseClient.js";

function createUserId() {
  return `user_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create a new user with tokenized email + deterministic hash.
 */
export async function createUserRecord({
  email_token,
  email_hash,
  display_name,
  password_hash,
}) {
  const cluster = await getCluster();
  const bucketName = process.env.CB_BUCKET || "missions";

  const bucket = cluster.bucket(bucketName);
  const scope = bucket.scope("identity");
  const coll = scope.collection("users");

  const user_id = createUserId();
  const docId = `user::${user_id}`;
  const now = new Date().toISOString();

  const doc = {
    type: "user",
    user_id,
    email_token,       // Vault tokenized
    email_hash,        // deterministic, for lookup
    display_name,
    password_hash,
    roles: ["user"],
    created_at: now,
    last_login_at: now,
  };

  await coll.insert(docId, doc);

  return {
    user_id,
    display_name,
    roles: doc.roles,
    email_token,
    email_hash,
    password_hash,
  };
}

/**
 * Look up user by deterministic email hash.
 */
export async function findUserByEmailHash(email_hash) {
  const cluster = await getCluster();
  const bucketName = process.env.CB_BUCKET || "missions";

  const query = `
    SELECT u.*
    FROM \`${bucketName}\`.identity.users AS u
    WHERE u.type = "user"
      AND u.email_hash = $email_hash
    LIMIT 1
  `;

  const result = await cluster.query(query, {
    parameters: { email_hash },
  });

  return result.rows[0] || null;
}
