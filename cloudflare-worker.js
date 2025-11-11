// Hardened Cloudflare Worker
export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const apiKey = env.OPENAI_API_KEY;
    const apiUrl = "https://api.openai.com/v1/chat/completions";
    const { messages } = await request.json();

    const requestBody = {
      model: "gpt-4o-mini",  // you can keep gpt-4o if your account has access
      messages,
      max_tokens: 300        // ✅ FIXED KEY NAME
    };

    const openaiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    const result = await openaiResponse.json();

    return new Response(JSON.stringify(result), { headers: corsHeaders });
  }
};
