// Sentence-aware chunking, shared by ingest.js and upload-ingest.js
export function chunkText(text, sentencesPerChunk = 3, overlapSentences = 1) {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  const chunks = [];
  const step = sentencesPerChunk - overlapSentences;
  for (let i = 0; i < sentences.length; i += step) {
    const chunk = sentences.slice(i, i + sentencesPerChunk).join(" ").trim();
    if (chunk) chunks.push(chunk);
    if (i + sentencesPerChunk >= sentences.length) break;
  }
  return chunks;
}
