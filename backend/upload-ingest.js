import { PDFParse } from "pdf-parse";
import pg from "pg";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { chunkText } from "./chunkText.js";

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

// Ingest one uploaded PDF (given as a buffer) for a specific session
export async function ingestUploadedPdf(buffer, filename, sessionId) {
  // 1. Extract text from the uploaded PDF buffer
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy();

  // 2. Chunk it
  const chunks = chunkText(parsed.text);
  if (chunks.length === 0) {
    throw new Error("No text could be extracted (is it a scanned PDF?)");
  }

  // 3. Re-uploading the same filename replaces its old chunks instead of duplicating them
  await pool.query(
    `DELETE FROM documents WHERE session_id = $1 AND source = $2`,
    [sessionId, filename]
  );

  // 4. Embed and store each chunk, tagged with this session
  for (const chunk of chunks) {
    const vector = await embed(chunk);
    const vectorString = `[${vector.join(",")}]`;
    await pool.query(
      `INSERT INTO documents (content, source, embedding, session_id)
       VALUES ($1, $2, $3::vector, $4)`,
      [chunk, filename, vectorString, sessionId]
    );
  }

  return chunks.length;
}