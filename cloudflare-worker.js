// Hardened Cloudflare Worker
export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    // Handle preflight OPTIONS request
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Only POST requests allowed
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
        headers: corsHeaders,
        status: 405
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Missing request body" }), {
        headers: corsHeaders,
        status: 400
      });
    }

    const messages = body.messages;
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages must be an array" }), {
        headers: corsHeaders,
        status: 400
      });
    }

    const apiKey = env.OPENAI_API_KEY;

    try {
      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: messages,
          max_tokens: 300
        })
      });

      const data = await openaiResponse.json();
      return new Response(JSON.stringify(data), { headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({ error: "OpenAI API error", details: err.message }), {
        headers: corsHeaders,
        status: 500
      });
    }
  }
};
