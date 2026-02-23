import FileUpload from "@/components/FileUpload";
import Chat from "@/components/Chat";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "2rem",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>
          LangGraph Document Chatbot
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: "0.25rem" }}>
          Upload PDF or TXT files, then ask questions. Answers use your documents when relevant.
        </p>
      </header>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Upload documents</h2>
        <FileUpload />
      </section>

      <section style={{ height: "480px" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Chat</h2>
        <Chat />
      </section>
    </main>
  );
}
