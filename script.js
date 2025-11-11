const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

const WORKER_URL = "https://loreal-chatbot.riveraja.workers.dev";

// SYSTEM PROMPT
const SYSTEM_PROMPT = `
You are a helpful, friendly L’Oréal product specialist. 
Answer only questions about L’Oréal products, routines, and product recommendations. 
If a user asks something outside this scope, politely decline. 
When recommending products, include up to 3 items, a short reason for each, and practical next steps.
Return recommendations in valid JSON only if appropriate.
`;

// Sample product dataset
const PRODUCTS = [
  { id: "p001", name: "HydraBoost Moisturizing Cream", category: "skincare", url: "https://example.com/hydraboost" },
  { id: "p002", name: "Glow Radiance Serum", category: "skincare", url: "https://example.com/glow-serum" },
  { id: "p003", name: "Volume Lift Mascara", category: "makeup", url: "https://example.com/volume-mascara" },
  { id: "p004", name: "Repair & Shine Shampoo", category: "haircare", url: "https://example.com/repair-shampoo" },
];

let conversation = [];

// Append message to chat window
function appendMessage(role, text, isHTML = false) {
  const el = document.createElement("div");
  el.className = `message ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (isHTML) bubble.innerHTML = text;
  else bubble.textContent = text;
  el.appendChild(bubble);
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Clear conversation
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    conversation = [];
    chatWindow.innerHTML = "";
    userInput.value = "";
    userInput.focus();
  });
}

// Handle submit
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userText = userInput.value.trim();
  if (!userText) return;

  appendMessage("user", userText);
  conversation.push({ role: "user", content: userText });

  // Disable input
  userInput.disabled = true;
  sendBtn.disabled = true;

  // Loading bubble
  const loadingEl = document.createElement("div");
  loadingEl.className = "message assistant";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = "Thinking...";
  loadingEl.appendChild(bubble);
  chatWindow.appendChild(loadingEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const messagesToSend = [
      { role: "system", content: SYSTEM_PROMPT },
      ...conversation,
    ];

    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messagesToSend }),
    });

    const data = await res.json();
    const assistantContent = data?.choices?.[0]?.message?.content || "No response";

    // Update bubble with response
    bubble.textContent = assistantContent;
    conversation.push({ role: "assistant", content: assistantContent });

    // If JSON recommendations exist
    const recs = data?.parsed?.recommendations;
    if (Array.isArray(recs) && recs.length > 0) {
      recs.forEach((rec) => {
        const prod = PRODUCTS.find((p) => p.id === rec.id) || rec;
        const html = `<strong><a href="${prod.url}" target="_blank">${prod.name}</a></strong>: ${rec.reason || ""}`;
        appendMessage("assistant", html, true);
      });
    }

  } catch (err) {
    bubble.textContent = "Error fetching response.";
    console.error(err);
  } finally {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.value = "";
    userInput.focus();
  }
});

