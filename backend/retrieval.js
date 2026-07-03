import pg from "pg";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function embed(text) {
  const result = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 768 },
  });
  return result.embeddings[0].values;
}

// --- Search 1: by MEANING (vector), scoped to one session ---
async function vectorSearch(question, sessionId, limit = 5) {
  const queryVector = await embed(question);
  const vectorString = `[${queryVector.join(",")}]`;
  const result = await pool.query(
    `SELECT id, content, source
     FROM documents
     WHERE session_id = $1
     ORDER BY embedding <=> $2::vector ASC
     LIMIT $3`,
    [sessionId, vectorString, limit]
  );
  return result.rows;
}

// --- Search 2: by KEYWORD (full-text), scoped to one session ---
async function keywordSearch(question, sessionId, limit = 5) {
  const result = await pool.query(
    `SELECT id, content, source
     FROM documents
     WHERE session_id = $1
       AND content_tsv @@ plainto_tsquery('english', $2)
     ORDER BY ts_rank(content_tsv, plainto_tsquery('english', $2)) DESC
     LIMIT $3`,
    [sessionId, question, limit]
  );
  return result.rows;
}

// --- Fuse with Reciprocal Rank Fusion (unchanged) ---
export function reciprocalRankFusion(vectorResults, keywordResults, k = 60) {
  const scores = new Map();

  function addList(list) {
    list.forEach((row, index) => {
      const rank = index + 1;
      const contribution = 1 / (k + rank);
      if (scores.has(row.id)) {
        scores.get(row.id).score += contribution;
      } else {
        scores.set(row.id, { row, score: contribution });
      }
    });
  }

  addList(vectorResults);
  addList(keywordResults);

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.row);
}

// --- Combined hybrid search, scoped to one session ---
export async function hybridSearch(question, sessionId, topK = 3) {
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(question, sessionId),
    keywordSearch(question, sessionId),
  ]);

  const fused = reciprocalRankFusion(vectorResults, keywordResults);
  return fused.slice(0, topK);
}