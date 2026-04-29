import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

/**
 * Minimal OpenAI client.
 *
 * Mirrors the interface of openrouter.ts so the orchestrator can swap
 * providers by changing one line. Used as the runtime client after
 * chunk-3 testing showed free-tier providers degraded to ~65%
 * reliability during chunk-4 integration.
 *
 * Returns the raw text content of the assistant's reply.
 * Parsing JSON, validating against schemas, retrying on bad output —
 * all happens at the orchestrator layer, not here.
 *
 * Defaults match openrouter.ts:
 * - max_tokens: 3000
 * - temperature: 0.2
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format_json?: boolean;
}

export interface ChatResponse {
  text: string;
  raw_text: string;
  model_used: string;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  rate_limited_retried: boolean;
}

async function callOnce(req: ChatRequest, apiKey: string): Promise<Response> {
  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    temperature: req.temperature ?? 0.2,
    max_tokens: req.max_tokens ?? 3000,
  };
  if (req.response_format_json) {
    body.response_format = { type: "json_object" };
  }
  return fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/**
 * Send a chat request to OpenAI. Handles a single 429 retry after 30s.
 * Returns parsed text + metadata.
 */
export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set in .env.local");
  }
  const start = Date.now();
  let response = await callOnce(req, apiKey);
  let rate_limited_retried = false;
  if (response.status === 429) {
    rate_limited_retried = true;
    console.warn(`Rate limited on ${req.model}. Waiting 30s and retrying...`);
    await new Promise((resolve) => setTimeout(resolve, 30000));
    response = await callOnce(req, apiKey);
  }
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(
      `OpenAI HTTP ${response.status} on ${req.model}: ${errBody.slice(0, 500)}`
    );
  }
  const data = await response.json();
  const latency_ms = Date.now() - start;
  const raw_text = data.choices?.[0]?.message?.content ?? "";
  return {
    text: raw_text.trim(),
    raw_text,
    model_used: data.model,
    latency_ms,
    prompt_tokens: data.usage?.prompt_tokens ?? 0,
    completion_tokens: data.usage?.completion_tokens ?? 0,
    rate_limited_retried,
  };
}