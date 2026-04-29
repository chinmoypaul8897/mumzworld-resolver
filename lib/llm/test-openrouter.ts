import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

/**
 * Sanity check: hit OpenRouter once with a trivial prompt
 * and print the result. Verifies the API key works,
 * the network is reachable, and JSON responses parse.
 *
 * Run with: npx tsx lib/llm/test-openrouter.ts
 */
async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("ERROR: OPENROUTER_API_KEY not found in .env.local");
    process.exit(1);
  }

  console.log("Key loaded, length:", apiKey.length);
  console.log("Sending request to OpenRouter...");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/chinmoypaul8897/mumzworld-resolver",
      "X-Title": "Mumzworld Resolver Sanity Check",
    },
    body: JSON.stringify({
    model: "openai/gpt-oss-120b:free",        
    messages: [
        {
          role: "user",
          content: "Reply with exactly the JSON object {\"ok\": true} and nothing else.",
        },
      ],
      max_tokens: 30,
    }),
  });

  if (!response.ok) {
    console.error("HTTP error:", response.status, response.statusText);
    const errText = await response.text();
    console.error("Body:", errText);
    process.exit(1);
  }

  const data = await response.json();
  console.log("Status: OK");
  console.log("Model used:", data.model);
  console.log("Response content:", data.choices?.[0]?.message?.content);
  console.log("Tokens used:", data.usage);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});