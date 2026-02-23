# LangGraph Document Chatbot

A **conversation + attachment-based chatbot** using LangGraph: document uploads (PDF/TXT), chunking, vector storage, retrieval-based answering, and switchable LLM (local Ollama or Bytez API).

---

## Project structure

```
langraph/
├── backend/                 # Python FastAPI + LangGraph
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/      # chat, documents
│   │   ├── core/            # chunking, embeddings, llm_factory
│   │   ├── graph/           # LangGraph workflow & nodes
│   │   ├── models/          # Pydantic schemas
│   │   ├── services/        # document_service, vector_store
│   │   ├── config.py        # env-based settings
│   │   └── main.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/                # Next.js 14
│   ├── app/                 # layout, page, globals.css
│   ├── components/          # Chat, FileUpload
│   ├── lib/                 # api client
│   └── package.json
└── README.md
```

---

## Section I – Conceptual understanding

### 1. How LangGraph differs from a simple LLM chat pipeline

- **Simple pipeline**: single path — user input → prompt → LLM → response.
- **LangGraph**: a **stateful graph** of nodes and edges. You can:
  - **Route** conditionally (e.g. “needs documents” vs “general chat”).
  - **Add steps** like retrieval, tool use, or multi-step reasoning.
  - **Keep state** (e.g. conversation history, context) across nodes.
  - **Loop** or branch (retrieve → generate → maybe retrieve again).

So LangGraph is a workflow/orchestration layer around the LLM, not just a single call.

### 2. Document chunking and why it matters for large files

- **Chunking** = splitting a document into smaller segments (e.g. 500–1500 tokens) with optional overlap.
- **Why**: LLMs have limited context windows. Large files can’t be sent whole; chunks are embedded and only the **relevant** chunks are retrieved and sent. Chunking also improves retrieval quality (finer-grained matches) and keeps prompts within limits.

### 3. Conversation memory vs document memory

- **Conversation memory**: per-session chat history (user/assistant turns). Used so the LLM can refer to what was said earlier in the same session. Stored as a list of messages, keyed by `session_id`.
- **Document memory**: stored **document chunks** (and their embeddings) in a vector DB. Used for RAG: “which parts of uploaded docs are relevant to this question?” It’s long-term, not tied to a single conversation.

### 4. Why vector-based retrieval over sending full documents

- **Context limit**: Full documents often exceed the model’s context window.
- **Relevance**: Only the most similar chunks are sent, reducing noise and cost.
- **Speed/cost**: Fewer tokens per request.
- **Scalability**: Vector search (e.g. Pinecone) scales to many documents; sending everything each time does not.

### 5. When to choose local LLM vs external API (e.g. Bytez)

- **Local LLM (e.g. Ollama)**: No API cost, data stays on your machine, good for prototyping and privacy; limited by hardware (speed, model size) and often weaker than top cloud models.
- **External API (Bytez)**: Stronger models, no local GPU needed, scalable; requires API key, network, and trusting the provider with data. Choose local for privacy/offline/prototyping; choose Bytez (or similar) for better quality and when you’re okay with sending data to an API.

---

## Section II – Attachment processing & memory

### 1. Pipeline from document upload to stored chunks

1. **Upload**: API receives file (PDF/TXT) and optional `subject`.
2. **Parse**: PDF → PyPDFLoader / raw bytes → text; TXT → decode to text.
3. **Chunk**: `RecursiveCharacterTextSplitter` (configurable `chunk_size`, `chunk_overlap`).
4. **Metadata**: Each chunk gets `doc_id`, `filename`, `subject`, `chunk_index`.
5. **Embed**: Chunk text with the chosen embedding model (e.g. sentence-transformers or OpenAI).
6. **Store**: Chunks + metadata are added to Pinecone (vector store).

### 2. Handling multiple documents (e.g. science, maths, biology)

- Assign a **subject** (or topic) at upload (e.g. “science”, “maths”, “biology”).
- Store `subject` in chunk **metadata**.
- At query time, optionally pass a **subject filter** so retrieval only considers chunks with that subject. That way answers for “biology” don’t use maths or science chunks.

### 3. Metadata stored with each chunk (and why)

- **doc_id**: Which document the chunk came from (traceability, deletion).
- **filename**: Human-readable source (shown in UI/sources).
- **subject**: Filtering by topic so unrelated docs aren’t used.
- **chunk_index**: Order within the document (for ordering or pagination).

### 4. Preventing unrelated documents from being used

- **Subject filter**: When the user (or UI) specifies a subject, retrieval uses a metadata filter (e.g. `subject == "biology"`) so only chunks from that subject are returned.
- **No filter**: All chunks are searchable; relevance is then purely by vector similarity. For stricter separation, always set and use `subject` (or similar) per document and per query.

---

## Section III – LangGraph workflow design

### 1. Workflow for handling questions after documents are uploaded

- **Start** → **Route**: Decide “retrieve from docs” vs “general chat”.
- **Retrieve** (if needed): Query vector store with user question (and optional subject filter); put top-k chunks into state as `context`.
- **Generate**: Build a prompt with system (instruction + context), conversation history, and current question; call LLM; append user message and assistant reply to conversation state.
- **End**: Return assistant message to the client.

### 2. Nodes and responsibilities

- **Router (conditional edge)**: Reads `use_documents` and question; returns “retrieve” or “generate”.
- **Retrieve**: Runs similarity search; writes `context` into state.
- **Generate**: Takes `messages`, `context`, `question`; runs LLM; returns updated `messages`.

### 3. Conditional routing based on user question

- Implemented as a **conditional edge** from start: a function `route_question(state)` returns `"retrieve"` or `"generate"`.
- Logic: if `use_documents` is false → `"generate"`. If question is a short greeting (“hi”, “hello”, etc.) → `"generate"`. Otherwise → `"retrieve"`.

### 4. How conversation history is maintained

- **State** holds `messages` (list of LangChain `BaseMessage`).
- Each request: load messages for `session_id` from store (e.g. in-memory dict; production: Redis/DB).
- Run graph with that state; **generate** node appends the new user message and the new assistant message to `messages`.
- After the run, **save** the updated `messages` back keyed by `session_id`. Next turn for the same session gets full history.

---

## Section IV – LLM integration

### 1. Integrating a local LLM (e.g. Ollama) into the workflow

- Use **LangChain’s `ChatOllama`** with `base_url` (e.g. `http://localhost:11434`) and `model`.
- The **same** graph calls `get_llm()` and uses it in the generate node. No graph logic change when switching providers.

### 2. Limitations of running an LLM locally on a laptop

- **Speed**: Slower than cloud GPUs.
- **Model size**: Large models may not fit in RAM or need heavy quantization.
- **Quality**: Smaller local models are usually weaker than large API models.
- **Resource usage**: CPU/GPU and battery impact.

### 3. Switching from local LLM to Bytez without changing workflow logic

- **Single factory**: One place (e.g. `app/core/llm_factory.py`) returns the LLM. Both Ollama and Bytez are exposed as a LangChain `ChatModel` (e.g. `ChatOpenAI` with Bytez’s base URL and API key).
- **Config**: Set `LLM_PROVIDER=bytez` and Bytez credentials in env. The graph and nodes stay the same; only the factory’s return value changes.

### 4. Configuration to externalize (e.g. environment variables)

- **LLM**: `LLM_PROVIDER`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `BYTEZ_API_KEY`, `BYTEZ_BASE_URL`, `BYTEZ_MODEL`.
- **Embeddings**: `EMBEDDING_PROVIDER`, `OPENAI_API_KEY` (if using OpenAI embeddings).
- **Vector store**: Pinecone (`PINECONE_API_KEY`, `PINECONE_INDEX_NAME`, `PINECONE_INDEX_DIMENSION`, `PINECONE_CLOUD`, `PINECONE_REGION`). Index is created automatically if it does not exist.
- **Chunking**: `CHUNK_SIZE`, `CHUNK_OVERLAP`.

All are in `backend/app/config.py` and loaded from env (e.g. `.env`).

---

## Section V – Practical Tasks (verification)

| # | Task | Status | Where |
|---|------|--------|--------|
| 1 | **Document upload** accepting PDF or TXT | Done | Backend: `POST /documents/upload` (`.pdf`, `.txt`). Frontend: `FileUpload` sends file as **multipart form-data**. |
| 2 | **Chunk and store** in vector database | Done | `document_service.py`: extract text → `chunk_text()` → `add_chunks()` to **Pinecone**. |
| 3 | **LangGraph workflow** that answers using uploaded documents | Done | `graph/workflow.py` + `graph/nodes.py`: route → retrieve (vector search) → generate (LLM). Chat uses this graph. |
| 4 | **Switch between local LLM and Bytez API** | Done | See subsection below. No workflow change; only `LLM_PROVIDER` and env vars. |
| 5 | **Short README** with architecture and setup | Done | This file: structure, setup, API, architecture. |

### 4. Demonstrating switching between local LLM and Bytez API

Switching is done **only via configuration**; no code or workflow changes.

**Use a local LLM (Ollama):**

1. Install and run [Ollama](https://ollama.ai), then e.g. `ollama pull llama3.2`.
2. In `backend/.env` set:
   ```env
   LLM_PROVIDER=local
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.2
   ```
3. Restart the backend: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.
4. **Verify**: Open the app, send a message; the chat header shows **LLM: local**. Or call `GET http://localhost:8000/config/llm` → `{"provider":"local"}`.

**Use Bytez (or any OpenAI-compatible API):**

1. In `backend/.env` set:
   ```env
   LLM_PROVIDER=bytez
   BYTEZ_API_KEY=your-bytez-or-api-key
   BYTEZ_BASE_URL=https://api.bytez.com/v1
   BYTEZ_MODEL=gpt-4
   ```
2. Restart the backend.
3. **Verify**: Chat header shows **LLM: bytez** or call `GET /config/llm` → `{"provider":"bytez"}`.

**Optional: use OpenAI directly** – set `LLM_PROVIDER=openai` and `OPENAI_API_KEY`; same workflow, different provider.

The **same LangGraph workflow** (route → retrieve → generate) runs in all cases; only `app/core/llm_factory.py` returns a different LLM based on `LLM_PROVIDER`.

---

## Section V – Practical setup and run

### Prerequisites

- **Backend**: Python 3.10+, Ollama (optional, for local LLM).
- **Frontend**: Node 18+.

**Pinecone**: Sign up at [pinecone.io](https://www.pinecone.io/), create an API key, and set `PINECONE_API_KEY` in `.env`. The index is created automatically with the configured dimension (384 for default embeddings).

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # Linux/macOS
pip install -r requirements.txt
cp .env.example .env
# Edit .env: set LLM_PROVIDER=local or bytez, and BYTEZ_API_KEY if using Bytez.
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- **Local LLM**: Install and run [Ollama](https://ollama.ai), then pull a model (e.g. `ollama pull llama3.2`).
- **Bytez**: Set `LLM_PROVIDER=bytez`, `BYTEZ_API_KEY`, and optionally `BYTEZ_BASE_URL`/`BYTEZ_MODEL` in `.env`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The app proxies `/api/backend/*` to `http://localhost:8000`.

### What you can do

1. **Upload documents**: PDF or TXT; optional subject (e.g. science, maths).
2. **Chat**: Ask questions; with “Use uploaded documents” checked, the graph retrieves chunks and answers using them.
3. **Switch LLM**: Change `LLM_PROVIDER` in backend `.env` and restart; no code change.

### API summary

- `POST /documents/upload`: **multipart form-data** `file` (PDF/TXT), optional `subject` → chunk and store in vector DB.
- `POST /chat/`: JSON `{ "message", "session_id?", "use_documents?", "subject_filter?" }` → LangGraph run → `{ "reply", "session_id" }`.
- `GET /config/llm`: returns `{ "provider": "openai"|"bytez"|"local" }` – use this (or the chat UI label) to **verify** which LLM is active when demonstrating switching.
- `GET /health`: health and current LLM provider.

---

## Architecture (high level)

- **Frontend (Next.js)**: Single page with file upload (and optional subject) and chat. Uses `/api/backend` rewrite to talk to the Python backend.
- **Backend (FastAPI)**:
  - **Documents**: Upload → parse → chunk → embed → Pinecone.
  - **Chat**: Load session messages → LangGraph (route → optional retrieve → generate) → save messages → return reply.
- **LLM**: Chosen in one place (`llm_factory`) from env; graph is provider-agnostic.
- **Memory**: Conversation = in-memory per `session_id` (replace with Redis/DB for production); document memory = Pinecone with optional subject metadata for filtering.

This matches the requested design: document upload (PDF/TXT), chunking, vector storage, retrieval, conversation memory, and switchable local vs Bytez LLM, with a clear FE (Next.js) and BE (Python) layout and a single README for concepts and setup.
