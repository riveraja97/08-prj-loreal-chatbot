/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const lastQuestionEl = document.getElementById("lastQuestion");

const WORKER_URL = "https://loreal-chatbot.riveraja.workers.dev"; // Replace with your worker URL
let conversation = [];

// Sample product dataset
const PRODUCTS = [
  { id: "p001", name: "Hydra Genius Moisturizing Cream", category: "skincare", description: "72HR Intense Hydration", url: "https://www.lorealparisusa.com/skin-care/facial-moisturizers/hydra-genius-daily-liquid-care-normal-dry-skin" },
  { id: "p002", name: "Glycolic Bright Serum", category: "skincare", description: "Reduces spots and dark marks", url: "https://www.lorealparis.com.my/glycolic-bright/glycolic-bright-8-face-serum-for-dark-spot-brightening-30ml" },
  { id: "p003", name: "Waterproof Mascara", category: "makeup", description: "Instant 20X volume & 2X length", url: "https://www.lorealparis.com.my/lash-paradise/instant-volume-waterproof-mascara" },
  { id: "p004", name: "Total Repair 5 Shampoo", category: "haircare", description: "Repairs 5 common hair problems", url: "https://www.lorealparis.com.my/elseve/total-repair-5/elseve-total-repair-5-shampoo-620ml" }
];

// Initial greeting
appendMessage("assistant", "👋 Hi! How can I help you today?");

// Append message helper
function appendMessage(role, text, isHtml = false, extraClass = "") {
  const el = document.createElement("div");
  el.className = `message ${role} ${extraClass}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = isHtml ? text : text;
  el.appendChild(bubble);
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return el;
}

// Show last question
function showLastQuestion(text) {
  if (!text) {
    lastQuestionEl.hidden = true;
    lastQuestionEl.textContent = "";
  } else {
    lastQuestionEl.hidden = false;
    lastQuestionEl.textContent = text;
  }
}

// Clear conversation
clearBtn.addEventListener("click", () => {
  conversation = [];
  chatWindow.innerHTML = "";
  showLastQuestion(null);
  appendMessage("assistant", "👋 Hi! How can I help you today?");
  userInput.value = "";
  userInput.focus();
});

// Try to extract JSON recommendations
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

  const loadingEl = appendMessage("assistant", "Thinking...");

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversation }),
    });

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content || "Sorry, no response.";
    loadingEl.querySelector(".bubble").textContent = reply;

    // Parse product recommendations
    const parsed = tryExtractJSON(reply);
    if (parsed?.recommendations?.length > 0) {
      parsed.recommendations.forEach((rec) => {
        const product = PRODUCTS.find(p => p.id === rec.id) || rec;
        const html = `<strong><a href="${product.url}" target="_blank" rel="noopener">${product.name}</a></strong><div class="rec-reason">${rec.reason || product.description}</div>`;
        appendMessage("assistant", html, true, "recommendation");
      });
    }

    conversation.push({ role: "assistant", content: reply });
  } catch (err) {
    loadingEl.querySelector(".bubble").textContent = "Error fetching response.";
    loadingEl.classList.add("error");
    console.error(err);
  } finally {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.value = "";
    userInput.focus();
  }
});
