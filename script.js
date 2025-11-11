/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const lastQuestionEl = document.getElementById("lastQuestion");

const WORKER_URL = "https://loreal-chatbot.riveraja.workers.dev";
let conversation = [];

// Sample product dataset
const PRODUCTS = [
  { id: "p001", name: "HydraBoost Moisturizing Cream", category: "skincare", description: "Rich, hydrating cream for dry to very dry skin.", url: "https://example.com/hydraboost" },
  { id: "p002", name: "Glow Radiance Serum", category: "skincare", description: "Lightweight serum with vitamin C to brighten and even skin tone.", url: "https://example.com/glow-serum" },
  { id: "p003", name: "Volume Lift Mascara", category: "makeup", description: "Buildable formula for dramatic volume without clumping.", url: "https://example.com/volume-mascara" },
  { id: "p004", name: "Repair & Shine Shampoo", category: "haircare", description: "Strengthening shampoo for damaged hair with argan oil.", url: "https://example.com/repair-shampoo" }
];

// Append message bubble
function appendMessage(role, text, isHtml = false, extraClass = "") {
  const el = document.createElement("div");
  el.className = `message ${role} ${extraClass}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (isHtml) bubble.innerHTML = text;
  else bubble.textContent = text;
  el.appendChild(bubble);
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Show last question
function showLastQuestion(text) {
  if (!text) {
    lastQuestionEl.hidden = true;
    lastQuestionEl.textContent = "";
  } else {
    lastQuestionEl.textContent = text;
    lastQuestionEl.hidden = false;
  }
}

// Clear conversation
clearBtn.addEventListener("click", () => {
  conversation = [];
  chatWindow.innerHTML = "👋 Hi! How can I help you today?";
  showLastQuestion(null);
  userInput.value = "";
  userInput.focus();
});

// Try to extract JSON recommendations from assistant response
function tryExtractJSON(text) {
  if (!text) return null;
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1) return null;
  try {
    return JSON.parse(text.slice(first, last + 1));
  } catch {
    return null;
  }
}

// Submit handler
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  conversation.push({ role: "user", content: text });
  appendMessage("user", text);
  showLastQuestion(text);

  userInput.disabled = true;
  sendBtn.disabled = true;

  const loadingEl = document.createElement("div");
  loadingEl.className = "message assistant";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = "Thinking...";
  loadingEl.appendChild(bubble);
  chatWindow.appendChild(loadingEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversation }),
    });

    const data = await res.json();
    let reply = data?.choices?.[0]?.message?.content || "Sorry, no response.";
    bubble.textContent = reply;

    // Parse product recommendations from JSON in assistant response
    const parsed = tryExtractJSON(reply);
    if (parsed?.recommendations?.length > 0) {
      parsed.recommendations.forEach((rec) => {
        const product = PRODUCTS.find((p) => p.id === rec.id) || rec;
        const name = product.name || rec.name || rec.id;
        const url = product.url || "#";
        const reason = rec.reason || "";
        const html = `<strong><a href="${url}" target="_blank" rel="noopener">${name}</a></strong><div class="rec-reason">${reason}</div>`;
        appendMessage("assistant", html, true, "recommendation");
      });
    }

    conversation.push({ role: "assistant", content: reply });
  } catch (err) {
    bubble.textContent = "Error fetching response.";
    bubble.parentElement.classList.add("error");
    console.error(err);
  } finally {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.value = "";
    userInput.focus();
  }
});

// Initial greeting
appendMessage("assistant", "👋 Hi! How can I help you today?");