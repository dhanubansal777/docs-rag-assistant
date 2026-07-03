import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function App() {
  // A stable per-user session id, persisted so a refresh keeps your uploads
  const [sessionId] = useState(() => {
    let id = localStorage.getItem("rag_session_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("rag_session_id", id);
    }
    return id;
  });

  // Upload state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Q&A state
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");

  const hasDocuments = uploadedFiles.length > 0;

  // The source of truth for "what's uploaded" is the server, not local state —
  // otherwise a page refresh (or documents left over from a previous session) looks invisible.
  const refreshDocuments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/documents?sessionId=${sessionId}`);
      if (!res.ok) return;
      const data = await res.json();
      setUploadedFiles(data.documents || []);
    } catch {
      // Silently ignore — the upload/ask flows surface their own connectivity errors
    }
  }, [sessionId]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`${API_BASE}/api/documents?sessionId=${sessionId}`).catch(() => null);
      if (ignore || !res?.ok) return;
      const data = await res.json();
      setUploadedFiles(data.documents || []);
    })();
    return () => {
      ignore = true;
    };
  }, [sessionId]);

  async function handleDeleteDocument(source) {
    try {
      await fetch(`${API_BASE}/api/documents?sessionId=${sessionId}&source=${encodeURIComponent(source)}`, {
        method: "DELETE",
      });
      await refreshDocuments();
    } catch {
      setUploadError("Could not delete that document. Is the backend running?");
    }
  }

  async function handleClearSession() {
    try {
      await fetch(`${API_BASE}/api/session?sessionId=${sessionId}`, { method: "DELETE" });
      await refreshDocuments();
      setAnswer("");
      setSources([]);
    } catch {
      setUploadError("Could not clear the session. Is the backend running?");
    }
  }

  function handleFileSelect(e) {
    setSelectedFiles(Array.from(e.target.files));
    setUploadError("");
  }

  function handleDrop(e) {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf")
    );
    setSelectedFiles(dropped);
    setUploadError("");
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));
      formData.append("sessionId", sessionId);

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData, // no Content-Type header — the browser sets it for FormData
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }

      await refreshDocuments();
      setSelectedFiles([]);
    } catch (err) {
      setUploadError(err.message || "Upload failed. Is the backend running?");
    } finally {
      setUploading(false);
    }
  }

  async function handleAsk() {
    const trimmed = question.trim();
    if (!trimmed) return;

    setAsking(true);
    setAskError("");
    setAnswer("");
    setSources([]);

    try {
      const res = await fetch(`${API_BASE}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, sessionId }),
      });

      if (!res.ok) throw new Error("Server error");

      const data = await res.json();
      setAnswer(data.answer);
      setSources(data.sources || []);
    } catch {
      setAskError("Could not get an answer. Is the backend running on port 5000?");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Grid background pattern */}
      <div className="fixed inset-0 -z-10 opacity-5">
        <div className="h-full w-full" style={{
          backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(255,255,255,.05) 25%, rgba(255,255,255,.05) 26%, transparent 27%, transparent 74%, rgba(255,255,255,.05) 75%, rgba(255,255,255,.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255,255,255,.05) 25%, rgba(255,255,255,.05) 26%, transparent 27%, transparent 74%, rgba(255,255,255,.05) 75%, rgba(255,255,255,.05) 76%, transparent 77%, transparent)',
          backgroundSize: '50px 50px'
        }}/>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-16">
        {/* Header */}
        <header className="mb-16 text-center">
          <div className="mb-6 inline-flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm border border-white/20">
            <div className="h-2 w-2 rounded-full bg-blue-400"></div>
            <span className="text-sm font-medium text-blue-300">AI-Powered Document Q&A</span>
          </div>
          <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-white via-blue-200 to-white bg-clip-text text-transparent">
            Docs Assistant
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            Upload PDFs and get instant answers powered by AI. Every answer is grounded in your documents.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Upload section */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 border border-blue-500/50">
                <span className="text-sm font-bold text-blue-300">1</span>
              </div>
              <h2 className="text-xl font-semibold text-white">Upload Documents</h2>
            </div>

            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="block cursor-pointer rounded-2xl border-2 border-dashed border-white/20 bg-white/5 px-8 py-12 text-center transition hover:border-blue-400/50 hover:bg-blue-500/5 backdrop-blur-sm group"
            >
              <svg className="mx-auto h-12 w-12 text-blue-400/60 group-hover:text-blue-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 1110.233-2.33A4.5 4.5 0 016.75 19.5" />
              </svg>
              <span className="mt-4 block text-sm font-medium text-white">
                Drop PDFs here or browse
              </span>
              <span className="mt-1 block text-xs text-slate-400">Multiple files welcome</span>
              <input type="file" accept="application/pdf" multiple className="hidden" onChange={handleFileSelect} />
            </label>

            {selectedFiles.length > 0 && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-slate-300">
                  <span className="font-semibold text-white">{selectedFiles.length}</span> file(s) selected
                </p>
                <p className="mt-2 text-xs text-slate-400 line-clamp-2">
                  {selectedFiles.map((f) => f.name).join(", ")}
                </p>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="mt-3 w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? "Processing..." : "Upload & Process"}
                </button>
              </div>
            )}

            {uploadError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300 backdrop-blur-sm">
                {uploadError}
              </div>
            )}

            {uploadedFiles.length > 0 && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400 uppercase">Your Documents</p>
                  <button
                    onClick={handleClearSession}
                    className="text-xs font-medium text-red-300 hover:text-red-200 transition"
                  >
                    Clear all
                  </button>
                </div>
                <ul className="space-y-2">
                  {uploadedFiles.map((f) => (
                    <li key={f.source} className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-4 py-3 backdrop-blur-sm hover:bg-white/10 transition">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-500/20">
                          <svg className="h-4 w-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8.75 1A1.75 1.75 0 007 2.75v14.5c0 .966.784 1.75 1.75 1.75h3.5a.75.75 0 000-1.5h-3.5a.25.25 0 01-.25-.25V2.75a.25.25 0 01.25-.25h3.5a.75.75 0 000-1.5h-3.5z"/>
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-white">{f.source}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">{f.chunks} chunks</span>
                        <button
                          onClick={() => handleDeleteDocument(f.source)}
                          aria-label={`Remove ${f.source}`}
                          className="text-slate-500 hover:text-red-300 transition"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Q&A section */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/50">
                <span className="text-sm font-bold text-emerald-300">2</span>
              </div>
              <h2 className="text-xl font-semibold text-white">Ask Questions</h2>
            </div>

            {!hasDocuments && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-6 text-center backdrop-blur-sm">
                <svg className="mx-auto h-12 w-12 text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-slate-400">Upload documents to start asking questions</p>
              </div>
            )}

            {hasDocuments && (
              <>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                    placeholder="What do you want to know?"
                    className="flex-1 rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent backdrop-blur-sm transition"
                  />
                  <button
                    onClick={handleAsk}
                    disabled={asking}
                    className="rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-3 font-semibold text-white transition hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {asking ? "..." : "Ask"}
                  </button>
                </div>

                {askError && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-300 backdrop-blur-sm">
                    {askError}
                  </div>
                )}

                {answer && (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">Answer</h3>
                      <p className="leading-relaxed text-slate-100 whitespace-pre-line text-sm">{answer}</p>
                    </div>

                    {sources.length > 0 && (
                      <div className="border-t border-white/10 pt-4">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">Sources</h4>
                        <ul className="space-y-2">
                          {sources.map((s, i) => (
                            <li key={i} className="rounded-lg bg-white/5 border border-white/10 p-3 text-xs">
                              <span className="font-medium text-blue-300">{s.source}</span>
                              {s.snippet && (
                                <p className="mt-1 text-slate-400 italic line-clamp-2">&quot;{s.snippet}&quot;</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}