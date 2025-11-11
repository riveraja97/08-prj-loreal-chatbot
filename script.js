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
  { id: "p001", name: "Hydra Genius Moisturizing Cream", category: "skincare", description: "72HR Intense and Continuous Hydration. Lightweight Liquid Care Formula. Glowing, Fresh, Healthy-Looking Skin.", url: "https://www.lorealparisusa.com/skin-care/facial-moisturizers/hydra-genius-daily-liquid-care-normal-dry-skin" },
  { id: "p002", name: "Glycolic Bright Serum", category: "skincare", description: "Clinically proven to visibly reduces 77% of spots, sun spots, age spots and acne marks. Powered by MELASYL™", url: "https://www.lorealparis.com.my/glycolic-bright/glycolic-bright-8-face-serum-for-dark-spot-brightening-30ml" },
  { id: "p003", name: "Waterproof Mascara", category: "makeup", description: "It gives your lashes instant breathtaking 20X more volume & 2X more length. It lasts up to 36 hours.", url: "https://www.lorealparis.com.my/lash-paradise/instant-volume-waterproof-mascara" },
  { id: "p004", name: "Total Repair 5 Shampoo", category: "haircare", description: "5 Problems, 1 Solution! Formulated for Asian Hair Total Repair 5 addresses the 5 most common signs of Damaged Hair: Breakage, Dryness, Dullness, Coarseness and Splits ends.", url: "https://www.lorealparis.com.my/elseve/total-repair-5/elseve-total-repair-5-shampoo-620ml" }
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
