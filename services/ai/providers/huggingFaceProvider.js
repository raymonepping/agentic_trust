// services/ai/providers/huggingFaceProvider.js
import fetch from "node-fetch";
import logger from "../../../configurations/logger.js";
import { getKvSecret } from "../../vault/vaultClient.js";

const DEFAULT_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";

let cachedConfig = null;

async function loadHfConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Try Vault first
  let secret = {};
  try {
    secret = await getKvSecret("ai/huggingface");
  } catch (err) {
    logger.warn("[huggingface] Could not read kv/ai/huggingface from Vault", {
      message: err?.message,
    });
  }

  const apiKey =
    secret.api_key ||
    process.env.HF_API_KEY ||
    process.env.HUGGINGFACE_API_KEY;

  const model =
    secret.model ||
    process.env.HF_MODEL ||
    process.env.HUGGINGFACE_MODEL;

  const apiUrl =
    secret.api_url ||
    process.env.HF_API_URL ||
    DEFAULT_CHAT_URL;

  if (!apiKey) {
    throw new Error(
      "Hugging Face api_key is not set in kv/ai/huggingface or HF_API_KEY/HUGGINGFACE_API_KEY env"
    );
  }

  if (!model) {
    throw new Error(
      "Hugging Face model is not set in kv/ai/huggingface or HF_MODEL/HUGGINGFACE_MODEL env"
    );
  }

  cachedConfig = { apiKey, model, apiUrl };

  logger.debug("[huggingface] loaded config", {
    model,
    apiUrl,
    source: secret.api_key ? "vault" : "env",
    apiKeyPrefix: apiKey.slice(0, 6),
    apiKeyLength: apiKey.length,
  });

  return cachedConfig;
}

/**
 * Small OpenAI style abstraction:
 *
 *   huggingFaceChat({ system, messages })
 *
 * where messages = [{ role: "user" | "assistant" | "system", content: string }]
 */
export async function huggingFaceChat({ system, messages }) {
  const { apiKey, model, apiUrl } = await loadHfConfig();

  const chatMessages = [];

  if (system) {
    chatMessages.push({ role: "system", content: system });
  }

  for (const m of messages) {
    chatMessages.push({
      role: m.role,
      content: m.content,
    });
  }

  logger.debug("[huggingface] calling router", {
    model,
    apiUrl,
    messageCount: chatMessages.length,
  });

  const body = {
    model,
    messages: chatMessages,
    max_tokens: 512,
    temperature: 0.3,
  };

  let res;
  try {
    res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.error("[huggingface] network error", {
      message: err.message,
      stack: err.stack,
    });
    throw new Error(`Hugging Face network error: ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "<no body>");
    logger.error("[huggingface] router error", {
      status: res.status,
      statusText: res.statusText,
      body: text,
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Hugging Face rejected the token. Check api_key and model access."
      );
    }

    throw new Error(
      `Hugging Face router error: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();

  const choice = data.choices && data.choices[0];
  const content = choice?.message?.content ?? null;

  if (!content) {
    logger.warn("[huggingface] no assistant content in response", { data });
    return JSON.stringify(data);
  }

  return content;
}
