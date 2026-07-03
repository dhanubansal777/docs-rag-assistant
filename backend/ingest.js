import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { PDFParse } from "pdf-parse"; // inner path avoids the ESM debug bug
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { chunkText } from "./chunkText.js";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Absolute path to the docs folder (sits next to this script)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, "docs");

// --- Embed one piece of text into a 768-number vector ---
async function embed(text) {
  const result = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 768 },
  });
  return result.embeddings[0].values;
}

// --- Pull the text out of one PDF file ---
async function extractPdfText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy(); // free the parser's resources
  return result.text;
}

// --- Main: loop every PDF -> chunk -> embed -> store ---
async function ingest() {
  try {
    // 1. Wipe old data so re-running stays clean
    await pool.query("DELETE FROM documents");
    console.log("Cleared old chunks.\n");

    // 2. Find every PDF in the docs folder
    const files = fs
      .readdirSync(DOCS_DIR)
      .filter((f) => f.toLowerCase().endsWith(".pdf"));

    if (files.length === 0) {
      console.log("No PDF files found in", DOCS_DIR);
      return;
    }
    console.log(`Found ${files.length} PDF(s): ${files.join(", ")}\n`);

    // 3. Process each PDF
    let totalChunks = 0;
    for (const file of files) {
      console.log(`Reading ${file}...`);
      const text = await extractPdfText(path.join(DOCS_DIR, file));
      const chunks = chunkText(text);
      console.log(`  -> split into ${chunks.length} chunks`);

      for (const chunk of chunks) {
        const vector = await embed(chunk);
        const vectorString = `[${vector.join(",")}]`;
        await pool.query(
          "INSERT INTO documents (content, source, embedding) VALUES ($1, $2, $3::vector)",
          [chunk, file, vectorString] // <- filename becomes the citation source
        );
        totalChunks++;
      }
      console.log(`  -> stored ${chunks.length} chunks from ${file}\n`);
    }

    console.log(`✅ Done! Stored ${totalChunks} chunks from ${files.length} PDF(s).`);
  } catch (err) {
    console.error("❌ Ingestion failed:", err.message);
  } finally {
    await pool.end();
  }
}

ingest();