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

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. Use POST." }),
        { headers: corsHeaders, status: 405 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Missing or invalid request body" }),
        { headers: corsHeaders, status: 400 }
      );
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const userContext = body.userContext || {};

    // If conversation is empty, send initial greeting
    if (messages.length === 0) {
      const name = userContext.name || "";
      messages.push({
        role: "system",
        content: `Hi ${name}! 👋 How can I help you today?`,
      });
    }

    const apiKey = env.OPENAI_API_KEY;
    const apiUrl = "https://api.openai.com/v1/chat/completions";

    try {
      const response = await fetch(apiUrl, {
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

      const result = await response.json();
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "OpenAI request failed", details: err.message }),
        { headers: corsHeaders, status: 500 }
      );
    }
  },
};
