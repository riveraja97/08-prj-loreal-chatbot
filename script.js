/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

const WORKER_URL = "https://your-worker-url.workers.dev"; // replace with your deployed worker

/* Product dataset (for rendering links) */
const PRODUCTS = [
  { id: "p001", name: "HydraBoost Moisturizing Cream", url: "https://example.com/hydraboost" },
  { id: "p002", name: "Glow Radiance Serum", url: "https://example.com/glow-serum" },
  { id: "p003", name: "Volume Lift Mascara", url: "https://example.com/volume-mascara" },
  { id: "p004", name: "Repair & Shine Shampoo", url: "https://example.com/repair-shampoo" },
];

/* Conversation */
let conversation = [];

/* Append message */
function appendMessage(role, text, isHtml = false) {
  const el = document.createElement("div");
  el.className = `message ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (isHtml) bubble.innerHTML = text;
  else bubble.textContent = text;
  el.appendChild(bubble);
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Clear button */
clearBtn.addEventListener("click", () => {
  conversation = [];
  chatWindow.innerHTML = "";
  appendMessage("assistant", "👋 Hi! How can I help you today?");
});

/* Show greeting on load */
appendMessage("assistant", "👋 Hi! How can I help you today?");

/* Form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  appendMessage("user", text);
  conversation.push({ role: "user", content: text });

  userInput.disabled = true;
  sendBtn.disabled = true;

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversation }),
    });

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "No response";

    // Try to parse JSON recommendations
    let parsed = null;
    try { parsed = JSON.parse(content); } catch {}

    if (parsed?.recommendations?.length) {
      appendMessage("assistant", "Here are some recommendations:");
      parsed.recommendations.forEach((rec) => {
        const product = PRODUCTS.find((p) => p.id === rec.id) || rec;
        const html = `<a href="${product.url}" target="_blank">${product.name}</a>: ${rec.reason || ""}`;
        appendMessage("assistant", html, true);
      });
    } else {
      appendMessage("assistant", content);
    }

    conversation.push({ role: "assistant", content });

  } catch (err) {
    appendMessage("assistant", "Error: Could not get response.");
    console.error(err);
  } finally {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.value = "";
    userInput.focus();
  }
});
