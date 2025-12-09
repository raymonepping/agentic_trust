You are a senior Node.js backend engineer.

In the root, create a new folder named `agentic_trust` that contains a minimal backend for an "agentic trust" playground:

- Node 20+
- Express
- Couchbase as NoSQL backend
- AI provider interface with two providers: Ollama (local) and Hugging Face
- A small "mission" domain:
  - Create and list missions
  - Store mission bodies encrypted (later via Vault Transit)
  - Ask an AI agent questions about a specific mission

Use ECMAScript modules (`"type": "module"` in package.json).

Inside `agentic_trust`, create the following structure:
prompts/
agentic_trust/
  package.json
  .env.example
  app.js
  routes/
    missions.js
    ai.js
  services/
    missionService.js
    db/
      couchbaseClient.js
    vault/
      transit.js
    ai/
      aiClient.js
      providers/
        ollamaProvider.js
        huggingFaceProvider.js
    agent/
      missionAgent.js

Create each file with the exact content given below.

1) package.json

Create `agentic_trust/package.json` with this content:

{
  "name": "agentic_trust_backend",
  "version": "1.0.0",
  "description": "Agentic trust playground backend with Couchbase, AI providers, and Vault Transit ready stubs.",
  "main": "app.js",
  "type": "module",
  "scripts": {
    "dev": "node app.js"
  },
  "dependencies": {
    "couchbase": "*",
    "dotenv": "*",
    "express": "*",
    "node-fetch": "*",
    "uuid": "*"
  }
}

Do not add anything else.

2) .env.example

Create `agentic_trust/.env.example` with:

PORT=3001

# Couchbase
CB_CONN_STR=couchbase://localhost
CB_USERNAME=Administrator
CB_PASSWORD=secret
CB_BUCKET=missions
CB_SCOPE=_default
CB_COLLECTION=missions

# AI provider selection
AI_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3

HF_API_KEY=
HF_MODEL=mistralai/Mistral-7B-Instruct

# Vault (not used yet, but reserved)
VAULT_ADDR=http://localhost:8200
VAULT_TOKEN=changeme
VAULT_TRANSIT_KEY=missions

3) app.js

Create `agentic_trust/app.js`:

import express from "express";
import dotenv from "dotenv";
import missionsRouter from "./routes/missions.js";
import aiRouter from "./routes/ai.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/missions", missionsRouter);
app.use("/ai", aiRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Basic error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[Error]", err);
  res.status(500).json({ error: "Internal server error" });
});

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

4) services/db/couchbaseClient.js

Create `agentic_trust/services/db/couchbaseClient.js`:

import couchbase from "couchbase";

let cluster;
let bucket;
let cachedScope;
let cachedCollection;

async function initCluster() {
  if (cluster) {
    return cluster;
  }

  const connStr = process.env.CB_CONN_STR;
  const username = process.env.CB_USERNAME;
  const password = process.env.CB_PASSWORD;
  const bucketName = process.env.CB_BUCKET;

  if (!connStr || !username || !password || !bucketName) {
    throw new Error("Couchbase env vars are missing");
  }

  cluster = await couchbase.connect(connStr, {
    username,
    password,
  });

  bucket = cluster.bucket(bucketName);
  return cluster;
}

export async function getCluster() {
  if (!cluster) {
    await initCluster();
  }
  return cluster;
}

export async function getBucket() {
  if (!bucket) {
    await initCluster();
  }
  return bucket;
}

export async function getScope() {
  if (cachedScope) {
    return cachedScope;
  }

  const bucketName = process.env.CB_BUCKET;
  const scopeName = process.env.CB_SCOPE || "_default";

  const b = await getBucket();
  cachedScope = b.scope(scopeName);
  return cachedScope;
}

export async function getCollection() {
  if (cachedCollection) {
    return cachedCollection;
  }

  const collectionName = process.env.CB_COLLECTION || "missions";
  const scope = await getScope();

  cachedCollection = scope.collection(collectionName);
  return cachedCollection;
}

Note: the query API in newer Couchbase SDKs can use either cluster.query or scope.query. This file is written to be compatible with scope.query. When wiring it to a real cluster, verify syntax with current Couchbase Node SDK docs.

5) services/vault/transit.js

Create `agentic_trust/services/vault/transit.js` as a no-op stub that can later be replaced with real Vault Transit:

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

6) services/missionService.js

Create `agentic_trust/services/missionService.js`:

import { v4 as uuidv4 } from "uuid";
import { getCollection, getScope } from "./db/couchbaseClient.js";
import { encryptText, decryptText } from "./vault/transit.js";

export async function createMission({ title, body, owner, tags = [] }) {
  const collection = await getCollection();

  const id = uuidv4();
  const createdAt = new Date().toISOString();

  const encryptedBody = await encryptText(body);

  const doc = {
    id,
    title,
    owner: owner || null,
    tags,
    created_at: createdAt,
    encrypted_body: encryptedBody,
  };

  await collection.insert(id, doc);

  return {
    id,
    title,
    owner: owner || null,
    tags,
    created_at: createdAt,
  };
}

export async function listMissions(limit = 20) {
  const scope = await getScope();

  const bucketName = process.env.CB_BUCKET;
  const scopeName = process.env.CB_SCOPE || "_default";
  const collName = process.env.CB_COLLECTION || "missions";

  const query = `
    SELECT m.*
    FROM \`${bucketName}\`.\`${scopeName}\`.\`${collName}\` AS m
    ORDER BY m.created_at DESC
    LIMIT $1
  `;

  // Depending on SDK version, you might need cluster.query instead.
  const result = await scope.query(query, {
    parameters: [limit],
  });

  return result.rows || [];
}

export async function getMissionById(id) {
  const collection = await getCollection();

  const { value } = await collection.get(id);
  const decryptedBody = await decryptText(value.encrypted_body);

  return { ...value, body: decryptedBody };
}

7) services/ai/aiClient.js

Create `agentic_trust/services/ai/aiClient.js`:

import { ollamaChat } from "./providers/ollamaProvider.js";
import { huggingFaceChat } from "./providers/huggingFaceProvider.js";

const PROVIDER = process.env.AI_PROVIDER || "ollama";

export async function chat({ system, messages }) {
  if (PROVIDER === "huggingface") {
    return huggingFaceChat({ system, messages });
  }

  return ollamaChat({ system, messages });
}

8) services/ai/providers/ollamaProvider.js

Create `agentic_trust/services/ai/providers/ollamaProvider.js`:

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

  const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error: ${res.status} ${text}`);
  }

  const data = await res.json();
  const answer = data.choices?.[0]?.message?.content ?? "";
  return answer;
}

9) services/ai/providers/huggingFaceProvider.js

Create `agentic_trust/services/ai/providers/huggingFaceProvider.js`:

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

10) services/agent/missionAgent.js

Create `agentic_trust/services/agent/missionAgent.js`:

import { chat as aiChat } from "../ai/aiClient.js";
import { getMissionById } from "../missionService.js";

export async function answerQuestionAboutMission({ missionId, question }) {
  const mission = await getMissionById(missionId);
  if (!mission) {
    throw new Error(`Mission ${missionId} not found`);
  }

  const system =
    "You are an assistant that can only answer based on the provided mission context. " +
    "If you do not know, say you are unsure.";

  const contextLines = [
    `Title: ${mission.title}`,
    mission.owner ? `Owner: ${mission.owner}` : "",
    "",
    "Body:",
    mission.body,
  ].filter(Boolean);

  const context = contextLines.join("\n");

  const answer = await aiChat({
    system,
    messages: [
      {
        role: "user",
        content: `${context}\n\nUser question: ${question}`,
      },
    ],
  });

  return {
    missionId,
    question,
    answer,
  };
}

11) routes/missions.js

Create `agentic_trust/routes/missions.js`:

import { Router } from "express";
import {
  createMission,
  listMissions,
  getMissionById,
} from "../services/missionService.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { title, body, owner, tags } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: "title and body are required" });
    }

    const mission = await createMission({ title, body, owner, tags });
    res.status(201).json(mission);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const missions = await listMissions();
    res.json(missions);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const mission = await getMissionById(req.params.id);
    if (!mission) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json(mission);
  } catch (err) {
    next(err);
  }
});

export default router;

12) routes/ai.js

Create `agentic_trust/routes/ai.js`:

import { Router } from "express";
import { answerQuestionAboutMission } from "../services/agent/missionAgent.js";

const router = Router();

router.post("/mission/:id", async (req, res, next) => {
  try {
    const missionId = req.params.id;
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: "question is required" });
    }

    const result = await answerQuestionAboutMission({ missionId, question });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

create a prompt_1.md with the content of this prompt and place that in;
prompts/

After creating all files, do not modify anything else.

End of instructions.
