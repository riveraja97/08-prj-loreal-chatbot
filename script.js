/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

// Configuration
const WORKER_URL = "https://loreal-chatbot.riveraja.workers.dev"; // workers.dev endpoint
const SYSTEM_PROMPT =
  "You are a helpful, friendly L’Oréal product specialist. Answer only questions about L’Oréal products, routines, and product recommendations. If a user asks something outside this scope, politely decline and offer to help with product information or routines instead. Use the provided product dataset when making recommendations. When recommending products, include up to 3 items, a short reason for each, and practical next steps for using them (e.g., order of application in a routine). Ask one brief clarifying question if the user’s request lacks key details (skin type, hair concern, age, desired outcome). Do not give medical diagnoses or clinical advice; if the user asks for medical guidance, recommend they consult a healthcare professional. Keep responses concise, factual, and brand-appropriate.";
const STORAGE_KEY = "loreal_chat_history";
const CONTEXT_KEY = "loreal_chat_context";
const MAX_HISTORY = 20; 

// Sample products
const PRODUCTS = [
  { id: "p001", name: "HydraBoost Moisturizing Cream", category: "skincare", description: "Rich, hydrating cream for dry to very dry skin. Contains hyaluronic acid and glycerin.", url: "https://example.com/hydraboost" },
  { id: "p002", name: "Glow Radiance Serum", category: "skincare", description: "Lightweight serum with vitamin C to brighten and even skin tone.", url: "https://example.com/glow-serum" },
  { id: "p003", name: "Volume Lift Mascara", category: "makeup", description: "Buildable formula for dramatic volume without clumping.", url: "https://example.com/volume-mascara" },
  { id: "p004", name: "Repair & Shine Shampoo", category: "haircare", description: "Strengthening shampoo for damaged hair with argan oil.", url: "https://example.com/repair-shampoo" },
];

// Prompt instructions for JSON recommendations
const JSON_INSTRUCTION = `Available products (JSON): ${JSON.stringify(PRODUCTS)}
When recommending, choose up to 3 products from the list above that best match the user's request. Return ONLY valid JSON (no surrounding explanation) with this shape:
{
  "recommendations": [
    {"id":"p001","name":"HydraBoost Moisturizing Cream","category":"skincare","reason":"Short justification for why this fits"}
  ]
}
If you cannot find a good match, return an empty array for "recommendations".`;

// Conversation and user context
let conversation = [];
let userContext = { name: null, pastQuestions: [] };

// Initialize from localStorage
function loadConversation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) conversation = parsed.slice(-MAX_HISTORY);
    }
  } catch (e) { console.warn("Failed to load conversation:", e); }
}

function loadContext() {
  try {
    const raw = localStorage.getItem(CONTEXT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") userContext = parsed;
      userContext.pastQuestions = Array.isArray(userContext.pastQuestions)
        ? userContext.pastQuestions.slice(-MAX_HISTORY)
        : [];
    }
  } catch (e) { console.warn("Failed to load context:", e); }
}

function saveConversation() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(conversation.slice(-MAX_HISTORY))); updateClearButtonState(); } 
  catch (e) { console.warn("Failed to save conversation:", e); }
}

function saveContext() {
  try { localStorage.setItem(CONTEXT_KEY, JSON.stringify(userContext)); } 
  catch (e) { console.warn("Failed to save context:", e); }
}

// Append message to chat window
function appendMessage(role, text, isHtml = false, timestampISO = null) {
  const el = document.createElement("div");
  el.className = `message ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = isHtml ? text : escapeHtml(text);

  const ts = document.createElement("div");
  ts.className = "timestamp";
  const now = timestampISO ? new Date(timestampISO) : new Date();
  ts.textContent = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

  el.appendChild(bubble);
  el.appendChild(ts);
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return el;
}

// Escape HTML
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

// Initial greeting
function showInitialGreeting() {
  if (conversation.length === 0) {
    appendMessage("assistant", "👋 Hi! How can I help you today?");
  }
}

// Clear button
function updateClearButtonState() {
  if (!clearBtn) return;
  clearBtn.disabled = conversation.length === 0;
}

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    conversation = [];
    localStorage.removeItem(STORAGE_KEY);
    chatWindow.innerHTML = "";
    userInput.value = "";
    userInput.disabled = false;
    sendBtn.disabled = false;
    showInitialGreeting();
    updateClearButtonState();
  });
}

// Load stored data
loadConversation();
loadContext();
renderConversation();
showInitialGreeting();

// Render conversation
function renderConversation() {
  chatWindow.innerHTML = "";
  conversation.forEach((m) => appendMessage(m.role, m.content, false, m.createdAt));
}

// Send message to Cloudflare Worker
async function sendMessageToWorker(messages) {
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`Worker returned ${res.status}`);
  const data = await res.json();
  return data;
}

// Handle form submit
if (chatForm) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;

    // Append user message
    const userCreatedAt = new Date().toISOString();
    conversation.push({ role: "user", content: text, createdAt: userCreatedAt });
    appendMessage("user", text, false, userCreatedAt);
    saveConversation();
    userInput.disabled = true;
    sendBtn.disabled = true;

    // Show loading
    const loadingEl = appendMessage("assistant", "Thinking...");

    try {
      const messagesToSend = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: `User context: ${JSON.stringify(userContext)}` },
        { role: "system", content: JSON_INSTRUCTION },
        ...conversation.slice(-MAX_HISTORY).map(m => ({ role: m.role, content: m.content })),
      ];

      const data = await sendMessageToWorker(messagesToSend);
      const content = data?.choices?.[0]?.message?.content || "Sorry — no response returned.";

      // Replace loading with response
      if (loadingEl) {
        const bubble = loadingEl.querySelector(".bubble");
        bubble.textContent = content;
      }

      // Save assistant message
      const assistantCreatedAt = new Date().toISOString();
      conversation.push({ role: "assistant", content, createdAt: assistantCreatedAt });
      saveConversation();

    } catch (err) {
      if (loadingEl) loadingEl.querySelector(".bubble").textContent = "Error fetching response.";
      console.error(err);
    } finally {
      userInput.disabled = false;
      sendBtn.disabled = false;
      userInput.value = "";
      userInput.focus();
    }
  });
}
