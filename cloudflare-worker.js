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
    let userContext = { name: null, pastQuestions: [] };

    try {
      const body = await request.json();
      messages = body.messages || [];
      userContext = body.userContext || userContext;
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid request body" }),
        { headers: corsHeaders, status: 400 }
      );
    }

    // Product dataset
    const PRODUCTS = [
      { id: "p001", name: "HydraBoost Moisturizing Cream", category: "skincare", description: "Rich, hydrating cream for dry to very dry skin.", url: "https://example.com/hydraboost" },
      { id: "p002", name: "Glow Radiance Serum", category: "skincare", description: "Lightweight serum with vitamin C to brighten skin.", url: "https://example.com/glow-serum" },
      { id: "p003", name: "Volume Lift Mascara", category: "makeup", description: "Buildable formula for dramatic volume.", url: "https://example.com/volume-mascara" },
      { id: "p004", name: "Repair & Shine Shampoo", category: "haircare", description: "Strengthening shampoo with argan oil.", url: "https://example.com/repair-shampoo" },
    ];

    const SYSTEM_PROMPT = `
You are a helpful, friendly L’Oréal product specialist.
Answer only questions about L’Oréal products, routines, and recommendations.
If the user asks outside this scope, politely decline.
Include up to 3 products, a short reason, and next steps.
Do not give medical advice.
Keep responses concise and brand-appropriate.
`;

    const JSON_INSTRUCTION = `Available products (JSON): ${JSON.stringify(PRODUCTS)}
Return ONLY valid JSON like:
{
  "recommendations": [
    {"id":"p001","name":"HydraBoost Moisturizing Cream","category":"skincare","reason":"Short justification"}
  ]
}
Return empty array if no good match.`;

    // If no messages, send greeting
    if (!messages.length) {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "👋 Hi! How can I help you today?" } }],
        }),
        { headers: corsHeaders }
      );
    }

    // Build full messages for OpenAI
    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `User context: ${JSON.stringify(userContext)}` },
      { role: "system", content: JSON_INSTRUCTION },
      ...messages,
    ];

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
