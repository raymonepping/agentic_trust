// services/vault/transformEmail.js
import { vaultAppRequest } from "./vaultAppClient.js";

export async function encodeEmail(value) {
  if (!value) {
    throw new Error("encodeEmail: value is required");
  }

  const res = await vaultAppRequest(
    "POST",
    "transform/encode/agentic-email",
    { value }
  );

  const encoded = res?.data?.encoded_value;
  if (!encoded) {
    throw new Error("Vault Transform encode response missing data.encoded_value");
  }

  return encoded;
}

// Optional decode
export async function decodeEmail(token) {
  if (!token) {
    throw new Error("decodeEmail: token is required");
  }

  const res = await vaultAppRequest(
    "POST",
    "transform/decode/agentic-email",
    { value: token }
  );

  const decoded = res?.data?.decoded_value;
  if (!decoded) {
    throw new Error("Vault Transform decode response missing data.decoded_value");
  }

  return decoded;
}
