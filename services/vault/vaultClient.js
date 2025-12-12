// services/vault/vaultClient.js
import fetch from "node-fetch";

let clientToken = null;
let tokenExpiresAt = 0; // epoch seconds

function getBaseConfig() {
  const VAULT_ADDR = process.env.VAULT_ADDR || "http://localhost:8200";
  const VAULT_NAMESPACE = process.env.VAULT_NAMESPACE;
  const AUTH_MODE = process.env.AUTH_MODE || "approle"; // "token" or "approle"
  const STATIC_TOKEN = process.env.VAULT_TOKEN || null;

  return { VAULT_ADDR, VAULT_NAMESPACE, AUTH_MODE, STATIC_TOKEN };
}

function vaultBaseUrl(addr) {
  return addr.replace(/\/+$/, "");
}

function buildHeaders(token, namespace) {
  if (!token) {
    throw new Error("Vault token is not available for this request");
  }

  const headers = {
    "X-Vault-Token": token,
    "Content-Type": "application/json",
  };

  if (namespace) {
    headers["X-Vault-Namespace"] = namespace;
  }

  return headers;
}

async function loginWithAppRole() {
  const { VAULT_ADDR, VAULT_NAMESPACE } = getBaseConfig();
  const roleId = process.env.VAULT_ROLE_ID;
  const secretId = process.env.VAULT_SECRET_ID;

  if (!roleId || !secretId) {
    throw new Error("VAULT_ROLE_ID or VAULT_SECRET_ID not set for AppRole login");
  }

  const url = `${vaultBaseUrl(VAULT_ADDR)}/v1/auth/approle/login`;
  const body = JSON.stringify({
    role_id: roleId,
    secret_id: secretId,
  });

  const headers = {
    "Content-Type": "application/json",
  };
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
    throw new Error(`Vault AppRole login failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const token = data?.auth?.client_token;
  const ttl = data?.auth?.lease_duration || data?.auth?.ttl || 3600;

  if (!token) {
    throw new Error("Vault AppRole login response missing auth.client_token");
  }

  const now = Math.floor(Date.now() / 1000);
  clientToken = token;
  tokenExpiresAt = now + ttl;

  return clientToken;
}

async function ensureClientToken() {
  const { AUTH_MODE, STATIC_TOKEN } = getBaseConfig();
  const now = Math.floor(Date.now() / 1000);

  if (AUTH_MODE !== "approle") {
    // Stage 4 style: static Vault token from env
    if (!STATIC_TOKEN) {
      throw new Error("VAULT_TOKEN is not set and AUTH_MODE is not 'approle'");
    }
    clientToken = STATIC_TOKEN;
    tokenExpiresAt = now + 3600; // dummy
    return clientToken;
  }

  // AUTH_MODE = approle
  if (clientToken && now < tokenExpiresAt - 30) {
    return clientToken;
  }

  return loginWithAppRole();
}

// ---- Dynamic DB creds (database/creds/<role>) ----

export async function getDynamicDbCreds() {
  const { VAULT_ADDR, VAULT_NAMESPACE } = getBaseConfig();
  const role = process.env.VAULT_DB_ROLE || "readwrite";

  const token = await ensureClientToken();
  const url = `${vaultBaseUrl(VAULT_ADDR)}/v1/database/creds/${role}`;
  const headers = buildHeaders(token, VAULT_NAMESPACE);

  const res = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vault dynamic DB creds fetch failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const username = data?.data?.username;
  const password = data?.data?.password;
  const leaseId = data?.lease_id;
  const leaseDuration = data?.lease_duration;

  if (!username || !password) {
    throw new Error("Vault dynamic DB creds missing username or password");
  }

  return { username, password, leaseId, leaseDuration };
}

// ---- KV v2 helper: read secret data from kv/<path> ----
export async function getKvSecret(path) {
  const { VAULT_ADDR, VAULT_NAMESPACE } = getBaseConfig();
  const token = await ensureClientToken();
  const url = `${vaultBaseUrl(VAULT_ADDR)}/v1/kv/data/${path}`;
  const headers = buildHeaders(token, VAULT_NAMESPACE);

  const res = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vault KV read failed for path ${path}: ${res.status} ${text}`);
  }

  const data = await res.json();
  // KV v2: { data: { data: { ...your fields... }, metadata: { ... } } }
  return data?.data?.data || {};
}

export async function vaultRequest(method, path, body) {
  const { VAULT_ADDR, VAULT_NAMESPACE } = getBaseConfig();
  const token = await ensureClientToken();

  const cleanPath = path.replace(/^\/+/, "");
  const url = `${vaultBaseUrl(VAULT_ADDR)}/v1/${cleanPath}`;

  const headers = buildHeaders(token, VAULT_NAMESPACE);

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
    throw new Error(`Vault request failed [${method} ${path}]: ${res.status} ${text}`);
  }

  return res.json();
}