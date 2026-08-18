# Smart Returns Resolver

> A bilingual AI triage layer for e-commerce customer support. Reads a customer's complaint in English, Arabic, or a code-switched mix — classifies it, applies a deterministic policy matrix, screens for safety risks, and either resolves the case in seconds or hands it to a human with full context bundled.

[![Next.js](https://img.shields.io/badge/Next.js-16.2.4-000000?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.4-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Zod](https://img.shields.io/badge/Zod-4-3068B7)](https://zod.dev/)
[![OpenAI](https://img.shields.io/badge/OpenAI-gpt--4o--mini-412991?logo=openai)](https://platform.openai.com/)
[![Eval](https://img.shields.io/badge/eval-88.5%25-success)](EVALS.md)
[![Deployed on Vercel](https://img.shields.io/badge/deployed-Vercel-000000?logo=vercel)](https://mumzworld-resolver.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)

| | |
|---|---|
| 🚀 **Live demo** | [mumzworld-resolver.vercel.app](https://mumzworld-resolver.vercel.app/) |
| 🎬 **3-minute walkthrough** | [Loom video](https://www.loom.com/share/b016f4c6c0194f11bcf12711d1ced2fd) |
| 📊 **Evaluation report** | [`EVALS.md`](EVALS.md) — 88.5% (69/78 dimensions) |

<sub>The demo runs against a live OpenAI key on mock order data. Nothing it does touches a real order — but every submission costs real tokens, and the endpoint is unauthenticated. See [Tradeoffs](#tradeoffs).</sub>

---

## What it looks like

A late-diaper complaint, auto-resolved end to end. No human needed — the policy table had an entitlement for it.

![English resolution card](docs/ui-en.png)

When the response comes back in Arabic, the same component mirrors. There is no separate Arabic layout — one `dir` expression flips alignment, icon side and the CTA arrow.

![RTL layout mirroring, LTR beside RTL](docs/rtl-mirroring.png)

A safety-critical case, escalated. Warm formula that the baby already drank: red alert, stop-use instruction, pediatrician redirect, and a human on the way. The drawer at the bottom is in the real UI — it exposes the classification, the policy entitlement and the per-call timings.

![Escalated safety case with internals expanded](docs/ui-escalation.png)

<details>
<summary><strong>Mobile — both languages</strong></summary>

![Mobile, English and Arabic](docs/ui-mobile.png)

</details>

> The screenshots are the real UI rendered from a local build, replaying verbatim model output captured in the committed eval run ([`evals/results/eval-2026-04-29T16-54-36-081Z.json`](evals/results/)) — nothing in them is mocked up by hand. The RTL panel above is a schematic, with placeholder bars standing in for copy.

---

## The Problem

When something goes wrong with an order — a delayed formula delivery at 11pm, a damaged car seat, a wrong size onesie — the customer's path to resolution is usually:

1. Open the app, find Help.
2. Get gated by a chatbot demanding name, language, email, category, and order ID **before** typing the actual issue.
3. Wait for a human who, when they arrive, asks for the order ID again — even though the chatbot already collected it.
4. Re-explain the entire situation. Sometimes in a different language than the one the app is set to.
5. Receive "we'll get back to you within 24 hours."

By that point, the baby has run out of formula, the parent has driven to a 24-hour pharmacy, and a 1-star review is being drafted at 2am.

The chatbot doesn't *read* the message — it *sorts* it. It doesn't extract context — it gates for it. It doesn't understand urgency — it queues by category. The result: humans always start cold, easy cases burn agent time, and urgent cases wait their turn behind them.

## The Solution

Smart Returns Resolver is the **missing triage layer** between the chatbot and the human team. The customer picks their order and describes the problem in their own words. The system:

1. **Reads** the message in whatever language and register they wrote in.
2. **Classifies** it — issue type, product category, urgency tier, emotional state, confidence.
3. **Looks up** the entitlement in a deterministic 6×6 policy matrix (no LLM-decided refunds — those are legal exposure).
4. **Screens** independently for safety risks (warm formula, damaged car seat, chemical contamination near baby food).
5. **Drafts** a structured response — headline, immediate action, what we did, what happens next, talk-to-a-human CTA.
6. **Escalates** on deterministic rules: the policy table and the confidence score decide, not the model's opinion.

End to end it takes **seconds, not a 24-hour queue** — across the eval run, median 9.2s, mean 11.6s, worst case 21.1s, with 12 of 15 cases under 15s. Cases that *can't* be auto-resolved still reach a human with the classification, policy decision and original message already bundled — so nobody starts cold and nobody re-explains.

---

## Key Features

- **Bilingual NLU.** English and Arabic (MSA + dialects), with code-switched input detected as its own `language: "mixed"` class. *Caveat, measured:* mixed input is answered in **English** — the responder has only EN and AR paths, and `mixed` falls through to EN. See [Tradeoffs](#tradeoffs).
- **Deterministic policy engine.** Entitlements (refund, replacement, store credit, alternative offered, escalate-only, honor original price) are looked up from a hand-authored 6×6 matrix in [`lib/data/policy-table.ts`](lib/data/policy-table.ts). The LLM never invents what the customer is owed.
- **Independent safety classifier.** A second, narrow-scoped LLM call biased toward over-escalation. Triggers on temperature/contamination on consumables, any damage on safety-critical items, and out-of-scope medical questions. Never diagnoses, never reassures.
- **Schema-validated everywhere.** Every LLM output is parsed against a [Zod schema](lib/schemas/). Failures are explicit, not silent, and each call gets exactly one retry before the request fails.
- **RTL response rendering.** The resolution card flips to right-to-left when the response is Arabic; the input box stays `dir="auto"` so mixed-script typing behaves.
- **Voice input** via the browser's Web Speech API, hidden entirely when unsupported. *Caveat:* the recognizer is hardcoded to `en-US` — there is no Arabic voice path.
- **15-case eval suite with LLM-as-judge.** Binary rubric across up to 12 dimensions per case, plus an Arabic soft-signal judge for tone and register. Current score: **88.5%** ([`EVALS.md`](EVALS.md)).

---

## How it works

```mermaid
flowchart TD
    A["Customer message<br/>EN / AR / mixed"] --> B["POST /api/resolve"]
    B --> C["LLM call 1 — Classifier<br/>issue_type, product_category,<br/>urgency, language, confidence"]
    C --> D["Policy engine<br/>deterministic 6x6 lookup<br/>NOT AI"]
    D --> E["LLM call 2 — Safety screener<br/>narrow scope, biased to over-escalate"]
    E --> F["LLM call 3 — Responder<br/>EN or AR, structured output"]
    F --> G{"Escalate?<br/>policy.always_escalate<br/>OR policy is null<br/>OR confidence &lt; 0.7"}
    G -->|Yes| H["Bundle classification, policy<br/>and message, hand to human"]
    G -->|No| I["Render resolution card"]
```

The pipeline is orchestrated in [`lib/engine/orchestrator.ts`](lib/engine/orchestrator.ts) and exposed at [`app/api/resolve/route.ts`](app/api/resolve/route.ts). Each LLM call gets its own Zod schema, one retry, and its own latency measurement.

Note what is *not* in that escalation gate: the classifier returns a `needs_human` boolean, and the engine ignores it.

---

## The one decision worth explaining

**The engine collects the model's opinion on escalation and throws it away.**

The classifier's output schema has a `needs_human: boolean`. The obvious design — the one the schema invites — is to use it: the model has just read the message, it knows whether this is hard, let it say so. Almost every LLM-triage tutorial does exactly this.

[`lib/engine/orchestrator.ts`](lib/engine/orchestrator.ts) never reads the field:

```ts
const usedHumanEscalation =
  (policy?.always_escalate ?? false) ||
  policy === null ||
  classification.confidence < 0.7;
```

Three deterministic inputs. `needs_human` is not one of them.

**Why.** It was tried, and it was wrong in both directions. Commit `2ffda5d` removed it after the classifier fired `needs_human: true` on safety-critical cases the policy table already had an automated answer for — a late formula delivery is genuinely urgent, so the model flagged it, but "urgent" and "needs a human" are different questions. The table already said *offer a same-day pharmacy alternative*. Routing that to a queue would have been strictly worse for the customer.

**What it buys, measured.** Across the 15-case eval run, the model's verdict and the engine's decision disagreed on **4 cases — and in both directions**:

| Case | Model said | Table said | Outcome | Effect |
|---|---|---|---|---|
| E1, E5 | `needs_human: true` | `always_escalate: false` | auto-resolved | Model over-escalated; table auto-resolved |
| A1 | `needs_human: true` | `always_escalate: false` | auto-resolved | Model over-escalated on code-switched panic |
| **S2** | `needs_human: false` | `always_escalate: true` | **escalated** | **Model under-escalated a damaged car seat** |

S2 is the one that matters. The message was *"the car seat box has a dent in it, the seat looks fine though."* The classifier believed the reassurance — it returned `urgency_tier: "standard"`, `needs_human: false`, and wrote in its own reasoning field: *"The seat itself appears fine, so it's not urgent."*

The table disagrees, unconditionally. Any `damaged_item` on `infant_safety_critical` is `escalate_only` / `always_escalate: true` / `stop_use_warning: true`, annotated in the source as *"Damaged safety item is forensic. NEVER use. Human-only."* The customer got a stop-use warning and a human — over the model's objection.

![API response showing the override](docs/api-response.png)

**What it costs.** Three real prices, not hypotheticals:

- **The table can only be as good as its author.** 36 hand-written cells are a single point of failure with no test coverage of their own. A wrong cell is wrong for every customer who lands on it, silently and forever.
- **It can auto-resolve straight past the model's instinct.** E1, E5 and A1 went the other way: the classifier asked for a human and the table declined, so they resolved automatically. That is the intended behaviour — the table had a real entitlement ready — but it means a mis-authored cell can quietly auto-resolve a case the model was right to flag, and the model's dissent is discarded without a trace.
- **`unknown` is a cliff, not a slope.** When the classifier can't name a product category, `lookupPolicy` returns `null`, and `null` means escalate. Three of the five failed eval cases (E4, A2, A5) lost points to exactly this cascade. A confidence-weighted policy lookup would degrade gracefully; a hash-map lookup cannot.

The trade is deliberate, and the guarantee it buys is narrow but absolute: **whatever the customer is offered was written by a human into a table that another human can audit.** The model can misroute, and the table can be wrong — but no entitlement is ever invented at inference time. For a system authorizing refunds on infant safety products, that is the property worth paying for.

---

## Architecture

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 | API route + UI in one process |
| Language | TypeScript 5 | Type-safe schema flow end-to-end |
| Validation | Zod 4 | Runtime parse of every LLM output |
| Styling | Tailwind CSS 4 | Hand-written utility classes |
| AI runtime | OpenAI `gpt-4o-mini` | Reliable JSON mode, low latency, ~$0.005/resolution |
| AI eval | OpenAI `gpt-4o-mini` (LLM-as-judge) | Soft-signal scoring of Arabic tone/register |
| Prompt harness | OpenRouter (free tier) | Multi-model bake-off during prompt iteration only |
| Voice input | Web Speech API | Browser-native, no external dependency |
| Deployment | Vercel | Zero-config for Next.js |

```
mumzworld-resolver/
├── app/
│   ├── api/resolve/route.ts      # POST /api/resolve — validates body, calls the orchestrator
│   ├── layout.tsx                # Root layout, fonts, metadata
│   ├── icon.svg                  # Favicon
│   └── page.tsx                  # Customer-facing UI (order picker, textarea, voice, result card)
│
├── lib/
│   ├── engine/
│   │   ├── orchestrator.ts       # The whole pipeline: 3 LLM calls + policy lookup + escalation
│   │   └── test-orchestrator.ts  # Integration test, 3 cases
│   │
│   ├── llm/
│   │   ├── openai.ts             # Runtime client. One 429 retry after 30s
│   │   ├── openrouter.ts         # Bake-off client (harness only, not used at runtime)
│   │   ├── harness.ts            # Multi-model harness with the JSON quote-repair pass
│   │   └── test-*.ts             # Per-prompt bake-off runners
│   │
│   ├── schemas/                  # Zod schemas — every LLM output is validated
│   │   ├── classification.ts     # Issue type, category, urgency, confidence, language
│   │   ├── policy.ts             # Entitlement cell shape
│   │   ├── safety.ts             # Safety alert + severity + disclaimer, cross-field refined
│   │   ├── resolution.ts         # Split: ModelOutput vs full Resolution (see below)
│   │   └── order.ts              # Mock order shape
│   │
│   ├── data/
│   │   ├── mock-orders.ts        # 15 orders across all 6 categories
│   │   ├── mock-order-summary.ts # Lightweight summaries for the UI dropdown
│   │   ├── policy-table.ts       # The 6x6 entitlement matrix
│   │   └── safety-rules.ts       # Reference rules for the safety prompt
│   │
│   └── prompts/                  # System messages + user-message templates
│       ├── classifier.ts         # v2 — tightened against SKU leakage & panic detection
│       ├── responder-en.ts
│       ├── responder-ar.ts       # Dialect register-matching
│       └── safety.ts             # Hard rules + over-escalation bias
│
├── evals/
│   ├── test-cases.json           # 15 cases: 5 easy + 5 adversarial + 3 safety + 2 must-refuse
│   ├── run-evals.ts              # Runner — writes JSON results + tier breakdown
│   ├── scorer.ts                 # Strict binary rubric, up to 12 dimensions per case
│   ├── arabic-judge.ts           # LLM-as-judge for AR tone & register
│   └── results/                  # Committed run artifacts
│
├── docs/                         # README images
├── EVALS.md                      # Full evaluation report with per-case failure analysis
└── .env.example
```

> The engine has no `classifier.ts` / `policy.ts` / `safety.ts` / `responder.ts` — all four stages are inline in `orchestrator.ts`. At ~230 lines it reads top-to-bottom as one pipeline, which is easier to follow than four files that each get called once. Splitting it is the first thing to do if a fifth stage appears.

### Two further design decisions

**The schema split between `ResolutionModelOutput` and `Resolution`.** Early versions had the LLM emit the full `Resolution` object — including `language` and a `meta` block with timing and confidence. Models occasionally typo'd the meta field name (`"used_human_escalation{": false}` was a real failure), and asking the model to echo instrumentation invited drift. The fix wasn't a prompt rewrite — it was an architectural cut. [`lib/schemas/resolution.ts`](lib/schemas/resolution.ts) now defines `ResolutionModelOutputSchema` (content only, what the LLM returns) and `ResolutionSchema` (full output, with `language` and `meta` stamped by the engine).

*Lesson: when a prompt has a hallucination problem on a field, removing the field from the model's responsibility is sometimes cleaner than tightening the prompt.*

**JSON quote-repair at the harness layer, not the prompt layer.** During bake-offs, some open-weight models emitted JSON with mixed quote styles (`"key':value`) while the *content* was correct. Fighting it in the prompt was a losing battle. [`lib/llm/harness.ts`](lib/llm/harness.ts) does a strict parse first, then on failure runs a repair pass and reparses. It is lossy — a repaired payload containing an apostrophe inside a string value will still fail — but that only applies to payloads that already failed a strict parse, and the schemas use enums and short labels rather than free prose. One fix at the harness layer benefits every prompt.

*Lesson: when the model returns correct content with formatting bugs, the fix belongs at the parser, not the prompt.*

---

## Evaluation

![Evaluation results — 88.5%, 69 of 78 dimensions](docs/eval-results.png)

Full report with per-case failure analysis: [`EVALS.md`](EVALS.md).

Strict-mode binary scoring — no partial credit. Single-attempt runs, no retries inside the eval (production retries once; the eval deliberately does not, to avoid inflating the score). Zero pipelines threw end-to-end; every case produced a Zod-valid `Resolution`.

The most important finding wasn't the score. On the two safety cases where the main classifier mis-rated urgency (S2, S3), the *independent* safety classifier caught the issue and routed correctly anyway. That's the architecture earning its keep.

Tone, voice and dialect quality are **not** in the rubric above — they're judged separately by [`evals/arabic-judge.ts`](evals/arabic-judge.ts), which scored **7/12 (58%)** across the three Arabic cases. The pattern: when the input is unambiguously casual the responder matches it well (E3 scored 4/4); when the input is mixed or uncertain it defaults to formal MSA, which the judge reads as stiff (A4 scored 1/4). Neither author reads Arabic natively, so this number is a soft signal, not ground truth.

---

## Getting Started

### Prerequisites

- **Node.js 20+**
- An **OpenAI API key** — `gpt-4o-mini` is the runtime model for all three calls

### Setup

```bash
git clone https://github.com/chinmoypaul8897/mumzworld-resolver.git
cd mumzworld-resolver
npm install

cp .env.example .env.local
# add your OPENAI_API_KEY
```

| Variable | Required | Purpose | Without it |
|---|---|---|---|
| `OPENAI_API_KEY` | **Yes** | Runtime LLM — classifier, safety, responder | `/api/resolve` returns 500; the UI shows its fallback message |
| `OPENROUTER_API_KEY` | No | Multi-model bake-offs in `lib/llm/test-*.ts` only | App, API and eval suite all work normally |

`.env.local` is gitignored and has never been committed.

### Run

```bash
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start
```

### Evaluate

```bash
npx tsx evals/run-evals.ts     # 15 cases → evals/results/eval-<timestamp>.json
npx tsx evals/arabic-judge.ts  # Arabic tone judge
```

A full eval run costs well under $0.20 in tokens.

---

## API

One endpoint. `message` and `order_id` are both required; either missing or blank returns `400`.

```bash
curl -X POST http://localhost:3000/api/resolve \
  -H 'Content-Type: application/json' \
  -d '{"message":"the car seat box has a dent in it, the seat looks fine though","order_id":"M44698"}'
```

The response is the **full `ResolveResult`** — the customer-facing card plus every intermediate decision, so the pipeline is inspectable without re-running it:

```jsonc
{
  "resolution":     { /* headline, immediate_action, what_we_did[], what_happens_next,
                         talk_to_human_cta, safety_warning, language, meta */ },
  "classification": { /* issue_type, product_category, urgency_tier, extracted_facts,
                         confidence, language, language_register, needs_human, reasoning */ },
  "safety":         { /* safety_alert, severity, reason, recommended_action,
                         show_pediatrician_disclaimer */ },
  "policy":         { /* primary_entitlement, secondary_entitlements, sla, always_escalate,
                         triggers_safety_check, stop_use_warning, notes */ },  // null if unresolvable
  "order":          { /* the mock order, or null if the id is unknown */ },
  "meta":           { "classifier_ms": 3386, "safety_ms": 2445,
                      "responder_ms": 2903, "total_ms": 8734 }
}
```

See [the annotated response above](#the-one-decision-worth-explaining) for a real body with values filled in.

The engine is also importable directly, which is how the eval suite drives it:

```ts
import { resolve } from "@/lib/engine/orchestrator";

const result = await resolve({
  message: "the car seat box has a dent in it, the seat looks fine though",
  order_id: "M44698",
});

result.resolution.safety_warning?.severity;      // "critical"
result.resolution.meta.used_human_escalation;    // true
result.classification.needs_human;               // false — collected, not used
```

---

## Tradeoffs

This is a prototype built to prove an architecture. What's genuinely missing, and what I'd do about each:

**No auth or rate limiting on `/api/resolve`.** The endpoint is publicly deployed and each call spends three OpenAI requests against a real key. Anyone can drain the budget with a loop. *Fix:* per-IP token bucket in `middleware.ts` plus a daily spend ceiling checked before the classifier call — roughly 30 lines.

**The "Talk to a person" button does nothing.** It renders, it has a `context_bundle` payload assembled and ready in the response, and it has no `onClick`. The handoff is designed but not wired. *Fix:* POST the bundle to a queue endpoint and swap the button for a confirmation state.

**Code-switched input gets an English answer.** `useArabic` is `classification.language === "ar"`, so `"mixed"` falls through to the English responder. Eval case A1 is code-switched Arabic-English panic and was answered in English. *Fix:* route `mixed` by script majority in the original message, or add a third responder prompt that mirrors the code-switching back.

**Voice input is English-only.** `recognition.lang` is hardcoded `"en-US"`, in a product whose main claim is Arabic parity. *Fix:* a language toggle on the mic button that sets `ar-SA`, defaulting from the selected order's `customer.language_pref`.

**No test suite.** There are integration scripts (`test-orchestrator.ts`, `lib/llm/test-*.ts`) that print output for a human to read, and the eval suite scores model behaviour — but zero assertions run in CI, and the 36 policy cells have no coverage at all. *Fix:* Vitest over `lookupPolicy` and the escalation derivation, which are pure functions and the highest-consequence code in the repo.

**`npm run lint` fails** — 13 errors and 2 warnings: 9 × `no-explicit-any` (mostly the untyped Web Speech API surface), 3 × `react/no-unescaped-entities`, and 1 × `react-hooks/set-state-in-effect` on the voice-support probe. *Fix:* declare the `SpeechRecognition` types properly rather than blanket-disabling the rule, and derive voice support lazily instead of in an effect.

**An unknown `order_id` doesn't escalate.** `getMockOrder` returns `null`, the pipeline proceeds with `"(no order found for this id)"` as context, and escalation is decided purely on the classification. A customer with a bad order number can be auto-resolved against no order at all. *Fix:* treat a null order as a forced escalation.

**Everything is mock data.** `lib/data/mock-orders.ts` is 15 hand-written orders and the policy table is authored by one person with no legal review. *Fix:* for real deployment, swap the data layer for order-system fetchers and get the 36 cells signed off by whoever actually owns returns policy.

**The Arabic quality signal is weak.** Neither author reads Arabic natively; the 58% register score comes from an LLM judging another LLM from the same family. *Fix:* a native reviewer in the loop before any Arabic-facing deployment.

---

## Roadmap

- [ ] **Classifier v3** — fix the `unknown`-cascade behind E4, A2 and A5 (estimated +6pp)
- [ ] **Multi-issue handling** — when a complaint has two issues, classify both rather than dropping one
- [ ] **Conversation continuity** — stateful re-opens when a replacement also fails
- [ ] **CS override dashboard** — every human override becomes prompt-iteration signal
- [ ] **Native Arabic reviewer in the loop** — replace the LLM-as-judge soft signal with ground truth
- [ ] **Real backend integration** — order writes, warehouse coordination, refund authorization
- [ ] **Anti-abuse layer** — pattern detection for refund-gaming

---

## Contributing

1. Open an issue describing the change.
2. Run the eval suite (`npx tsx evals/run-evals.ts`); the score should not regress.
3. If you change a prompt, include the before/after eval numbers in the PR description. (Harness run artifacts under `lib/llm/runs/` are gitignored as local debugging output.)

Commit convention in the existing history: `chunk N.M: <component> v<old> -> v<new> + <reason>`.

---

## Author

**Chinmoy Paul**
Data Science & Artificial Intelligence — IIT Guwahati

I work on applied LLM systems: structured extraction, evaluation harnesses, and the boundary between what a model should decide and what it shouldn't.

[![Portfolio](https://img.shields.io/badge/Portfolio-chinmoypaul.vercel.app-E91E63?style=for-the-badge)](https://chinmoypaul.vercel.app/)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-chinmoy--paul-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/chinmoy-paul)
[![GitHub](https://img.shields.io/badge/GitHub-chinmoypaul8897-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/chinmoypaul8897)
[![Email](https://img.shields.io/badge/Email-hello.chinmoypaul@gmail.com-EA4335?style=for-the-badge&logo=gmail&logoColor=white)](mailto:hello.chinmoypaul@gmail.com)

## License

[MIT](LICENSE) © 2026 Chinmoy Paul.

---

<sub>Built as an exploration of how AI triage can sit between rule-based chatbots and human customer-service teams without replacing either. The product domain — bilingual EN/AR support for infant-care e-commerce — is modelled on publicly documented customer complaints; all order data is fabricated.</sub>
