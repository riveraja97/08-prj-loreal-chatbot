/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const lastQuestionEl = document.getElementById("lastQuestion");

const WORKER_URL = "https://loreal-chatbot.riveraja.workers.dev"; 
let conversation = [];

// Sample products
const PRODUCTS = [
  { id: "p001", name: "Hydra Genius Moisturizing Cream", category: "skincare", description: "72HR Intense and Continuous Hydration.", url: "https://www.lorealparisusa.com/skin-care/facial-moisturizers/hydra-genius-daily-liquid-care-normal-dry-skin" },
  { id: "p002", name: "Glycolic Bright Serum", category: "skincare", description: "Reduces spots, sun spots, age spots and acne marks.", url: "https://www.lorealparis.com.my/glycolic-bright/glycolic-bright-8-face-serum-for-dark-spot-brightening-30ml" },
  { id: "p003", name: "Waterproof Mascara", category: "makeup", description: "Instant breathtaking 20X more volume & 2X more length.", url: "https://www.lorealparis.com.my/lash-paradise/instant-volume-waterproof-mascara" },
  { id: "p004", name: "Total Repair 5 Shampoo", category: "haircare", description: "Addresses 5 common signs of damaged hair.", url: "https://www.lorealparis.com.my/elseve/total-repair-5/elseve-total-repair-5-shampoo-620ml" }
];

// Initial message
chatWindow.textContent = "👋 Hi! How can I help you today?";

// Append message to chat
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

// Show last question above chat
function showLastQuestion(text) {
  if (!lastQuestionEl) return;
  if (!text) {
    lastQuestionEl.hidden = true;
    lastQuestionEl.textContent = "";
  } else {
    lastQuestionEl.textContent = text;
    lastQuestionEl.hidden = false;
  }
}

// Try to extract JSON from assistant response
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

// Handle form submit
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  // Add user message to conversation & DOM
  conversation.push({ role: "user", content: text });
  appendMessage("user", text);
  showLastQuestion(text);

  // Disable input while waiting for response
  userInput.disabled = true;

  // Show "thinking..." bubble
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
    const reply = data?.choices?.[0]?.message?.content || "Sorry, no response.";
    bubble.textContent = reply;

    // Parse product recommendations from JSON
    const parsed = tryExtractJSON(reply);
    if (parsed?.recommendations?.length > 0) {
      parsed.recommendations.forEach((rec) => {
        const product = PRODUCTS.find((p) => p.id === rec.id) || rec;
        const html = `<strong><a href="${product.url}" target="_blank" rel="noopener">${product.name}</a></strong><div class="rec-reason">${rec.reason || ""}</div>`;
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
    userInput.value = "";
    userInput.focus();
  }
});
