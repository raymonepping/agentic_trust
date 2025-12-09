const KEY_NAME = process.env.VAULT_TRANSIT_KEY || "missions";

// Placeholder implementations.
// Later, replace with real Vault Transit API calls.
export async function encryptText(plaintext) {
  if (!plaintext) return "";
  return plaintext;
}

export async function decryptText(ciphertext) {
  if (!ciphertext) return "";
  return ciphertext;
}
