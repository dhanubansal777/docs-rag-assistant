import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { hybridSearch } from "./retrieval.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Simple in-memory cache: key = "sessionId::question", value = the answer result
const answerCache = new Map();

// Retry a function a few times if it hits a transient error (e.g. 503 busy)
async function withRetry(fn, retries = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.message?.includes("RESOURCE_EXHAUSTED") || err.message?.includes("429")) {
        // Quota errors won't resolve by retrying quickly — tag and fail fast so the
        // caller can show a real "rate limited" message instead of a generic 500.
        err.isQuotaError = true;
        throw err;
      }
      const transient =
        err.message?.includes("503") || err.message?.includes("UNAVAILABLE");
      if (transient && attempt < retries) {
        console.log(`  (transient error, retrying in ${delayMs}ms... attempt ${attempt})`);
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
}

export async function answerQuestion(question, sessionId) {
  // 1. Cache key unique to this session + question
  const cacheKey = `${sessionId}::${question.trim().toLowerCase()}`;

  // 2. Cache hit? Return instantly, skip the whole pipeline.
  if (answerCache.has(cacheKey)) {
    console.log("Cache HIT:", question);
    return answerCache.get(cacheKey);
  }
  console.log("Cache MISS:", question);

  // 3. Cache miss — run the full pipeline
  const chunks = await hybridSearch(question, sessionId);

  const context = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");

  const prompt = `You are a helpful assistant that answers questions about university academic rules.
Answer the question using ONLY the context below. If the answer is not in the context, reply exactly: "I don't have that information in the provided documents." Do not invent anything.

Context:
${context}

Question: ${question}

Answer:`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    })
  );

  const tokens = response.usageMetadata?.totalTokenCount ?? null; // ← capture token usage

  const result = {
    answer: response.text,
    tokens, // ← include it in the result
    sources: chunks.map((c) => ({
      source: c.source,
      snippet: c.content.slice(0, 120) + "...",
    })),
  };

  answerCache.set(cacheKey, result);
  return result;
}