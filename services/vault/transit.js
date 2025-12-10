// services/vault/transit.js
import fetch from "node-fetch";

function getConfig() {
  const VAULT_ADDR = process.env.VAULT_ADDR || "http://localhost:8200";
  const VAULT_TOKEN = process.env.VAULT_TOKEN;
  const VAULT_NAMESPACE = process.env.VAULT_NAMESPACE;
  const TRANSIT_MOUNT = process.env.VAULT_TRANSIT_MOUNT || "transit";
  const KEY_NAME = process.env.VAULT_TRANSIT_KEY || "missions";

  return { VAULT_ADDR, VAULT_TOKEN, VAULT_NAMESPACE, TRANSIT_MOUNT, KEY_NAME };
}

function vaultBaseUrl(VAULT_ADDR) {
  // Strip trailing slashes to avoid double slash issues
  return VAULT_ADDR.replace(/\/+$/, "");
}

function vaultUrl(endpoint) {
  const { VAULT_ADDR, TRANSIT_MOUNT } = getConfig();
  return `${vaultBaseUrl(VAULT_ADDR)}/v1/${TRANSIT_MOUNT}/${endpoint}`;
}

function buildHeaders() {
  const { VAULT_TOKEN, VAULT_NAMESPACE } = getConfig();

  if (!VAULT_TOKEN) {
    throw new Error("VAULT_TOKEN is not set");
  }

  const headers = {
    "X-Vault-Token": VAULT_TOKEN,
    "Content-Type": "application/json",
  };

  if (VAULT_NAMESPACE) {
    headers["X-Vault-Namespace"] = VAULT_NAMESPACE;
  }

  return headers;
}

export async function encryptText(plaintext) {
  if (!plaintext) return "";

  const { KEY_NAME } = getConfig();
  const url = vaultUrl(`encrypt/${KEY_NAME}`);
  const headers = buildHeaders();
  const base64Plaintext = Buffer.from(plaintext, "utf8").toString("base64");

  const body = JSON.stringify({
    plaintext: base64Plaintext,
  });

  const res = await fetch(url, {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vault Transit encrypt failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const ciphertext = data?.data?.ciphertext;

  if (!ciphertext) {
    throw new Error("Vault Transit encrypt response missing data.ciphertext");
  }

  return ciphertext;
}

export async function decryptText(ciphertext) {
  if (!ciphertext) return "";

  const { KEY_NAME } = getConfig();
  const url = vaultUrl(`decrypt/${KEY_NAME}`);
  const headers = buildHeaders();

  const body = JSON.stringify({
    ciphertext,
  });

  const res = await fetch(url, {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vault Transit decrypt failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const base64Plaintext = data?.data?.plaintext;

  if (!base64Plaintext) {
    throw new Error("Vault Transit decrypt response missing data.plaintext");
  }

  const plaintext = Buffer.from(base64Plaintext, "base64").toString("utf8");
  return plaintext;
}
