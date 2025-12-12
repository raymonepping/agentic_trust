// services/vault/vaultAppClient.js
import fetch from "node-fetch";

let appToken = null;
let appTokenExpiresAt = 0; // epoch seconds

function getAppRoleConfig() {
  const VAULT_ADDR = process.env.VAULT_ADDR || "http://localhost:8200";
  const VAULT_NAMESPACE = process.env.VAULT_NAMESPACE;
  const ROLE_ID = process.env.VAULT_APP_ROLE_ID;
  const SECRET_ID = process.env.VAULT_APP_SECRET_ID;

  if (!ROLE_ID || !SECRET_ID) {
    throw new Error("VAULT_APP_ROLE_ID or VAULT_APP_SECRET_ID is not set");
  }

  return { VAULT_ADDR, VAULT_NAMESPACE, ROLE_ID, SECRET_ID };
}

function vaultBaseUrl(addr) {
  return addr.replace(/\/+$/, "");
}

async function loginAppRole() {
  const { VAULT_ADDR, VAULT_NAMESPACE, ROLE_ID, SECRET_ID } = getAppRoleConfig();

  const url = `${vaultBaseUrl(VAULT_ADDR)}/v1/auth/approle/login`;
  const body = JSON.stringify({
    role_id: ROLE_ID,
    secret_id: SECRET_ID,
  });

  const headers = { "Content-Type": "application/json" };
  if (VAULT_NAMESPACE) {
    headers["X-Vault-Namespace"] = VAULT_NAMESPACE;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vault AppRole login (app) failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const token = data?.auth?.client_token;
  const ttl = data?.auth?.lease_duration || data?.auth?.ttl || 3600;

  if (!token) {
    throw new Error("Vault AppRole login (app) response missing auth.client_token");
  }

  const now = Math.floor(Date.now() / 1000);
  appToken = token;
  // Renew a bit before expiry
  appTokenExpiresAt = now + ttl - 60;

  return appToken;
}

async function ensureAppToken() {
  const now = Math.floor(Date.now() / 1000);
  if (appToken && now < appTokenExpiresAt) {
    return appToken;
  }
  return loginAppRole();
}

export async function vaultAppRequest(method, path, body) {
  const { VAULT_ADDR, VAULT_NAMESPACE } = getAppRoleConfig();
  const token = await ensureAppToken();

  const cleanPath = path.replace(/^\/+/, "");
  const url = `${vaultBaseUrl(VAULT_ADDR)}/v1/${cleanPath}`;

  const headers = {
    "X-Vault-Token": token,
    "Content-Type": "application/json",
  };

  if (VAULT_NAMESPACE) {
    headers["X-Vault-Namespace"] = VAULT_NAMESPACE;
  }

  const options = {
    method: method.toUpperCase(),
    headers,
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vault app request failed [${method} ${path}]: ${res.status} ${text}`);
  }

  return res.json();
}
