# Docs Q&A Assistant

A retrieval-augmented generation (RAG) app: upload PDFs, ask questions in plain English, and get
answers grounded strictly in those documents — with source citations, and an explicit refusal
when the answer isn't in the uploaded docs.

## How it works

```
PDF upload ──▶ text extraction ──▶ sentence-aware chunking ──▶ Gemini embeddings ──▶ Postgres (pgvector)
                                                                                            │
question ──▶ embed question ──┬──▶ vector similarity search ──┐                            │
                               └──▶ Postgres full-text search ─┴──▶ Reciprocal Rank Fusion ──┤
                                                                                            ▼
                                                          top chunks stuffed into a Gemini prompt ──▶ answer + citations
```

- **Hybrid retrieval**: results from pgvector cosine similarity and Postgres full-text search
  (`tsvector`/`ts_rank`) are merged with Reciprocal Rank Fusion, so a chunk that ranks well on
  either semantic or keyword matching surfaces to the top ([backend/retrieval.js](backend/retrieval.js)).
- **Session-scoped**: every upload and query is tagged with a browser-generated `sessionId`, so
  users only ever query their own documents.
- **Grounded answers**: the prompt forces the model to answer only from retrieved context, or
  reply with a fixed refusal string if the answer isn't there ([backend/rag.js](backend/rag.js)).
- **Eval harness**: [backend/evaluate.js](backend/evaluate.js) measures retrieval hit-rate and
  refusal-rate against a labeled question set ([backend/eval-questions.js](backend/eval-questions.js)).

## Tech stack

- **Frontend**: React 19, Vite, Tailwind CSS
- **Backend**: Node.js, Express 5
- **Database**: PostgreSQL + [pgvector](https://github.com/pgvector/pgvector)
- **LLM**: Google Gemini (`gemini-2.5-flash` for answers, `gemini-embedding-001` for embeddings)

## Setup

### Prerequisites

- Node.js 20+
- A PostgreSQL database with the `pgvector` extension available
- A [Google Gemini API key](https://ai.google.dev/)

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in GEMINI_API_KEY and DATABASE_URL
psql "$DATABASE_URL" -f db/schema.sql
npm run dev             # starts on http://localhost:5000
```

Optional: seed the database with the sample docs in `backend/docs/`:

```bash
node ingest.js
```

### Frontend

```bash
cd frontend
npm install
npm run dev              # starts on http://localhost:5173
```

### Tests

```bash
cd backend
npm test
```

## API

| Endpoint | Method | Body | Description |
|---|---|---|---|
| `/api/upload` | POST | `multipart/form-data`: `files[]`, `sessionId` | Ingest one or more PDFs (max 10MB each, 5 per request). Re-uploading the same filename replaces its old chunks. |
| `/api/ask` | POST | `{ "question": string, "sessionId": string }` | Ask a question over the session's uploaded docs |
| `/api/documents?sessionId=` | GET | — | List documents currently stored for a session |
| `/api/documents?sessionId=&source=` | DELETE | — | Remove one document from a session |
| `/api/session?sessionId=` | DELETE | — | Wipe every document in a session |
| `/health` | GET | — | Health check |

All `/api/*` routes are rate-limited to 20 requests/minute per IP.
