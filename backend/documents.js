import pg from "pg";
import "dotenv/config";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// List distinct documents stored for a session, in upload order
export async function listDocuments(sessionId) {
  const result = await pool.query(
    `SELECT source, count(*)::int AS chunks
     FROM documents
     WHERE session_id = $1
     GROUP BY source
     ORDER BY min(id) ASC`,
    [sessionId]
  );
  return result.rows;
}

// Delete one document (all its chunks) from a session
export async function deleteDocument(sessionId, source) {
  const result = await pool.query(
    `DELETE FROM documents WHERE session_id = $1 AND source = $2`,
    [sessionId, source]
  );
  return result.rowCount;
}

// Wipe every document in a session
export async function clearSession(sessionId) {
  const result = await pool.query(
    `DELETE FROM documents WHERE session_id = $1`,
    [sessionId]
  );
  return result.rowCount;
}
