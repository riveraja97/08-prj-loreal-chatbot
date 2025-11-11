// Hardened Cloudflare Worker
export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Protect: require POST with JSON body { messages: [...] }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Only POST allowed" }), {
        status: 405,
        headers: corsHeaders,
      });
    }

    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "Server misconfigured: OPENAI_API_KEY not found. Please set the secret and redeploy.",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const messages = payload?.messages;
    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'messages' array" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const apiUrl = "https://api.openai.com/v1/chat/completions";
    const requestBody = {
      model: env.MODEL_NAME || "gpt-4o-mini",
      messages,
      max_tokens: 800,
    };

    try {
      const resp = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        // upstream returned non-JSON (rare) — forward text for debugging
        return new Response(
          JSON.stringify({ error: "Upstream non-JSON", body: text }),
          {
            status: resp.status || 502,
            headers: corsHeaders,
          }
        );
      }

      if (!resp.ok) {
        // forward upstream error JSON/body to the client so UI can show it
        return new Response(JSON.stringify({ error: data }), {
          status: resp.status,
          headers: corsHeaders,
        });
      }

      // Try to extract embedded JSON from assistant text and attach it to the
      // message as `parsed` to make client-side handling simpler.
      try {
        const choices = data.choices;
        if (Array.isArray(choices)) {
          for (const choice of choices) {
            const msg = choice.message || (choice.delta ? choice.delta : null);
            if (msg && typeof msg.content === "string") {
              // Find first { or [ and last matching bracket, then attempt parse
              const content = msg.content;
              const firstIdx = Math.min(
                ...[content.indexOf("{"), content.indexOf("[")].filter(
                  (i) => i >= 0
                )
              );
              const lastIdx = Math.max(
                content.lastIndexOf("}"),
                content.lastIndexOf("]")
              );
              if (firstIdx !== Infinity && lastIdx > firstIdx) {
                const candidate = content.slice(firstIdx, lastIdx + 1);
                try {
                  const parsed = JSON.parse(candidate);
                  // attach parsed result to the message for the client to use
                  msg.parsed = parsed;
                } catch (e) {
                  // ignore parse errors
                }
              }
            }
          }
        }
      } catch (e) {
        // don't block returning the original data on parsing errors
        console.warn("Failed to normalize assistant JSON:", e);
      }

      // Normal: return the (possibly augmented) OpenAI JSON unchanged to the client
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: corsHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 502,
        headers: corsHeaders,
      });
    }
  },
};
