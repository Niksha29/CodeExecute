import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createServer } from "http";
import { Server } from "socket.io";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins for Replit
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware
app.use(
  cors({
    origin: "*", // Allow all origins for Replit
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  }),
);
app.use(express.json());

// AI Autocomplete endpoint (kept for fallback)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

app.post("/api/autocomplete", async (req, res) => {
  const { code, language } = req.body;
  if (!code) return res.status(400).json({ error: "Code is required" });

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `
You are an autocomplete engine. Given the following incomplete ${language} code, generate ONLY the next lines of code that should follow, starting exactly where the code ends.
Do NOT repeat or include any of the code already provided.
Do not echo any previous lines. Output only the code continuation.

${code}
`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
      },
    });

    // Extract suggestion text from Gemini response
    const suggestion =
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "";

    res.json({ suggestion });
  } catch (err) {
    console.error("❌ Gemini API Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- Socket.IO Collaboration ---
let rooms = {}; // { roomId: { code, language, input } }

io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("join-room", ({ roomId, role }, callback) => {
    console.log(`Client joining room: ${roomId} as ${role}`);
    socket.join(roomId);
    socket.data.role = role;
    if (rooms[roomId]) {
      socket.emit("sync-code", rooms[roomId]);
    }
    if (callback) callback();
  });

  socket.on("code-change", ({ roomId, code }) => {
    if (!rooms[roomId]) rooms[roomId] = {};
    rooms[roomId].code = code;
    socket.to(roomId).emit("code-change", code);
  });

  socket.on("language-change", ({ roomId, language }) => {
    if (!rooms[roomId]) rooms[roomId] = {};
    rooms[roomId].language = language;
    socket.to(roomId).emit("language-change", language);
  });

  socket.on("input-change", ({ roomId, input }) => {
    if (!rooms[roomId]) rooms[roomId] = {};
    rooms[roomId].input = input;
    socket.to(roomId).emit("input-change", input);
  });

  // --- AI autocomplete via websocket (Ctrl+B, room-agnostic, robust) ---
  socket.on("ai-autocomplete", async (payload, callback) => {
    const { code, language } = payload;
    if (!code) return callback({ error: "Code is required" });
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const prompt = `
You are an autocomplete engine. Given the following incomplete ${language} code, generate ONLY the next lines of code that should follow, starting exactly where the code ends.
Do NOT repeat or include any of the code already provided.
Do not echo any previous lines. Output only the code continuation.

${code}
`;
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
      });
      const suggestion =
        result?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        "";
      callback({ suggestion });
    } catch (e) {
      callback({ error: e.message });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// --- Judge0 API Endpoints ---

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api/submission/:token", async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).json({ error: "Token is required" });
  try {
    const response = await axios.get(
      `https://judge0-ce.p.rapidapi.com/submissions/${token}?base64_encoded=true&fields=*`,
      {
        headers: {
          "X-RapidAPI-Key": process.env.JUDGE0_API_KEY,
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        },
      },
    );
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: "Failed to fetch submission result",
      details: error.response?.data || error.message,
    });
  }
});

app.post("/api/execute", async (req, res) => {
  const { source_code, language_id, stdin } = req.body;
  if (!source_code || !language_id)
    return res
      .status(400)
      .json({ error: "Source code and language ID are required" });
  try {
    const response = await axios.post(
      "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=true&wait=false&fields=*",
      {
        source_code,
        language_id,
        stdin: stdin || "",
        cpu_time_limit: 5,
        memory_limit: 512000,
      },
      {
        headers: {
          "content-type": "application/json",
          "X-RapidAPI-Key": process.env.JUDGE0_API_KEY,
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        },
      },
    );
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: "Failed to execute code",
      details: error.response?.data || error.message,
    });
  }
});

app.get("/api/languages", async (req, res) => {
  try {
    const response = await axios.get(
      "https://judge0-ce.p.rapidapi.com/languages",
      {
        headers: {
          "X-RapidAPI-Key": process.env.JUDGE0_API_KEY,
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        },
      },
    );
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: "Failed to fetch languages",
      details: error.response?.data || error.message,
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Something went wrong on the server" });
});

const PORT = process.env.PORT || 5001;
httpServer.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
