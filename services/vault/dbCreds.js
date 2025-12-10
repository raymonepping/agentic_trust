// services/vault/dbCreds.js
import fetch from "node-fetch";

const VAULT_ADDR = process.env.VAULT_ADDR;
const VAULT_TOKEN = process.env.VAULT_TOKEN;
const VAULT_DB_ROLE = process.env.VAULT_DB_ROLE || "readwrite";

if (!VAULT_ADDR) {
  console.warn("[vault-db-creds] VAULT_ADDR is not set; dynamic DB creds will not work.");
}

export async function getDynamicCouchbaseCreds() {
  if (!VAULT_ADDR || !VAULT_TOKEN) {
    throw new Error("Vault addr/token are not set for dynamic DB credentials");
  }

  const url = `${VAULT_ADDR}/v1/database/creds/${VAULT_DB_ROLE}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-Vault-Token": VAULT_TOKEN,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[vault-db-creds] Vault error: ${res.status} ${text}`);
  }

  const data = await res.json();
  const creds = data?.data;

  if (!creds?.username || !creds?.password) {
    throw new Error("[vault-db-creds] Response missing username/password");
  }

  return {
    username: creds.username,
    password: creds.password,
    leaseId: data.lease_id,
    leaseTtl: data.lease_duration,
  };
}
