/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

// Configuration
const WORKER_URL = "https://loreal-chatbot-api.riveraja.workers.dev/"; // workers.dev endpoint
const SYSTEM_PROMPT =
  "You are a helpful, friendly L’Oréal product specialist. Answer only questions about L’Oréal products, routines, and product recommendations. If a user asks something outside this scope, politely decline and offer to help with product information or routines instead. Use the provided product dataset when making recommendations. When recommending products, include up to 3 items, a short reason for each, and practical next steps for using them (e.g., order of application in a routine). Ask one brief clarifying question if the user’s request lacks key details (skin type, hair concern, age, desired outcome). Do not give medical diagnoses or clinical advice; if the user asks for medical guidance, recommend they consult a healthcare professional. Keep responses concise, factual, and brand-appropriate.";
const STORAGE_KEY = "loreal_chat_history";
const MAX_HISTORY = 20; // keep recent messages to limit token use
// Optional direct OpenAI calling (development only). Keep false for production and use WORKER_URL.
const USE_DIRECT_OPENAI = false; // set true to call OpenAI directly from the browser (insecure)
const DIRECT_OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// Informational log: which endpoint the client will call
(function logClientEndpoint() {
  try {
    if (USE_DIRECT_OPENAI) {
      const apiKeyAvailable =
        typeof OPENAI_API_KEY !== "undefined" ||
        (typeof secrets !== "undefined" && secrets.OPENAI_API_KEY);
      console.info(
        "Chat client configured to call OpenAI directly:",
        DIRECT_OPENAI_URL
      );
      if (!apiKeyAvailable) {
        console.warn(
          "Direct OpenAI mode is enabled but no API key was found.\nCreate a local secrets.js with OPENAI_API_KEY or disable USE_DIRECT_OPENAI in script.js before deploying."
        );
      }
    } else {
      console.info(
        "Chat client configured to use Cloudflare Worker:",
        WORKER_URL
      );
      console.info(
        "Ensure the worker forwards the incoming { messages } array to OpenAI and returns the OpenAI JSON (choices[0].message.content)."
      );
    }
  } catch (e) {
    console.warn("Could not determine client endpoint configuration:", e);
  }
})();

// Small sample product dataset (client-side only — Cloudflare worker / assistant can use these to make recommendations)
const PRODUCTS = [
  {
    id: "p001",
    name: "HydraBoost Moisturizing Cream",
    category: "skincare",
    description:
      "Rich, hydrating cream for dry to very dry skin. Contains hyaluronic acid and glycerin.",
    url: "https://example.com/hydraboost",
  },
  {
    id: "p002",
    name: "Glow Radiance Serum",
    category: "skincare",
    description:
      "Lightweight serum with vitamin C to brighten and even skin tone.",
    url: "https://example.com/glow-serum",
  },
  {
    id: "p003",
    name: "Volume Lift Mascara",
    category: "makeup",
    description: "Buildable formula for dramatic volume without clumping.",
    url: "https://example.com/volume-mascara",
  },
  {
    id: "p004",
    name: "Repair & Shine Shampoo",
    category: "haircare",
    description: "Strengthening shampoo for damaged hair with argan oil.",
    url: "https://example.com/repair-shampoo",
  },
];

// Prompt instructions to request structured JSON output from the assistant
const JSON_INSTRUCTION = `Available products (JSON): ${JSON.stringify(
  PRODUCTS
)}\n\nWhen recommending, choose up to 3 products from the list above that best match the user's request. Return ONLY valid JSON (no surrounding explanation) with this shape:
{
  "recommendations": [
    {"id":"p001","name":"HydraBoost Moisturizing Cream","category":"skincare","reason":"Short justification for why this fits"}
  ]
}
If you cannot find a good match, return an empty array for "recommendations".`;

// Conversation holds prior user/assistant messages (no system prompt)
let conversation = [];

// Initialize UI from localStorage (if present)
function loadConversation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      conversation = parsed.slice(-MAX_HISTORY);
    }
  } catch (e) {
    console.warn("Failed to load conversation from localStorage", e);
  }
}

function saveConversation() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(conversation.slice(-MAX_HISTORY))
    );
    updateClearButtonState();
  } catch (e) {
    console.warn("Failed to save conversation to localStorage", e);
  }
}

function appendMessageToDOM(role, text, isHtml = false, timestampISO = null) {
  const el = document.createElement("div");
  el.className = `message ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (isHtml) bubble.innerHTML = text;
  else bubble.textContent = text;

  const ts = document.createElement("div");
  ts.className = "timestamp";
  let now = timestampISO ? new Date(timestampISO) : new Date();
  if (isNaN(now.getTime())) now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  ts.textContent = `${hh}:${mm}`;

  el.appendChild(bubble);
  el.appendChild(ts);
  chatWindow.appendChild(el);
  scrollChatToBottom();
  return el; // caller can update or replace bubble content if needed
}

function renderConversation() {
  chatWindow.innerHTML = "";
  if (conversation.length === 0) {
    // initial friendly greeting when there's no history
    chatWindow.textContent = "👋 Hello! How can I help you today?";
    updateClearButtonState();
    return;
  }
  conversation.forEach((m) =>
    appendMessageToDOM(m.role, m.content, false, m.createdAt)
  );
  updateClearButtonState();
}

function scrollChatToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Utility: try to extract JSON substring from assistant content then parse
function tryExtractJSON(text) {
  if (!text || typeof text !== "string") return null;
  // Find first { or [ and last } or ]
  const first = Math.min(
    ...[text.indexOf("{"), text.indexOf("[")].filter((i) => i >= 0)
  );
  const last = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (first === Infinity || last === -1 || last <= first) return null;
  const candidate = text.slice(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch (e) {
    // Could not parse
    return null;
  }
}

// Utility: simple escape for innerHTML insertion
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Load saved messages and render
loadConversation();
renderConversation();

// Manage clear button state
function updateClearButtonState() {
  if (!clearBtn) return;
  clearBtn.disabled = conversation.length === 0;
}

// Clear conversation handler
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    conversation = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn("Failed to remove conversation from localStorage", e);
    }
    chatWindow.innerHTML = "👋 Hello! How can I help you today?";
    userInput.value = "";
    userInput.focus();
    updateClearButtonState();
  });
}

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = userInput.value.trim();
  if (!text) return;

  // Disable input & button to prevent duplicates
  userInput.disabled = true;
  sendBtn.disabled = true;

  // Append user's message to conversation and DOM
  conversation.push({ role: "user", content: text });
  saveConversation();
  appendMessageToDOM("user", text);

  // Show loading state (assistant)
  const loadingEl = appendMessageToDOM("assistant", "Thinking...");

  // Build messages array: system prompt + conversation history
  const messagesToSend = [
    { role: "system", content: SYSTEM_PROMPT },
    // Instruct assistant to return structured JSON using the small product dataset below
    { role: "system", content: JSON_INSTRUCTION },
    ...conversation.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    let res;
    if (USE_DIRECT_OPENAI) {
      // Try to find API key either as global OPENAI_API_KEY or in a `secrets` object (secrets.js)
      const apiKey =
        typeof OPENAI_API_KEY !== "undefined"
          ? OPENAI_API_KEY
          : typeof secrets !== "undefined" && secrets.OPENAI_API_KEY
          ? secrets.OPENAI_API_KEY
          : null;
      if (!apiKey) {
        throw new Error(
          "OPENAI_API_KEY not found. To call OpenAI directly, set OPENAI_API_KEY (in secrets.js or global)."
        );
      }

      res = await fetch(DIRECT_OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: messagesToSend,
          max_tokens: 300,
        }),
      });
    } else {
      res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesToSend }),
      });
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      // update loading element to show error
      if (loadingEl) {
        const bubble = loadingEl.querySelector(".bubble");
        bubble.textContent = "Sorry — no response returned from the API.";
      }
      console.warn(
        "Unexpected API response shape: expected OpenAI Chat Completions JSON.\nMake sure your Cloudflare Worker forwards the incoming { messages } array to OpenAI and returns the OpenAI JSON so the client can read data.choices[0].message.content. Response received:",
        data
      );
      console.error("Unexpected API response:", data);
    } else {
      // Try to parse JSON recommendations from the assistant response
      const parsed = tryExtractJSON(content);
      if (parsed && Array.isArray(parsed.recommendations)) {
        // Replace loading with a short assistant heading
        if (loadingEl) {
          loadingEl.className = "message assistant";
          const bubble = loadingEl.querySelector(".bubble");
          bubble.textContent = "Here are some recommendations:";
        }

        // Render each recommended product with reason
        parsed.recommendations.forEach((rec) => {
          const product = PRODUCTS.find((p) => p.id === rec.id) || rec;
          const name = product.name || rec.name || rec.id;
          const url = product.url || rec.url || "#";
          const reason = rec.reason || "";
          const html = `<strong><a href="${url}" target="_blank" rel="noopener">${escapeHtml(
            name
          )}</a></strong><div class="rec-reason">${escapeHtml(reason)}</div>`;
          appendMessageToDOM("assistant", html, true).classList.add(
            "recommendation"
          );
        });

        // Save assistant message (raw content) to conversation + persist
        conversation.push({ role: "assistant", content });
        saveConversation();
      } else {
        // Fallback: show assistant free-text reply by updating loading element
        if (loadingEl) {
          const bubble = loadingEl.querySelector(".bubble");
          bubble.textContent = content;
        }

        // Save assistant message to conversation + persist
        conversation.push({ role: "assistant", content });
        saveConversation();
      }
    }
  } catch (err) {
    if (loadingEl) {
      const bubble = loadingEl.querySelector(".bubble");
      bubble.textContent = "Error fetching response.";
      loadingEl.classList.add("error");
    }
    console.error("Fetch error:", err);
  } finally {
    // Re-enable input and button
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.value = "";
    userInput.focus();
  }
});
