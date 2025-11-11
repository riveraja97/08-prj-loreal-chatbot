/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

const WORKER_URL = "https://loreal-chatbot.riveraja.workers.dev";
const SYSTEM_PROMPT = "You are a helpful, friendly L’Oréal product specialist...";
const STORAGE_KEY = "loreal_chat_history";
const MAX_HISTORY = 20;

let conversation = [];

// Load saved conversation
function loadConversation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      conversation = JSON.parse(raw).slice(-MAX_HISTORY);
    }
  } catch {}
}

// Save conversation
function saveConversation() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversation.slice(-MAX_HISTORY)));
}

// Append message
function appendMessage(role, text) {
  const el = document.createElement("div");
  el.className = `message ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  el.appendChild(bubble);
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return el;
}

// Initial greeting
function showInitialGreeting() {
  if (conversation.length === 0) {
    appendMessage("assistant", "👋 Hi! How can I help you today?");
  }
}

// Clear conversation
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    conversation = [];
    localStorage.removeItem(STORAGE_KEY);
    chatWindow.innerHTML = "";
    userInput.value = "";
    showInitialGreeting();
  });
}

loadConversation();
conversation.forEach(m => appendMessage(m.role, m.content));
showInitialGreeting();

// Send message
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  // Append user message
  conversation.push({ role: "user", content: text });
  appendMessage("user", text);
  saveConversation();

  // Show loading
  const loadingEl = appendMessage("assistant", "Thinking...");

  userInput.disabled = true;
  sendBtn.disabled = true;

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "system", content: SYSTEM_PROMPT }, ...conversation] })
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "Sorry, no response.";

    // Replace loading with assistant response
    const bubble = loadingEl.querySelector(".bubble");
    bubble.textContent = content;

    conversation.push({ role: "assistant", content });
    saveConversation();

  } catch (err) {
    const bubble = loadingEl.querySelector(".bubble");
    bubble.textContent = "Error fetching response.";
    console.error(err);
  } finally {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.value = "";
    userInput.focus();
  }
});
