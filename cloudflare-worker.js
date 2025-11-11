// Hardened Cloudflare Worker
export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), { headers: corsHeaders });
    }

    let messages;
    try {
      const body = await request.json();
      messages = body.messages || [];
      if (!Array.isArray(messages)) throw new Error();
    } catch {
      return new Response(JSON.stringify({ error: "Missing or invalid request body" }), { headers: corsHeaders });
    }

    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "OpenAI API key not set" }), { headers: corsHeaders });

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
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

    const result = await openaiRes.json();
    return new Response(JSON.stringify(result), { headers: corsHeaders });
  },
};
