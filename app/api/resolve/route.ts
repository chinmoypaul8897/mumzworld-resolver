import { NextResponse, type NextRequest } from "next/server";
import { resolve, type ResolveInput } from "@/lib/engine/orchestrator";

/**
 * POST /api/resolve
 *
 * Body: { message: string, order_id: string }
 * Returns: ResolveResult on success, { error: string } on failure.
 *
 * The orchestrator handles internal retries on flaky LLM output.
 * This endpoint catches anything the orchestrator throws and surfaces
 * a graceful fallback so the UI can show "we're escalating to a human."
 */

export const maxDuration = 60; // allow up to 60s for the 3-call chain

interface ApiError {
  error: string;
  detail?: string;
}

export async function POST(req: NextRequest) {
  let body: Partial<ResolveInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { message, order_id } = body;
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json<ApiError>(
      { error: "message is required" },
      { status: 400 }
    );
  }
  if (typeof order_id !== "string" || !order_id.trim()) {
    return NextResponse.json<ApiError>(
      { error: "order_id is required" },
      { status: 400 }
    );
  }

  try {
    const result = await resolve({ message, order_id });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/resolve] orchestrator failed:", err);
    return NextResponse.json<ApiError>(
      {
        error:
          "We hit an issue resolving your request. A team member will get back to you shortly.",
        detail: (err as Error).message,
      },
      { status: 500 }
    );
  }
}