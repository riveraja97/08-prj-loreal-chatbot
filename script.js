/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

const WORKER_URL = "https://loreal-chatbot.riveraja.workers.dev"; // replace with your worker
const MAX_HISTORY = 20;

let conversation = [];
let userContext = { name: null, pastQuestions: [] };

function appendMessage(role, text) {
  const el = document.createElement("div");
  el.className = `message ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  el.appendChild(bubble);
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function saveConversation() {
  localStorage.setItem("loreal_chat_history", JSON.stringify(conversation.slice(-MAX_HISTORY)));
}

function loadConversation() {
  const saved = localStorage.getItem("loreal_chat_history");
  if (saved) conversation = JSON.parse(saved).slice(-MAX_HISTORY);
  conversation.forEach(m => appendMessage(m.role, m.content));
}

// Initial greeting
if (conversation.length === 0) {
  appendMessage("assistant", "👋 Hi! How can I help you today?");
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  appendMessage("user", text);
  conversation.push({ role: "user", content: text });
  saveConversation();

  userInput.disabled = true;
  sendBtn.disabled = true;

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversation, userContext }),
    });

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "Sorry, no response.";

    appendMessage("assistant", content);
    conversation.push({ role: "assistant", content });
    saveConversation();
  } catch (err) {
    appendMessage("assistant", "Error: Could not fetch response.");
    console.error(err);
  } finally {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.value = "";
    userInput.focus();
  }
});

clearBtn.addEventListener("click", () => {
  conversation = [];
  localStorage.removeItem("loreal_chat_history");
  chatWindow.innerHTML = "";
  appendMessage("assistant", "👋 Hi! How can I help you today?");
});
