import fetch from "node-fetch";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

export async function ollamaChat({ system, messages }) {
  const payload = {
    model: OLLAMA_MODEL,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      ...messages,
    ],
    stream: false,
  };

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error: ${res.status} ${text}`);
  }

  const data = await res.json();

  // Ollama returns a single message object for non-streaming chat
  const answer = data.message?.content ?? "";
  return answer;
}
