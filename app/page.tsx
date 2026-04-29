"use client";

import { useState, useRef, useEffect } from "react";
import { ORDER_SUMMARIES } from "@/lib/data/mock-order-summary";
import type { ResolveResult } from "@/lib/engine/orchestrator";

type ApiError = { error: string; detail?: string };

export default function Home() {
  const [orderId, setOrderId] = useState(ORDER_SUMMARIES[0]?.order_id ?? "");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    setVoiceSupported(Boolean(SR));
  }, []);

  function startVoice() {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setMessage((prev) => (prev ? prev + " " + transcript : transcript));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function handleResolve() {
    setError(null);
    setResult(null);
    if (!message.trim() || !orderId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), order_id: orderId }),
      });
      if (!res.ok) {
        const errBody = (await res.json()) as ApiError;
        setError(errBody.error || "Something went wrong.");
      } else {
        const data = (await res.json()) as ResolveResult;
        setResult(data);
      }
    } catch (err) {
      setError((err as Error).message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  const isArabic = result?.resolution.language === "ar";

  return (
    <main className="min-h-screen bg-[#FFF8F5] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#E91E63] ring-1 ring-[#FDE7E1]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E91E63]" />
            Mumzworld Care
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1A1A2E] sm:text-4xl">
            Tell us what's wrong.
          </h1>
          <p className="mt-2 text-base text-[#6B6B7B]">
            We'll handle it in seconds, in English or Arabic.
          </p>
        </header>

        <section className="rounded-3xl bg-white p-5 shadow-[0_4px_20px_-4px_rgba(233,30,99,0.12)] ring-1 ring-[#FDE7E1] sm:p-7">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B7B]">
            Your order
          </label>
          <select
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className="mt-2 block w-full rounded-xl border-0 bg-[#FFF8F5] py-3 px-4 text-sm font-medium text-[#1A1A2E] ring-1 ring-[#FDE7E1] transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E91E63]"
          >
            {ORDER_SUMMARIES.map((o) => (
              <option key={o.order_id} value={o.order_id}>
                {o.label}
                {o.is_priority ? " · priority" : ""}
                {o.status !== "delivered" ? ` · ${o.status}` : ""}
              </option>
            ))}
          </select>

          <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-[#6B6B7B]">
            What's wrong?
          </label>
          <div className="mt-2 relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="In your own words — English, Arabic, or both…"
              rows={4}
              dir="auto"
              className="block w-full resize-none rounded-xl border-0 bg-[#FFF8F5] py-3 px-4 text-sm text-[#1A1A2E] placeholder-[#A8A8B5] ring-1 ring-[#FDE7E1] transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E91E63]"
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={listening ? stopVoice : startVoice}
                className={`absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  listening
                    ? "bg-red-500 text-white shadow-md shadow-red-500/30"
                    : "bg-[#E91E63] text-white shadow-md shadow-[#E91E63]/20 hover:bg-[#D81557]"
                }`}
              >
                {listening ? (
                  <>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    recording
                  </>
                ) : (
                  <>🎤 voice</>
                )}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleResolve}
            disabled={loading || !message.trim() || !orderId}
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[#E91E63] px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#E91E63]/30 transition hover:bg-[#D81557] hover:shadow-xl hover:shadow-[#E91E63]/40 disabled:cursor-not-allowed disabled:bg-[#E5C5CD] disabled:shadow-none"
          >
            {loading ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Working on it…
              </>
            ) : (
              "Resolve now"
            )}
          </button>
        </section>

        {error && (
          <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-900 ring-1 ring-red-200">
            {error}
          </div>
        )}

        {result && (
          <section
            dir={isArabic ? "rtl" : "ltr"}
            className="mt-5 rounded-3xl bg-white p-5 shadow-[0_4px_20px_-4px_rgba(233,30,99,0.12)] ring-1 ring-[#FDE7E1] sm:p-7"
          >
            {result.resolution.safety_warning && (
              <div
                className={`mb-5 rounded-2xl p-4 text-sm ring-1 ${
                  result.resolution.safety_warning.severity === "critical"
                    ? "bg-red-50 text-red-900 ring-red-200"
                    : result.resolution.safety_warning.severity === "warning"
                    ? "bg-amber-50 text-amber-900 ring-amber-200"
                    : "bg-blue-50 text-blue-900 ring-blue-200"
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      result.resolution.safety_warning.severity === "critical"
                        ? "bg-red-600 animate-pulse"
                        : result.resolution.safety_warning.severity === "warning"
                        ? "bg-amber-500"
                        : "bg-blue-500"
                    }`}
                  />
                  {result.resolution.safety_warning.severity === "critical"
                    ? isArabic
                      ? "تنبيه حرج"
                      : "Safety alert"
                    : result.resolution.safety_warning.severity === "warning"
                    ? isArabic
                      ? "تحذير"
                      : "Warning"
                    : "Info"}
                </div>
                <div className="mt-2 font-medium leading-relaxed">
                  {result.resolution.safety_warning.message}
                </div>
              </div>
            )}

            <h2 className="text-xl font-bold leading-tight text-[#1A1A2E] sm:text-2xl">
              {result.resolution.headline}
            </h2>

            {result.resolution.immediate_action && (
              <div className="mt-4 rounded-2xl bg-[#FFF8F5] p-4 ring-1 ring-[#FDE7E1]">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#E91E63]">
                  {isArabic ? "افعلي هذا الآن" : "Do this now"}
                </div>
                <p className="mt-1.5 text-sm font-medium leading-relaxed text-[#1A1A2E]">
                  {result.resolution.immediate_action}
                </p>
              </div>
            )}

            {result.resolution.what_we_did.length > 0 && (
              <div className="mt-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#6B6B7B]">
                  {isArabic ? "ما قمنا به" : "What we did"}
                </div>
                <ul className="mt-2.5 space-y-2.5">
                  {result.resolution.what_we_did.map((item, i) => (
                    <li
                      key={i}
                      className="flex gap-3 rounded-2xl bg-[#F0FDF4] p-3.5 ring-1 ring-[#BBF7D0]"
                    >
                      <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#10B981] text-xs text-white">
                        ✓
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#1A1A2E]">
                          {item.label}
                        </div>
                        <div className="mt-0.5 text-sm text-[#4A4A5C]">
                          {item.detail}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#6B6B7B]">
                {isArabic ? "ماذا يحدث بعد ذلك" : "What happens next"}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-[#4A4A5C]">
                {result.resolution.what_happens_next}
              </p>
            </div>

            <button
              type="button"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#1A1A2E] bg-white px-5 py-3 text-sm font-semibold text-[#1A1A2E] transition hover:bg-[#1A1A2E] hover:text-white"
            >
              {result.resolution.talk_to_human_cta.label} →
            </button>

            <details className="mt-5 text-xs text-[#6B6B7B]">
              <summary className="cursor-pointer font-medium hover:text-[#1A1A2E]">
                Resolved in {Math.round(result.meta.total_ms / 100) / 10}s ·
                confidence {Math.round(result.resolution.meta.classification_confidence * 100)}%
                {result.resolution.meta.used_human_escalation
                  ? " · routed to human"
                  : ""}
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-[#FFF8F5] p-3 ring-1 ring-[#FDE7E1]">
                {JSON.stringify(
                  {
                    issue_type: result.classification.issue_type,
                    product_category: result.classification.product_category,
                    urgency_tier: result.classification.urgency_tier,
                    language: result.classification.language,
                    safety_alert: result.safety.safety_alert,
                    policy_entitlement: result.policy?.primary_entitlement ?? null,
                    timing_ms: result.meta,
                  },
                  null,
                  2
                )}
              </pre>
            </details>
          </section>
        )}

        <footer className="mt-8 text-center text-xs text-[#A8A8B5]">
          Built for moms. Made by Mumzworld AI.
        </footer>
      </div>
    </main>
  );
}