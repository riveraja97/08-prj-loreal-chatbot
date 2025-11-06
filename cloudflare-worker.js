// Cloudflare Worker script

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const apiKey = env.OPENAI_API_KEY; // Make sure to name your secret OPENAI_API_KEY in the Cloudflare Workers dashboard
    const apiUrl = "https://api.openai.com/v1/chat/completions";
    const userInput = await request.json();

    // Validate incoming body contains a messages array
    if (!userInput || !Array.isArray(userInput.messages)) {
      return new Response(
        JSON.stringify({
          error: "Invalid request: expected { messages: [...] } in JSON body",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const requestBody = {
      model: "gpt-4o",
      messages: userInput.messages,
      max_completion_tokens: 300,
    };

    let response;
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "Upstream request failed",
          details: String(err),
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    const data = await response.json();

    // Normalize assistant content: try to parse JSON embedded in the assistant message
    try {
      const assistantContent = data?.choices?.[0]?.message?.content;
      if (assistantContent && typeof assistantContent === "string") {
        const first = Math.min(
          ...[
            assistantContent.indexOf("{"),
            assistantContent.indexOf("["),
          ].filter((i) => i >= 0)
        );
        const last = Math.max(
          assistantContent.lastIndexOf("}"),
          assistantContent.lastIndexOf("]")
        );
        if (first !== Infinity && last !== -1 && last > first) {
          const candidate = assistantContent.slice(first, last + 1);
          try {
            const parsed = JSON.parse(candidate);
            // attach parsed object so clients don't need to attempt extraction
            if (!data.choices) data.choices = [];
            if (!data.choices[0].message) data.choices[0].message = {};
            data.choices[0].message.parsed = parsed;
          } catch (e) {
            // ignore parse errors — leave original content intact
          }
        }
      }
    } catch (e) {
      // ignore normalization errors — still return the raw OpenAI response
      console.warn("Normalization error", e);
    }

    return new Response(JSON.stringify(data), { headers: corsHeaders });
  },
};
