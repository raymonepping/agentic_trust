import fetch from "node-fetch";

const HF_API_KEY = process.env.HF_API_KEY;
const HF_MODEL = process.env.HF_MODEL || "mistralai/Mistral-7B-Instruct";
const HF_API_URL =
  process.env.HF_API_URL ||
  `https://api-inference.huggingface.co/models/${HF_MODEL}`;

export async function huggingFaceChat({ system, messages }) {
  if (!HF_API_KEY) {
    throw new Error("HF_API_KEY is not set");
  }

  const userContent = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n`);

  const prompt = [
    system ? `SYSTEM: ${system}` : "",
    userContent,
    "ASSISTANT:",
  ]
    .filter(Boolean)
    .join("\n\n");

  const payload = {
    inputs: prompt,
    parameters: {
      max_new_tokens: 512,
      temperature: 0.3,
    },
  };

  const res = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hugging Face error: ${res.status} ${text}`);
  }

  const data = await res.json();

  const text =
    Array.isArray(data) && data[0]?.generated_text
      ? data[0].generated_text
      : data.generated_text || "";

  return text;
}
