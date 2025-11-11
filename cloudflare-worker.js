// Hardened Cloudflare Worker
export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    // Handle preflight OPTIONS request
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), { headers: corsHeaders, status: 405 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ error: "Missing request body" }), { headers: corsHeaders, status: 400 });
    }

    const messages = body.messages || [];
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages array" }), { headers: corsHeaders, status: 400 });
    }

    const apiKey = env.OPENAI_API_KEY;
    const apiUrl = "https://api.openai.com/v1/chat/completions";

    // Call OpenAI API
    try {
      const openaiResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 300
        })
      });

      const result = await openaiResponse.json();

      return new Response(JSON.stringify(result), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Failed to fetch from OpenAI", details: err.message }), { headers: corsHeaders, status: 500 });
    }
  }
};
