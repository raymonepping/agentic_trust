// services/vault/dbCreds.js
import logger from "../../configurations/logger.js";
import { getDynamicDbCreds } from "./vaultClient.js";

/**
 * Adapter between vaultClient and couchbaseClient.
 *
 * - vaultClient.getDynamicDbCreds() handles Vault auth (token or AppRole)
 * - This function reshapes that output to what couchbaseClient expects.
 */
export async function getDynamicCouchbaseCreds() {
  const { username, password, leaseDuration } = await getDynamicDbCreds();

  if (!username || !password) {
    throw new Error("Vault dynamic DB creds missing username or password");
  }

  logger.debug(
    `Fetched dynamic Couchbase creds from Vault for user '${username}' (ttl ~${leaseDuration ?? "?"}s)`
  );

  return {
    username,
    password,
    // couchbaseClient expects leaseTtl in seconds
    leaseTtl: leaseDuration,
  };
}
