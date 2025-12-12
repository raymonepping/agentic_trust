// services/vault/agenticTokens.js
import fetch from "node-fetch";

function getConfig() {
  const VAULT_ADDR = process.env.VAULT_ADDR || "http://localhost:8200";
  const VAULT_TOKEN = process.env.VAULT_TOKEN;
  const VAULT_NAMESPACE = process.env.VAULT_NAMESPACE;

  // Comma separated list of policies for the child token, default to agentic-backend
  const CHILD_TOKEN_POLICIES =
    process.env.VAULT_AGENTIC_POLICIES || "agentic-backend";

  // Short TTL so these are clearly “ephemeral on behalf of” tokens
  const CHILD_TOKEN_TTL = process.env.VAULT_AGENTIC_TTL || "5m";

  return {
    VAULT_ADDR,
    VAULT_TOKEN,
    VAULT_NAMESPACE,
    CHILD_TOKEN_POLICIES,
    CHILD_TOKEN_TTL,
  };
}

function vaultBaseUrl(addr) {
  return addr.replace(/\/+$/, "");
}

function buildHeaders(parentToken, namespace) {
  if (!parentToken) {
    throw new Error("VAULT_TOKEN is not set; cannot create child tokens");
  }

  const headers = {
    "X-Vault-Token": parentToken,
    "Content-Type": "application/json",
  };

  if (namespace) {
    headers["X-Vault-Namespace"] = namespace;
  }

  return headers;
}

/**
 * Run a function under a short lived child token that carries user + mission metadata.
 *
 * @param {{ userId?: string | null, userName?: string | null, missionId?: string | null }} ctx
 * @param {(childToken: string) => Promise<any>} fn
 */
export async function withUserChildToken(ctx, fn) {
  const {
    VAULT_ADDR,
    VAULT_TOKEN,
    VAULT_NAMESPACE,
    CHILD_TOKEN_POLICIES,
    CHILD_TOKEN_TTL,
  } = getConfig();

  const url = `${vaultBaseUrl(VAULT_ADDR)}/v1/auth/token/create`;

  const body = JSON.stringify({
    policies: CHILD_TOKEN_POLICIES.split(",")
      .map(p => p.trim())
      .filter(Boolean),
    ttl: CHILD_TOKEN_TTL,
    meta: {
      user_id: ctx.userId || "",
      user_name: ctx.userName || "",
      mission_id: ctx.missionId || "",
    },
  });

  const res = await fetch(url, {
    method: "POST",
    headers: buildHeaders(VAULT_TOKEN, VAULT_NAMESPACE),
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Vault child token create failed: ${res.status} ${text}`,
    );
  }

  const data = await res.json();
  const childToken = data?.auth?.client_token;

  if (!childToken) {
    throw new Error(
      "Vault child token response missing auth.client_token",
    );
  }

  // For now we rely on the short TTL to expire the token.
  // You can add an explicit revoke step later if you want.
  return fn(childToken);
}
