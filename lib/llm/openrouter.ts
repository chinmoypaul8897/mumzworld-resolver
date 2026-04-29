import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

/**
 * Minimal OpenRouter client.
 * Used by both the test harness (this file's main use) and later by
 * lib/engine/* once we wire prompts into the orchestrator.
 *
 * Returns the raw text content of the assistant's reply.
 * Parsing JSON, validating against schemas, retrying on bad output —
 * all happens at the harness/orchestrator layer, not here.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  /**
   * If true, asks OpenRouter for JSON-mode response when supported.
   * Some models honor it (gpt-oss-120b, gemma 4); others ignore it.
   * Either way, we still validate the parsed text against Zod, so
   * this is a hint, not a hard guarantee.
   */
  response_format_json?: boolean;
}

export interface ChatResponse {
  text: string;
  raw_text: string;          // the unstripped original (for debugging)
  model_used: string;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens?: number;
  rate_limited_retried: boolean;
}

/**
 * Some models (gpt-oss family) emit internal reasoning wrapped in
 * <think>...</think> tags or similar before the actual answer.
 * We strip those before returning the text so parsers see clean JSON.
 */
function stripReasoning(text: string): string {
  return text
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/g, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/g, "")
    .trim();
}

async function callOnce(req: ChatRequest, apiKey: string): Promise<Response> {
  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    temperature: req.temperature ?? 0.2,
    max_tokens: req.max_tokens ?? 1500,
  };
  if (req.response_format_json) {
    body.response_format = { type: "json_object" };
  }

  return fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/chinmoypaul8897/mumzworld-resolver",
      "X-Title": "Mumzworld Resolver",
    },
    body: JSON.stringify(body),
  });
}

/**
 * Send a chat request to OpenRouter. Handles a single 429 retry
 * after 30 seconds. Returns parsed text + metadata.
 */
export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not set in .env.local");
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
      `OpenRouter HTTP ${response.status} on ${req.model}: ${errBody.slice(0, 500)}`
    );
  }

  const data = await response.json();
  const latency_ms = Date.now() - start;
  const raw_text = data.choices?.[0]?.message?.content ?? "";
  const text = stripReasoning(raw_text);

  return {
    text,
    raw_text,
    model_used: data.model,
    latency_ms,
    prompt_tokens: data.usage?.prompt_tokens ?? 0,
    completion_tokens: data.usage?.completion_tokens ?? 0,
    reasoning_tokens: data.usage?.completion_tokens_details?.reasoning_tokens,
    rate_limited_retried,
  };
}