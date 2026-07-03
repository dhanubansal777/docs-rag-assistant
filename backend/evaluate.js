import { hybridSearch } from "./retrieval.js";
import { answerQuestion } from "./rag.js";
import { answerable, unanswerable } from "./eval-questions.js";

// The exact refusal phrase we told the model to use in rag.js
const REFUSAL = "I don't have that information in the provided documents";

async function evaluate() {
  console.log("=== EVALUATION HARNESS ===\n");

  // --- Part 1: Retrieval quality on answerable questions ---
  console.log("--- Retrieval quality (did the right document come back?) ---");
  let retrievalHits = 0;

  for (const { question, expectedSource } of answerable) {
    const chunks = await hybridSearch(question);
    const retrievedSources = chunks.map((c) => c.source);
    const hit = retrievedSources.includes(expectedSource);
    if (hit) retrievalHits++;
    console.log(`${hit ? "✅" : "❌"}  ${question}`);
    if (!hit) {
      console.log(`     expected: ${expectedSource} | got: ${retrievedSources.join(", ")}`);
    }
  }

  const retrievalRate = ((retrievalHits / answerable.length) * 100).toFixed(0);
  console.log(`\nRetrieval hit-rate: ${retrievalHits}/${answerable.length} (${retrievalRate}%)\n`);

  // --- Part 2: Refusal correctness on unanswerable questions ---
  console.log("--- Refusal correctness (did it refuse when it should?) ---");
  let refusals = 0;

  for (const question of unanswerable) {
    const { answer } = await answerQuestion(question);
    const refused = answer.toLowerCase().includes(REFUSAL.toLowerCase());
    if (refused) refusals++;
    console.log(`${refused ? "✅" : "❌"}  ${question}`);
    if (!refused) {
      console.log(`     did NOT refuse — answered: ${answer.slice(0, 80)}...`);
    }
  }

  const refusalRate = ((refusals / unanswerable.length) * 100).toFixed(0);
  console.log(`\nRefusal rate: ${refusals}/${unanswerable.length} (${refusalRate}%)\n`);

  // --- Summary ---
  console.log("=== SUMMARY ===");
  console.log(`Retrieval hit-rate: ${retrievalRate}%`);
  console.log(`Refusal rate:       ${refusalRate}%`);

  process.exit(0); // close cleanly (pools stay open otherwise)
}

evaluate().catch((err) => {
  console.error("Eval failed:", err.message);
  process.exit(1);
});