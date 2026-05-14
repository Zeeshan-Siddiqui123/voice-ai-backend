import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Groq } from "groq-sdk"; // 1. Switched to Groq SDK
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// 2. Initialize Groq client (It looks for process.env.GROQ_API_KEY automatically)
const groq = new Groq();

const SYSTEM_PROMPT = `You are a helpful, friendly AI assistant in a WhatsApp-style chat.
Keep replies conversational, warm, and concise (1–4 sentences unless more detail is requested).
Be natural — like a knowledgeable friend, not a formal bot.`;

app.get("/", (req, res) => {
    res.send("Backend Running.....");
});

function cleanForSpeech(text) {
    return text
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
        .replace(/[*_`~#>|\\[\]]/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\n{2,}/g, ". ")
        .replace(/\n/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
}

app.post("/chat", async (req, res) => {
    const { message, historjsony = [] } = req.body;
    if (!message?.trim()) {
        return res.status(400).json({ error: "Message is required." });
    }

    const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.slice(-24).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: message.trim() },
    ];

    try {
        // 3. Updated SDK target and changed model to Llama 3
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages,
            temperature: 0.75,
            max_tokens: 600,
        });

        const text = completion.choices[0].message.content.trim();
        const speech = cleanForSpeech(text);
        res.json({ text, speech });
    } catch (err) {
        console.error("Groq error:", err.message);
        const s = err.status || 500;
        res.status(s).json({
            error:
                s === 401 ? "Invalid Groq API key." :
                    s === 429 ? "Groq Rate limit hit. Please slow down." :
                        "AI error — please try again.",
        });
    }
});

app.get("/health", (_, res) => res.json({ ok: true }));

app.get("*", (_, res) =>
    res.sendFile(path.join(__dirname, "../frontend/index.html"))
);

app.listen(PORT, () => {
    console.log(`✅ Server running on → http://localhost:${PORT}`);
    if (!process.env.GROQ_API_KEY) console.warn("⚠️ GROQ_API_KEY not set in .env");
});