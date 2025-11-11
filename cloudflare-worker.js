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

    // Sample product dataset
    const PRODUCTS = [
      { id: "p001", name: "HydraBoost Moisturizing Cream", category: "skincare", description: "Rich, hydrating cream for dry to very dry skin.", url: "https://example.com/hydraboost" },
      { id: "p002", name: "Glow Radiance Serum", category: "skincare", description: "Lightweight serum with vitamin C to brighten skin.", url: "https://example.com/glow-serum" },
      { id: "p003", name: "Volume Lift Mascara", category: "makeup", description: "Buildable formula for dramatic volume.", url: "https://example.com/volume-mascara" },
      { id: "p004", name: "Repair & Shine Shampoo", category: "haircare", description: "Strengthening shampoo with argan oil.", url: "https://example.com/repair-shampoo" },
    ];

    const JSON_INSTRUCTION = `Available products (JSON): ${JSON.stringify(PRODUCTS)}
When recommending, choose up to 3 products from the list above that best match the user's request. Return ONLY valid JSON (no surrounding explanation) with this shape:
{
  "recommendations": [
    {"id":"p001","name":"HydraBoost Moisturizing Cream","category":"skincare","reason":"Short justification for why this fits"}
  ]
}
If no good match, return empty array for "recommendations".`;

    // If no messages, send greeting
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

    // Add system prompts to messages
    const fullMessages = [
      { role: "system", content: "You are a helpful, friendly L’Oréal product specialist. Only answer product questions and recommendations." },
      { role: "system", content: JSON_INSTRUCTION },
      ...messages,
    ];

    // Call OpenAI API
    const apiKey = env.OPENAI_API_KEY;
    const apiUrl = "https://api.openai.com/v1/chat/completions";

    try {
      const openaiRes = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: fullMessages,
          max_tokens: 300,
        }),
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
