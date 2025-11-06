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
const CONTEXT_KEY = "loreal_chat_context";
const MAX_HISTORY = 20; // keep recent messages to limit token use
// Client always uses the Cloudflare Worker. Keep API keys server-side.
// Informational log: which endpoint the client will call
(function logClientEndpoint() {
  try {
    console.info(
      "Chat client configured to use Cloudflare Worker:",
      WORKER_URL
    );
    console.info(
      "Ensure the worker forwards the incoming { messages } array to OpenAI and returns the OpenAI JSON (choices[0].message.content)."
    );
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
let userContext = { name: null, pastQuestions: [] };

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

function loadContext() {
  try {
    const raw = localStorage.getItem(CONTEXT_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      userContext = parsed;
      // ensure structure
      userContext.pastQuestions = Array.isArray(userContext.pastQuestions)
        ? userContext.pastQuestions.slice(-MAX_HISTORY)
        : [];
    }
  } catch (e) {
    console.warn("Failed to load user context from localStorage", e);
  }
}

function saveContext() {
  try {
    localStorage.setItem(CONTEXT_KEY, JSON.stringify(userContext));
  } catch (e) {
    console.warn("Failed to save user context to localStorage", e);
  }
        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
          // Prefer to surface any structured error the worker returned so the user
          // sees why the request failed without opening DevTools.
          let errMessage = "Sorry — no response returned from the API.";
          try {
            if (data) {
              if (data.error) {
                errMessage = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
              } else if (data.body) {
                errMessage = `Upstream error: ${String(data.body)}`;
              }
            }
          } catch (e) {
            /* ignore */
          }

          // update loading element to show error
          if (loadingEl) {
            const bubble = loadingEl.querySelector(".bubble");
            bubble.textContent = errMessage;
            loadingEl.classList.add("error");
          }

          console.warn(
            "Unexpected API response shape: expected OpenAI Chat Completions JSON. Response received:",
            data
          );
          console.error("Unexpected API response:", data);
        } else {
        .trim()
        .split(" ")
        .map((s) => s[0].toUpperCase() + s.slice(1))
        .join(" ");
    }
  }
  return null;
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

// Show the user's latest question above the chat responses. Passing a falsy
// value will hide the element.
function showLastQuestion(text) {
  const el = document.getElementById("lastQuestion");
  if (!el) return;
  if (!text) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.textContent = text;
  el.hidden = false;
}

function clearLastQuestion() {
  showLastQuestion(null);
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

// Heuristic: is the user's question about L'Oréal products or routines?
// This is a simple keyword-based guard so the client can refuse unrelated queries
// without calling the API. The system prompt already enforces this server-side,
// but this client-side check avoids unnecessary requests for obviously off-topic queries.
function isOnTopic(text) {
  if (!text || typeof text !== "string") return false;
  // Treat name-introduction phrases ("my name is", "I'm ...") as on-topic
  // so users can introduce themselves without being blocked by the off-topic guard.
  try {
    if (extractNameFromText(text)) return true;
  } catch (e) {
    /* ignore */
  }
  const s = text.toLowerCase();
  const keywords = [
    "product",
    "recommend",
    "recommendation",
    "routine",
    "skin",
    "hair",
    "makeup",
    "serum",
    "moistur",
    "shampoo",
    "conditioner",
    "cleanser",
    "sunscreen",
    "spf",
    "hydrating",
    "repair",
    "volume",
    "mascara",
    "foundation",
    "concealer",
    "hydration",
    "anti-aging",
    "brighten",
    "glow",
    "oil",
    "dry",
    "sensitive",
    "concern",
    "order",
    "apply",
  ];
  return keywords.some((k) => s.indexOf(k) !== -1);
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
loadContext();
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
    // Clear the latest-question UI
    try {
      clearLastQuestion();
    } catch (e) {
      /* ignore */
    }
    updateClearButtonState();
  });
}

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = userInput.value.trim();
  if (!text) return;

  // Quick client-side refusal for off-topic queries to avoid unnecessary API calls.
  if (!isOnTopic(text)) {
    const refusal =
      "Sorry — I can only answer questions about L’Oréal products, routines, and product recommendations. Please ask about products, routines, skin or hair concerns, or request product recommendations.";
    const assistantTs = new Date().toISOString();
    appendMessageToDOM("assistant", refusal, false, assistantTs).classList.add(
      "refusal"
    );
    conversation.push({
      role: "assistant",
      content: refusal,
      createdAt: assistantTs,
    });
    saveConversation();
    userInput.value = "";
    userInput.focus();
    return;
  }

  // Disable input & button to prevent duplicates
  userInput.disabled = true;
  sendBtn.disabled = true;

  // Append user's message to conversation and DOM (store timestamp)
  const userCreatedAt = new Date().toISOString();
  conversation.push({ role: "user", content: text, createdAt: userCreatedAt });
  saveConversation();
  appendMessageToDOM("user", text, false, userCreatedAt);

  // Display the latest question in the dedicated UI above the chat window
  try {
    showLastQuestion(text);
  } catch (e) {
    /* ignore */
  }

  // Update user context: track past questions and detect name introductions
  try {
    userContext.pastQuestions = userContext.pastQuestions || [];
    userContext.pastQuestions.push({
      question: text,
      createdAt: userCreatedAt,
    });
    if (userContext.pastQuestions.length > MAX_HISTORY) {
      userContext.pastQuestions = userContext.pastQuestions.slice(-MAX_HISTORY);
    }
    const maybeName = extractNameFromText(text);
    if (maybeName && (!userContext.name || userContext.name !== maybeName)) {
      userContext.name = maybeName;
      saveContext();
      const ackTs = new Date().toISOString();
      const ack = `Nice to meet you, ${userContext.name}! I'll remember your name.`;
      appendMessageToDOM("assistant", ack, false, ackTs).classList.add("meta");
      conversation.push({ role: "assistant", content: ack, createdAt: ackTs });
      saveConversation();
    } else {
      saveContext();
    }
  } catch (e) {
    console.warn("Failed to update user context:", e);
  }

  // Show loading state (assistant)
  const loadingEl = appendMessageToDOM("assistant", "Thinking...");

  try {
    // Build messages array to send to the worker / OpenAI.
    // Filter out UI-only recommendation entries (marked with productId or transient)
    // so they don't pollute the model context on subsequent requests.
    const contextPayload = {
      name: userContext.name || null,
      pastQuestions: userContext.pastQuestions || [],
    };
    const messagesToSend = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `User context: ${JSON.stringify(contextPayload)}`,
      },
      { role: "system", content: JSON_INSTRUCTION },
      ...conversation
        .slice(-MAX_HISTORY)
        .filter((m) => !m.productId && !m.transient)
        .map((m) => ({ role: m.role, content: m.content })),
    ];

    // Provide some diagnostics about filtering
    try {
      const filteredOut =
        conversation.slice(-MAX_HISTORY).length - messagesToSend.length + 2; // +2 for the two system messages
      if (filteredOut > 0) {
        console.info(
          `Filtered out ${filteredOut} UI-only recommendation entries from the messages sent to the model.`
        );
      }
    } catch (e) {
      /* ignore */
    }

    // Always call the Cloudflare Worker (keeps API key server-side)
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messagesToSend }),
    });

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
      // Try to parse JSON recommendations from the assistant response. Prefer normalized value from the worker when available.
      const parsed =
        data?.choices?.[0]?.message?.parsed ?? tryExtractJSON(content);
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

        // Save assistant message (raw content) to conversation + persist (with timestamp)
        const assistantCreatedAt = new Date().toISOString();
        conversation.push({
          role: "assistant",
          content,
          createdAt: assistantCreatedAt,
        });
        saveConversation();
        // Update the loading element timestamp to the assistant createdAt
        if (loadingEl) {
          const ts = loadingEl.querySelector(".timestamp");
          if (ts) {
            const d = new Date(assistantCreatedAt);
            ts.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(
              d.getMinutes()
            ).padStart(2, "0")}`;
          }
        }
      } else {
        // Fallback: show assistant free-text reply by updating loading element
        if (loadingEl) {
          const bubble = loadingEl.querySelector(".bubble");
          bubble.textContent = content;
        }

        // Save assistant message to conversation + persist (with timestamp)
        const assistantCreatedAt = new Date().toISOString();
        conversation.push({
          role: "assistant",
          content,
          createdAt: assistantCreatedAt,
        });
        saveConversation();
        // Update the loading element timestamp to the assistant createdAt
        if (loadingEl) {
          const ts = loadingEl.querySelector(".timestamp");
          if (ts) {
            const d = new Date(assistantCreatedAt);
            ts.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(
              d.getMinutes()
            ).padStart(2, "0")}`;
          }
        }
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
