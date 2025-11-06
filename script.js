/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");

// Configuration
const WORKER_URL = "https://loreal-chatbot-api.riveraja.workers.dev"; // workers.dev endpoint
const SYSTEM_PROMPT =
  "You are a helpful L'Oréal product assistant. Provide friendly, helpful beauty product recommendations and routines.";
const STORAGE_KEY = "loreal_chat_history";
const MAX_HISTORY = 20; // keep recent messages to limit token use

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
  } catch (e) {
    console.warn("Failed to save conversation to localStorage", e);
  }
}

function appendMessageToDOM(role, text) {
  const el = document.createElement("div");
  el.className = `message ${role}`;
  el.textContent = `${role === "user" ? "You" : "Assistant"}: ${text}`;
  chatWindow.appendChild(el);
  scrollChatToBottom();
}

function renderConversation() {
  chatWindow.innerHTML = "";
  if (conversation.length === 0) {
    // initial friendly greeting when there's no history
    chatWindow.textContent = "👋 Hello! How can I help you today?";
    return;
  }
  conversation.forEach((m) => appendMessageToDOM(m.role, m.content));
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

  // Show loading state
  const loadingMsg = document.createElement("div");
  loadingMsg.className = "message bot loading";
  loadingMsg.textContent = "Thinking...";
  chatWindow.appendChild(loadingMsg);
  scrollChatToBottom();

  // Build messages array: system prompt + conversation history
  const messagesToSend = [
    { role: "system", content: SYSTEM_PROMPT },
    // Instruct assistant to return structured JSON using the small product dataset below
    { role: "system", content: JSON_INSTRUCTION },
    ...conversation.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messagesToSend }),
    });

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      loadingMsg.textContent = "Sorry — no response returned from the API.";
      console.error("Unexpected API response:", data);
    } else {
      // Try to parse JSON recommendations from the assistant response
      const parsed = tryExtractJSON(content);
      if (parsed && Array.isArray(parsed.recommendations)) {
        // Replace loading with a short assistant heading
        loadingMsg.className = "message bot";
        loadingMsg.textContent = "Assistant: Here are some recommendations:";

        // Render each recommended product with reason
        parsed.recommendations.forEach((rec) => {
          const product = PRODUCTS.find((p) => p.id === rec.id) || rec;
          const el = document.createElement("div");
          el.className = "message bot recommendation";
          // show name as link when url available
          const name = product.name || rec.name || rec.id;
          const url = product.url || rec.url || "#";
          const reason = rec.reason || "";
          el.innerHTML = `<strong><a href=\"${url}\" target=\"_blank\" rel=\"noopener\">${escapeHtml(
            name
          )}</a></strong> — ${escapeHtml(reason)}`;
          chatWindow.appendChild(el);
        });

        // Save assistant message (raw content) to conversation + persist
        conversation.push({ role: "assistant", content });
        saveConversation();
      } else {
        // Fallback: show assistant free-text reply
        loadingMsg.className = "message bot";
        loadingMsg.textContent = `Assistant: ${content}`;

        // Save assistant message to conversation + persist
        conversation.push({ role: "assistant", content });
        saveConversation();
      }
    }
  } catch (err) {
    loadingMsg.textContent = "Error fetching response.";
    loadingMsg.className = "message bot error";
    console.error("Fetch error:", err);
  } finally {
    // Re-enable input and button
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.value = "";
    userInput.focus();
  }
});
