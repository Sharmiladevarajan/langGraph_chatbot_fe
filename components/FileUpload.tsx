"use client";

import { useState, useRef } from "react";
import { uploadDocument, type UploadResponse } from "@/lib/api";

const ALLOWED = ".pdf, .txt";

export default function FileUpload({
  onUploaded,
}: {
  onUploaded?: (res: UploadResponse) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setMessage({ type: "err", text: "Select a file" });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await uploadDocument(file, subject || undefined);
      setMessage({ type: "ok", text: res.message });
      onUploaded?.(res);
      setFile(null);
      setSubject("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="upload-form"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "1.25rem",
        marginBottom: "1rem",
      }}
    >
      <div style={{ marginBottom: "0.75rem" }}>
        <label
          htmlFor="doc-file"
          style={{
            display: "block",
            fontSize: "0.875rem",
            color: "var(--text-muted)",
            marginBottom: "0.25rem",
          }}
        >
          Document (PDF or TXT)
        </label>
        <input
          ref={inputRef}
          id="doc-file"
          type="file"
          accept=".pdf,.txt"
          onChange={handleFileChange}
          style={{
            width: "100%",
            padding: "0.5rem",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--text)",
          }}
        />
      </div>
      <div style={{ marginBottom: "0.75rem" }}>
        <label
          htmlFor="subject"
          style={{
            display: "block",
            fontSize: "0.875rem",
            color: "var(--text-muted)",
            marginBottom: "0.25rem",
          }}
        >
          Subject (optional, e.g. science, maths)
        </label>
        <input
          id="subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. biology"
          style={{
            width: "100%",
            padding: "0.5rem",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--text)",
          }}
        />
      </div>
      <button
        type="submit"
        disabled={loading || !file}
        style={{
          padding: "0.5rem 1rem",
          background: loading || !file ? "var(--border)" : "var(--accent)",
          color: "var(--text)",
          border: "none",
          borderRadius: "8px",
          fontWeight: 600,
        }}
      >
        {loading ? "Uploading…" : "Upload & index"}
      </button>
      {message && (
        <p
          style={{
            marginTop: "0.75rem",
            fontSize: "0.875rem",
            color: message.type === "ok" ? "var(--success)" : "var(--error)",
          }}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
