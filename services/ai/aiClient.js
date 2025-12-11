import { ollamaChat } from "./providers/ollamaProvider.js";
// import { huggingFaceChat } from "./providers/huggingFaceProvider.js";

const PROVIDER = process.env.AI_PROVIDER || "ollama";

export async function chat({ system, messages }) {
//  if (PROVIDER === "huggingface") {
//    return huggingFaceChat({ system, messages });
//  }

  return ollamaChat({ system, messages });
}
