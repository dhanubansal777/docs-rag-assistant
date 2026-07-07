import express from "express";
import cors from "cors";
import "dotenv/config";
import { answerQuestion } from "./rag.js";
import multer from "multer";
import { ingestUploadedPdf } from "./upload-ingest.js";
import { listDocuments, deleteDocument, clearSession } from "./documents.js";
import rateLimit from "express-rate-limit";
const app = express();
app.use(cors());
app.use(express.json());
const limiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute window
  max: 20,               // max 20 requests per window per IP
  message: { error: "Too many requests, please wait a minute and try again." },
  standardHeaders: true, // send rate-limit info in response headers
  legacyHeaders: false,
});
app.use("/api/", limiter);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5,                   // max 5 files per upload
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed"));
    }
    cb(null, true);
  },
});
app.get("/health", (req, res) => res.json({ ok: true }));
// Limit each IP to 20 requests per minute


app.post("/api/ask", async (req, res) => {
  const startTime = Date.now(); // ← record start
  try {
    const { question, sessionId } = req.body;

    if (!question || question.trim() === "") {
      return res.status(400).json({ error: "Question is required" });
    }
    if (!sessionId) {
      return res.status(400).json({ error: "Missing session ID" });
    }

    const result = await answerQuestion(question, sessionId);

    const durationMs = Date.now() - startTime; // ← how long it took
  //  console.log(`[ASK] "${question}" | ${durationMs}ms | tokens: ${result.tokens ?? "n/a"}`);

    res.json(result);
  } catch (err) {
    const durationMs = Date.now() - startTime;
    console.error(`[ASK ERROR] ${durationMs}ms | ${err.message}`);
    if (err.isQuotaError) {
      return res.status(503).json({
        error: "The AI service has hit its usage limit for now. Please try again in a few minutes.",
      });
    }
    res.status(500).json({ error: "Something went wrong on the server" });
  }
});
app.post("/api/upload", (req, res, next) => {
  upload.array("files")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const sessionId = req.body.sessionId;
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    if (!sessionId) return res.status(400).json({ error: "Missing session ID" });

    const results = [];
    for (const file of req.files) {
      const chunkCount = await ingestUploadedPdf(
        file.buffer,
        file.originalname,
        sessionId
      );
      results.push({ filename: file.originalname, chunks: chunkCount });
    }

    const totalChunks = results.reduce((sum, r) => sum + r.chunks, 0);
    res.json({ success: true, files: results, totalChunks });
  } catch (err) {
    console.error("Upload error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/documents", async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: "Missing session ID" });

    const documents = await listDocuments(sessionId);
    res.json({ documents });
  } catch (err) {
    console.error("List documents error:", err.message);
    res.status(500).json({ error: "Something went wrong on the server" });
  }
});

app.delete("/api/documents", async (req, res) => {
  try {
    const { sessionId, source } = req.query;
    if (!sessionId) return res.status(400).json({ error: "Missing session ID" });
    if (!source) return res.status(400).json({ error: "Missing source filename" });

    const deleted = await deleteDocument(sessionId, source);
    if (deleted === 0) return res.status(404).json({ error: "Document not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete document error:", err.message);
    res.status(500).json({ error: "Something went wrong on the server" });
  }
});

app.delete("/api/session", async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: "Missing session ID" });

    await clearSession(sessionId);
    res.json({ success: true });
  } catch (err) {
    console.error("Clear session error:", err.message);
    res.status(500).json({ error: "Something went wrong on the server" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));