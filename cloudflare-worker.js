// Hardened Cloudflare Worker
export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Only POST is allowed
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. Use POST." }),
        { status: 405, headers: corsHeaders }
      );
    }

    // Parse JSON body
    let body;
    try {
      body = await request.json();
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid JSON request body" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Must contain messages
    const messages = body.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Request body must have a non-empty 'messages' array" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Forward to OpenAI
    const apiKey = env.OPENAI_API_KEY;
    const apiUrl = "https://api.openai.com/v1/chat/completions";

    try {
      const openaiRes = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 300,
        }),
      });

      const data = await openaiRes.json();

      return new Response(JSON.stringify(data), { headers: corsHeaders });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "OpenAI request failed", details: err.message }),
        { status: 500, headers: corsHeaders }
      );
    }
  },
};


