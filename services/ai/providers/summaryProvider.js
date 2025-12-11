// services/ai/providers/summaryProvider.js
import { pipeline } from "@huggingface/transformers";
import logger from "../../../configurations/logger.js";

// Lazily initialised text-generation pipeline
let generatorPromise = null;

/**
 * Create or reuse the text generation pipeline.
 * Default model: HuggingFaceTB/SmolLM2-1.7B-Instruct
 *
 * If you want to make the model configurable later, you can
 * read it from Vault or env and pass it in here.
 */
async function getGenerator() {
  if (!generatorPromise) {
    const modelId =
      process.env.HF_SUMMARY_MODEL ||
      "HuggingFaceTB/SmolLM2-1.7B-Instruct";

    logger.info(
      `[hf-summary] Initialising local Transformers.js pipeline with model '${modelId}'`
    );

    // NOTE: This downloads the model locally the first time.
    generatorPromise = pipeline("text-generation", modelId);
  }

  return generatorPromise;
}

/**
 * Generate a short mission summary from the plaintext body using
 * a local SmolLM2 instruction model (no HTTP, no router).
 *
 * @param {string} body - Mission body in plain text
 * @returns {Promise<string>} summary
 */
export async function generateMissionSummary(body) {
  if (!body || typeof body !== "string" || !body.trim()) {
    return "";
  }

  // Keep it sane in length
  const clipped = body.slice(0, 4000);

  const generator = await getGenerator();

  // Summarisation style system prompt
  const systemPrompt =
    "Provide a concise, objective summary of the input text in up to three sentences, focusing on key actions and intentions without using second or third person pronouns.";

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: clipped },
  ];

  try {
    const outputs = await generator(messages, {
      max_new_tokens: 120,
      temperature: 0.2,
    });

    // Transformers.js returns an array with `generated_text` as a chat-like list
    const first = outputs?.[0];
    if (!first || !Array.isArray(first.generated_text)) {
      logger.warn("[hf-summary] Unexpected generator output shape", {
        outputs,
      });
      return "";
    }

    const lastTurn = first.generated_text.at(-1);
    const content = lastTurn?.content || "";

    const summary = String(content).trim();
    return summary;
  } catch (err) {
    logger.error("[hf-summary] Local summarisation failed", {
      message: err?.message,
      stack: err?.stack,
    });
    throw new Error(
      `Local summarisation failed: ${err?.message || "unknown error"}`
    );
  }
}
