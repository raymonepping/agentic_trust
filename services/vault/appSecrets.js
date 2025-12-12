// services/vault/appSecrets.js
import { vaultAppRequest } from "./vaultAppClient.js";

let cachedSecrets = null;

export async function getAppSecrets() {
  if (cachedSecrets) {
    return cachedSecrets;
  }

  // KV v2 path: kv/data/app/agentic_auth
  const res = await vaultAppRequest("GET", "kv/data/app/agentic_auth");
  const data = res?.data?.data;

  if (!data) {
    throw new Error("Vault KV kv/app/agentic_auth missing data");
  }

  const jwtSecret = data.jwt_secret;
  const passwordPepper = data.password_pepper;

  if (!jwtSecret) {
    throw new Error("Vault KV kv/app/agentic_auth missing jwt_secret");
  }

  cachedSecrets = {
    jwtSecret,
    passwordPepper: passwordPepper || null,
  };

  return cachedSecrets;
}
