/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

const WORKER_URL = "https://loreal-chatbot.riveraja.workers.dev";
const SYSTEM_PROMPT = "You are a helpful, friendly L’Oréal product specialist.";

let conversation = [];

// Show initial greeting
function showInitialGreeting() {
  if (conversation.length === 0) {
    appendMessage("assistant", "👋 Hi! How can I help you today?");
  }
}

// Append a message to chat
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

// Load conversation from localStorage
function loadConversation() {
  try {
    const raw = localStorage.getItem("loreal_chat_history");
    if (raw) conversation = JSON.parse(raw);
  } catch {}
}

// Save conversation
function saveConversation() {
  localStorage.setItem("loreal_chat_history", JSON.stringify(conversation));
}

// Clear conversation
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    conversation = [];
    localStorage.removeItem("loreal_chat_history");
    chatWindow.innerHTML = "";
    userInput.value = "";
    showInitialGreeting();
  });
}

loadConversation();
conversation.forEach(m => appendMessage(m.role, m.content));
showInitialGreeting();

// Send message
chatForm.addEventListener("submit", async (e)
