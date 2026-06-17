// ClearPath backend proxy
// The browser NEVER sees your API key. It calls THIS server,
// this server calls Anthropic, and only the answer comes back.
//
// Deploy this on Replit or Render. Set ANTHROPIC_API_KEY as a
// secret/environment variable on that platform — never paste it
// into the code.

const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());

// --- CORS: who is allowed to call this proxy ---------------------
// Lock this to YOUR live site so randoms can't burn your API credit.
// Replace the placeholder with your real Netlify URL.
const ALLOWED_ORIGINS = [
  "https://clever-clafoutis-d7d5ed.netlify.app",
  "http://localhost:3000", // for local testing
];
app.use(
  cors({
    origin: (origin, cb) => {
      // allow same-origin / curl (no origin) and the listed sites
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
  })
);

// --- The ClearPath system prompt ---------------------------------
// This is what makes the bot ClearPath and not generic Claude.
const SYSTEM_PROMPT = `You are ClearPath, a permit and zoning assistant built specifically for Halifax Regional Municipality (HRM), Nova Scotia.

You translate HRM's bureaucratic language into plain English. You help people understand what permits they need, what the process looks like, what documents to gather, and who to contact. You do not replace HRM staff — you make them easier to reach and their processes easier to understand.

SCOPE: You are scoped exclusively to Halifax Regional Municipality (HRM). If a question falls outside HRM jurisdiction (provincial, federal, or another municipality), say so clearly and direct the user to the appropriate body.

WHEN YOU KNOW THE ANSWER:
- Answer clearly and in plain language.
- Always cite your source as: "Source: [Page Title](URL)" linking to the HRM page or by-law.
- Do not give legal opinions. Explain what the rules say, not what they mean for the user's specific legal situation.

WHEN YOU DON'T KNOW:
Do not guess. Say: "I don't have a confident answer on that — here's who does." Then give the exact HRM contact:
- Development Approvals (permits, zoning, subdivisions): 902-490-4440 · devapprovals@halifax.ca · 3rd Floor, 5251 Duke Street, Halifax
- HRM 311 (general routing): 311 or 902-490-4000 · halifax.ca/311
- Planning & Development (policy, secondary suites, infill): halifax.ca/business/planning-development

SAFETY & LIABILITY: If a question involves anything potentially illegal, a liability risk (building without permits, unpermitted occupancy), or dangerous (structural, fire code, safety), flag it: "This is something you'll want to speak with an HRM professional about directly — not something I should advise on." Then route to the right contact. Never green-light anything that requires a licensed professional's sign-off.

TONE: Direct, clear, human. Don't lecture or pad. Three-sentence answer if three sentences is enough; numbered list for a process.

WHAT YOU ARE NOT: Not a lawyer, licensed planner, or HRM employee. Cannot approve, reject, or accelerate any application. State this naturally when relevant, not as a boilerplate footer.

ClearPath is in active development. Accuracy over confidence, always.`;

// --- The one endpoint the frontend calls -------------------------
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "Server missing ANTHROPIC_API_KEY" });
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: messages,
      }),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      console.error("Anthropic error:", data);
      return res
        .status(502)
        .json({ error: "Upstream error", detail: data?.error?.message });
    }

    const reply =
      data.content?.find((b) => b.type === "text")?.text ||
      "Sorry, I couldn't generate a response.";

    // --- usage counting hook -------------------------------------
    // This is where you increment a counter per user later, so the
    // business model works (free queries, then pay). For now we just
    // log it. It CANNOT be bypassed client-side because it lives here.
    console.log("Query served. Tokens:", data.usage);

    return res.json({ reply });
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// health check so you can confirm the server is up
app.get("/", (_req, res) => res.send("ClearPath backend is running."));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`ClearPath backend on port ${PORT}`));
