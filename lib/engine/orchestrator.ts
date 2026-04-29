import { ClassificationSchema, type Classification } from "../schemas/classification";
import { SafetyResultSchema, type SafetyResult } from "../schemas/safety";
import { ResolutionModelOutputSchema, type Resolution } from "../schemas/resolution";
import { lookupPolicy } from "../data/policy-table";
import type { PolicyCell } from "../schemas/policy";
import { getMockOrder } from "../data/mock-orders";
import type { Order } from "../schemas/order";
import { chat } from "../llm/openai";
import { CLASSIFIER_SYSTEM_MESSAGE, classifierUserTemplate } from "../prompts/classifier";
import { RESPONDER_EN_SYSTEM_MESSAGE, responderEnUserTemplate } from "../prompts/responder-en";
import { RESPONDER_AR_SYSTEM_MESSAGE, responderArUserTemplate } from "../prompts/responder-ar";
import { SAFETY_SYSTEM_MESSAGE, safetyUserTemplate } from "../prompts/safety";

const PRIMARY_MODEL = "gpt-4o-mini";
/**
 * Retry an async operation once on failure. Used to absorb gpt-oss free
 * tier flakiness (parse failures, mid-stream terminations, transient
 * network errors). Two attempts total: one initial, one retry.
 *
 * Not used for 429 — that's handled inside chat() with a 30s wait.
 */
async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const errMsg = (err as Error).message;
    console.warn(`[orchestrator] ${label} failed: ${errMsg.slice(0, 120)} — retrying once`);
    return await fn();
  }
}

export interface ResolveInput {
  message: string;       // mom's free-text complaint
  order_id: string;      // M-prefix mock order id
}

export interface ResolveResult {
  resolution: Resolution;
  classification: Classification;
  safety: SafetyResult;
  policy: PolicyCell | null;
  order: Order | null;
  meta: {
    classifier_ms: number;
    safety_ms: number;
    responder_ms: number;
    total_ms: number;
  };
}

/**
 * Strict JSON parse with the same quote-repair fallback the harness uses.
 * Engine layer needs the same tolerance the test harness has.
 */
function parseJsonLoose(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const repaired = text.replace(/\\"/g, '"').replace(/'/g, '"');
    return JSON.parse(repaired);
  }
}

/**
 * Find the JSON object body in possibly-noisy LLM text.
 */
function extractJsonBody(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : text.trim();
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON object found in LLM output");
  }
  return candidate.slice(firstBrace, lastBrace + 1);
}

/**
 * The full pipeline. Mom's message in, structured Resolution out.
 *
 * Pipeline:
 *   1. Look up the order (mock-orders).
 *   2. Run the classifier LLM call (with retry).
 *   3. Look up the policy cell deterministically.
 *   4. Run the safety classifier LLM call (with retry).
 *   5. Run the responder LLM call EN or AR based on classification.language (with retry).
 *   6. Stamp meta fields deterministically (language, classification_confidence, etc.).
 */
export async function resolve(input: ResolveInput): Promise<ResolveResult> {
  const t0 = Date.now();

  // 1. Order lookup. Null is fine — classifier and policy handle it.
  const order = getMockOrder(input.order_id);
  const orderJson = order ? JSON.stringify(order, null, 2) : "(no order found for this id)";

  // 2. Classifier (with retry on flaky output)
  const classifierStart = Date.now();
  const classification = await withRetry("classifier", async () => {
    const raw = await chat({
      model: PRIMARY_MODEL,
      messages: [
        { role: "system", content: CLASSIFIER_SYSTEM_MESSAGE },
        {
          role: "user",
          content: classifierUserTemplate({
            id: "live",
            description: "live request",
            user_message: input.message,
            context: orderJson,
          }),
        },
      ],
      response_format_json: true,
    });
    const body = extractJsonBody(raw.text);
    const parsed = parseJsonLoose(body);
    return ClassificationSchema.parse(parsed);
  });
  const classifierMs = Date.now() - classifierStart;

  // 3. Policy lookup (deterministic)
  const policy = lookupPolicy(classification.issue_type, classification.product_category);

  // 4. Safety classifier (with retry)
  const safetyStart = Date.now();
  const safetyContext = JSON.stringify(
    {
      issue_type: classification.issue_type,
      product_category: classification.product_category,
      urgency_tier: classification.urgency_tier,
      confidence: classification.confidence,
    },
    null,
    2
  );
  const safety = await withRetry("safety", async () => {
    const raw = await chat({
      model: PRIMARY_MODEL,
      messages: [
        { role: "system", content: SAFETY_SYSTEM_MESSAGE },
        {
          role: "user",
          content: safetyUserTemplate({
            id: "live",
            description: "live request",
            user_message: input.message,
            context: safetyContext,
          }),
        },
      ],
      response_format_json: true,
    });
    const body = extractJsonBody(raw.text);
    const parsed = parseJsonLoose(body);
    return SafetyResultSchema.parse(parsed);
  });
  const safetyMs = Date.now() - safetyStart;

  // 5. Responder (EN or AR, with retry)
  const useArabic = classification.language === "ar";
  const responderSystem = useArabic ? RESPONDER_AR_SYSTEM_MESSAGE : RESPONDER_EN_SYSTEM_MESSAGE;
  const responderTemplate = useArabic ? responderArUserTemplate : responderEnUserTemplate;
  const responderContext = JSON.stringify(
    {
      order_id: input.order_id,
      classification,
      policy,
      safety,
    },
    null,
    2
  );

  const responderStart = Date.now();
  const modelOutput = await withRetry("responder", async () => {
    const raw = await chat({
      model: PRIMARY_MODEL,
      messages: [
        { role: "system", content: responderSystem },
        {
          role: "user",
          content: responderTemplate({
            id: "live",
            description: "live request",
            user_message: input.message,
            context: responderContext,
          }),
        },
      ],
      response_format_json: true,
    });
    const body = extractJsonBody(raw.text);
    const parsed = parseJsonLoose(body);
    return ResolutionModelOutputSchema.parse(parsed);
  });
  const responderMs = Date.now() - responderStart;

  // 6. Engine stamps language + meta deterministically.
  // Policy table is authoritative for escalation. classification.needs_human
  // is a hint we ignore here — it fires too aggressively (e.g., on safety_critical
  // urgency cases where the policy actually has an automated entitlement like
  // alternative_offered). Only escalate when policy says always_escalate, when
  // the policy is null (out_of_scope/unclear), or when classifier confidence is low.
  const usedHumanEscalation =
    (policy?.always_escalate ?? false) ||
    policy === null ||
    classification.confidence < 0.7;

  const totalMs = Date.now() - t0;

  const resolution: Resolution = {
    ...modelOutput,
    language: useArabic ? "ar" : "en",
    meta: {
      classification_confidence: classification.confidence,
      used_human_escalation: usedHumanEscalation,
      response_generation_ms: responderMs,
    },
  };

  return {
    resolution,
    classification,
    safety,
    policy,
    order,
    meta: {
      classifier_ms: classifierMs,
      safety_ms: safetyMs,
      responder_ms: responderMs,
      total_ms: totalMs,
    },
  };
}