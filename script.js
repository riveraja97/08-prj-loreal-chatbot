/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const lastQuestionEl = document.getElementById("lastQuestion");

const WORKER_URL = "https://loreal-chatbot.riveraja.workers.dev";
let conversation = [];

// Utility: append message to DOM
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

// Handle clear
clearBtn.addEventListener("click", () => {
  conversation = [];
  chatWindow.innerHTML = "👋 Hi! How can I help you today?";
  showLastQuestion(null);
  userInput.value = "";
  userInput.focus();
});

// Handle submit
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  // Append user message
  conversation.push({ role: "user", content: text });
  appendMessage("user", text);
  showLastQuestion(text);

  userInput.disabled = true;
  sendBtn.disabled = true;

  // Show loading bubble
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

/* Initial greeting */
appendMessage("assistant", "👋 Hi! How can I help you today?");