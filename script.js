/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

/* Configuration */
const WORKER_URL = "https://loreal-chatbot.riveraja.workers.dev/"; // replace with your deployed worker

/* Conversation */
let conversation = [];

/* Append message */
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

/* Clear conversation */
clearBtn.addEventListener("click", () => {
  conversation = [];
  chatWindow.innerHTML = "";
  appendMessage("assistant", "👋 Hi! How can I help you today?");
});

/* On load, show greeting */
appendMessage("assistant", "👋 Hi! How can I help you today?");

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  // Show user message
  appendMessage("user", text);
  conversation.push({ role: "user", content: text });

  // Disable input while waiting
  userInput.disabled = true;
  sendBtn.disabled = true;

  // Call Worker
  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversation }),
    });

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "No response";

    appendMessage("assistant", content);
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
