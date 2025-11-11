// Hardened Cloudflare Worker
export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST requests
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. Use POST." }),
        { headers: corsHeaders, status: 405 }
      );
    }

    let messages = [];
    try {
      const body = await request.json();
      messages = body.messages || [];
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid request body" }),
        { headers: corsHeaders, status: 400 }
      );
    }

    // If no messages, send initial greeting
    if (!messages.length) {
      return new Response(
        JSON.stringify({
          choices: [
            { message: { content: "👋 Hi! How can I help you today?" } },
          ],
        }),
        { headers: corsHeaders }
      );
    }

    // Call OpenAI API
    const apiKey = env.OPENAI_API_KEY;
    const apiUrl = "https://api.openai.com/v1/chat/completions";

    const requestBody = {
      model: "gpt-4o-mini",
      messages,
      max_tokens: 300,
    };

    try {
      const openaiRes = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const result = await openaiRes.json();

      return new Response(JSON.stringify(result), { headers: corsHeaders });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "OpenAI API request failed", details: err }),
        { headers: corsHeaders, status: 500 }
      );
    }
  },
};
