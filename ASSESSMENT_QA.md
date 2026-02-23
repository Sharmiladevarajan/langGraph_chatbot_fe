# Assessment – Questions & Answers  
**LangGraph Document Chatbot**  

## Section I – Conceptual Understanding

### 1. Explain how LangGraph differs from a simple LLM chat pipeline.

In a **simple LLM chat pipeline**, you basically do: user message → one prompt → call the LLM once → return the reply. It’s a single, straight path.

**LangGraph** is different because it models the flow as a **graph**: you have multiple **nodes** (steps) and **edges** (how control moves between them). So you can:

- **Route** based on conditions (e.g. “does this need document lookup or just general chat?”).
- **Add steps** like retrieval from a vector store, tool calls, or extra reasoning.
- **Keep state** (e.g. conversation history, retrieved context) as you move from node to node.
- **Loop or branch** (e.g. retrieve → generate → maybe retrieve again).

So LangGraph is a **workflow layer** around the LLM: the same chat “idea” but with routing, retrieval, and state—not just one direct call.

---

### 2. What is document chunking and why is it important for large files?

**Chunking** means splitting a long document into smaller pieces (e.g. a few hundred to a couple of thousand tokens each), often with a small **overlap** between consecutive chunks.

It’s important for large files because:

- **Context limit:** LLMs have a fixed context window. You can’t paste an entire large PDF; you’d exceed the limit.
- **Relevance:** Smaller chunks let you retrieve only the **relevant** parts for a question instead of sending everything.
- **Cost and speed:** Sending fewer, focused tokens per request is cheaper and faster.
- **Quality:** Finer-grained chunks usually give better retrieval and more precise answers.

So chunking is what makes it practical to use large documents with a limited-context LLM.

---

### 3. Describe how conversation memory and document memory are different.

**Conversation memory** is the **chat history** for a given user/session: the list of “user said this, assistant said that” for the current conversation. It’s used so the model can refer back to what was already discussed (e.g. “as I said earlier”). It’s **short-term**, per session, and usually stored as messages keyed by something like `session_id`.

**Document memory** is the **stored content from uploaded files**: the text (and often embeddings) of document chunks in a vector store. It’s used for **retrieval**: “which parts of the uploaded docs are relevant to this question?” It’s **long-term**, not tied to a single chat, and doesn’t change when the user sends a new message—only when new documents are uploaded or removed.

So: conversation memory = “what we’ve been talking about”; document memory = “what’s in the uploaded documents.”

---

### 4. Why is vector-based retrieval preferred over sending full documents to an LLM?

- **Context limit:** Full documents often exceed the model’s context window, so you can’t send them as-is.
- **Relevance:** Vector search (e.g. with embeddings) returns only the chunks most similar to the question, so the model sees **relevant** text instead of the whole doc.
- **Cost and speed:** Fewer tokens per request means lower cost and faster responses.
- **Scale:** With many documents, you can’t send everything each time; vector stores are built to search over large sets of chunks quickly.

So vector-based retrieval is preferred because it keeps responses within context limits, focused, and scalable.

---

### 5. Explain when you would choose a local LLM versus an external API like Bytez.

**Local LLM (e.g. Ollama):**

- Good when you care about **privacy** or **offline** use; data never leaves the machine.
- No per-request API cost; useful for **experimentation** and **development**.
- Downside: needs your own hardware; often **slower** and **weaker** than big cloud models; limited by RAM/GPU.

**External API (e.g. Bytez):**

- Good when you want **stronger models** and **no local GPU**; someone else runs the infra.
- Easier to **scale** and often **faster**; you can switch models or providers.
- Downside: you need network, API keys, and you’re sending data to a third party.

**In short:** choose **local** when privacy, cost control, or offline use matter; choose **Bytez (or similar)** when you want better quality and are okay with using an external API.

---

## Section II – Attachment Processing & Memory

### 1. Describe the full pipeline from document upload to storing chunks in memory.

The pipeline is:

1. **Upload:** The user uploads a file (e.g. PDF or TXT) via the app; the backend receives it (and optionally a “subject” or topic).
2. **Parse:** We extract raw text—e.g. from PDF with a PDF library, from TXT by decoding.
3. **Chunk:** A text splitter (e.g. recursive character splitter) splits the text into chunks of a fixed size (and overlap), so we get many small segments.
4. **Metadata:** Each chunk is tagged with metadata (e.g. `doc_id`, `filename`, `subject`, `chunk_index`).
5. **Embed:** Each chunk is passed through an embedding model to get a vector.
6. **Store:** Vectors and metadata are written to a vector store (e.g. Pinecone). That’s “storing chunks in memory” (vector memory).

So end-to-end: **upload → parse → chunk → add metadata → embed → store in vector DB.**

---

### 2. How would you handle multiple documents belonging to different subjects (e.g. science, maths, biology)?

- At **upload time**, we assign a **subject** (or topic) to each document—e.g. “science”, “maths”, “biology”—and store it in the chunk **metadata**.
- At **query time**, we can pass a **subject filter**: e.g. “only search within chunks whose subject is biology.” The vector store (or our retrieval layer) then returns only chunks that match that subject.
- So answers for a biology question use only biology chunks; maths and science chunks are not mixed in unless we don’t use a filter. That’s how we handle multiple subjects.

---

### 3. What metadata would you store along with each document chunk and why?

Typical metadata:

- **`doc_id`:** Which document the chunk came from. Useful for tracing, deletion, or “show me the source doc.”
- **`filename`:** Human-readable name (e.g. for “Source: report.pdf” in the UI).
- **`subject`:** Topic/category (e.g. science, maths). Used to **filter** retrieval so we don’t mix subjects.
- **`chunk_index`:** Position of the chunk in the document. Useful for ordering or “chunk 3 of 10.”

So we store whatever is needed for **filtering**, **attribution**, and **ordering**—without overloading the chunk with unnecessary data.

---

### 4. How do you prevent unrelated documents from being used when answering a user question?

- **Subject (or topic) filter:** If the user or the system knows the subject (e.g. “biology”), we run retrieval with a **metadata filter** so only chunks with that subject are considered. Then the model never sees chunks from other subjects.
- **No filter:** If we don’t filter, retrieval is purely by **similarity**. Unrelated docs can still appear if their chunks happen to be similar to the query. To reduce that, we rely on good **subject tagging** at upload and, when possible, **passing a subject** at query time (from the UI or from a classifier).

So the main lever is **metadata-based filtering** (e.g. by subject) so that only relevant documents are retrieved.

---

## Section III – LangGraph Workflow Design

### 1. Design a LangGraph workflow for handling user questions after documents are uploaded.

A simple design:

1. **Start** → **Route:** Decide whether this turn needs document retrieval or is general chat (e.g. greetings).
2. **If retrieval needed:** **Retrieve** node runs: take the user question, (optionally) subject filter, query the vector store, get top-k chunks, and put them in state as “context.”
3. **Generate** node: Build a prompt from (a) system instruction + retrieved context, (b) conversation history, (c) current user message. Call the LLM, get the reply, and append both user message and assistant reply to the conversation state.
4. **End** → return the assistant’s reply to the client.

So the workflow is: **route → (optional) retrieve → generate → end**, with state carrying messages and context.

---

### 2. What nodes would you include in the graph and what is the responsibility of each node?

- **Router (conditional edge):** Not a separate “node” but a **routing function** on the start. It looks at the question and flags (e.g. “use documents” or not) and decides: go to **retrieve** or directly to **generate**. Responsibility: **decide the path**.
- **Retrieve node:** Takes the user question (and optional subject filter) from state, runs **similarity search** on the vector store, and writes the top-k chunks into state as “context.” Responsibility: **fill context** from documents.
- **Generate node:** Reads from state: messages (history), context, and current question. Builds the prompt, calls the **LLM**, and updates state with the new user message and the model’s reply. Responsibility: **produce the answer** and **update conversation history**.

So: **router** = path choice; **retrieve** = get doc chunks; **generate** = call LLM and update history.

---

### 3. How would you implement conditional routing based on the user’s question?

- We use the graph’s **conditional edge** from the start. A function (e.g. `route_question(state)`) reads the state and returns one of a few labels (e.g. `"retrieve"` or `"generate"`).
- **Logic** can be:
  - If the user has turned off “use documents” for this turn → go to **generate** (no retrieval).
  - If the question is a short greeting (e.g. “hi”, “thanks”) → go to **generate**.
  - Otherwise → go to **retrieve** first, then to **generate**.
- The graph is wired so that each return value maps to the right node(s). So routing is “one function, multiple exits” based on the user’s question and settings.

---

### 4. Explain how conversation history is maintained across turns.

- **State:** The graph’s state holds a **messages** list (e.g. LangChain `BaseMessage` objects: user and assistant turns).
- **Per request:** When a request comes in, we identify the session (e.g. via `session_id`). We load the **existing messages** for that session from our store (e.g. in-memory dict or Redis) and pass them into the graph as initial state.
- **During the run:** The **generate** node takes that history, adds the **current user message**, calls the LLM, gets the reply, and **appends** both the new user message and the new assistant message to the messages list.
- **After the run:** We **save** the updated messages list back to the store, keyed by `session_id`. The next turn for the same session loads this updated list, so history is maintained across turns.

So: **load by session_id → run graph (which appends new messages) → save back by session_id.**

---

## Section IV – LLM Integration

### 1. Explain how a local LLM can be integrated into the LangGraph workflow.

- We use a **single place** (e.g. an LLM factory) that returns the chat model used in the **generate** node. For a local LLM we return a client that talks to the local service (e.g. **Ollama** via LangChain’s `ChatOllama`), with the right `base_url` (e.g. `http://localhost:11434`) and model name.
- The **rest of the graph** (retrieve, prompt building, state) stays the same; only “which LLM to call” changes. So we plug in the local LLM by configuring that factory (e.g. via env: “use local” and Ollama URL/model). No change to workflow logic.

---

### 2. What are the limitations of running an LLM locally on a laptop?

- **Speed:** Usually slower than cloud GPUs; responses can feel delayed.
- **Model size:** Large models may not fit in RAM or need heavy quantization, which can hurt quality.
- **Quality:** Smaller local models are often weaker than large API models for complex tasks.
- **Resource usage:** High CPU/GPU and battery use; the machine can get hot and slow for other work.
- **Setup:** User has to install and run the local runtime (e.g. Ollama) and pull models.

So the main limitations are **performance**, **model size/quality**, and **user setup**.

---

### 3. How would you switch the chatbot from a local LLM to Bytez API without changing the workflow logic?

- **Single abstraction:** The graph always gets the LLM from one place (e.g. `get_llm()` in a factory). That function reads config (e.g. env or runtime choice) and returns either a **local** client (e.g. ChatOllama) or an **API** client (e.g. ChatOpenAI configured with Bytez base URL and key). Both expose the same interface (e.g. LangChain `ChatModel`).
- **Config only:** To switch, we only change **configuration** (e.g. `LLM_PROVIDER=bytez`, `BYTEZ_API_KEY`, `BYTEZ_BASE_URL`, `BYTEZ_MODEL`). The graph and nodes are unchanged; only the factory’s return value changes. So we switch by **config**, not by rewriting workflow logic.

---

### 4. What configuration options should be externalized (e.g. environment variables)? Either in BE or FE.

**Backend (BE):**

- **LLM:** Provider (e.g. `LLM_PROVIDER`), Ollama URL and model, Bytez (or OpenAI-compatible) API key, base URL, model name.
- **Embeddings:** Provider (e.g. `EMBEDDING_PROVIDER`), API key if using cloud embeddings, embedding model name.
- **Vector store:** e.g. Pinecone API key, index name, dimension, cloud/region (or equivalent for another store).
- **Chunking:** Chunk size and overlap.
- **App:** e.g. CORS origins (so we can allow the frontend URL in production).

**Frontend (FE):**

- **API base:** e.g. `NEXT_PUBLIC_API_URL` (or similar) so the frontend knows the backend URL in development vs production (e.g. Vercel vs Render).

These are externalized so we can **switch environments** (local vs production), **switch providers** (local vs Bytez vs OpenAI), and **keep secrets out of code** without changing logic in BE or FE.

---

*End of document.*
