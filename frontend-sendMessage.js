// Replace your existing sendMessage with this.
// The ONLY real change: it calls YOUR backend, not api.anthropic.com.
// Also note: SYSTEM_PROMPT now lives on the server, so you can DELETE
// the SYSTEM_PROMPT constant at the top of this file — the browser
// no longer needs it.

const BACKEND_URL = "https://YOUR-BACKEND.onrender.com"; // <- paste your deployed URL

const sendMessage = async (text) => {
  const userText = text || input.trim();
  if (!userText) return;

  setStarted(true);
  setInput("");
  const newMessages = [...messages, { role: "user", content: userText }];
  setMessages(newMessages);
  setLoading(true);

  try {
    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: newMessages }),
    });
    const data = await response.json();
    const reply = data.reply || "Sorry, I couldn't get a response.";
    setMessages([...newMessages, { role: "assistant", content: reply }]);
  } catch {
    setMessages([
      ...newMessages,
      { role: "assistant", content: "Something went wrong. Please try again." },
    ]);
  }
  setLoading(false);
};
