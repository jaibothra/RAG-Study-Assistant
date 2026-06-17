# Document Q&A with RAG

A retrieval-augmented generation pipeline that ingests your own documents (PDF, CSV, Word, Excel, and more), finds the most relevant passages, and answers questions with a fast LLM — grounded in your files, not generic web knowledge.

## Stack

| Layer | Technology | Role |
|-------|------------|------|
| **Ingestion** | LangChain Community loaders | Parse PDFs, CSVs, DOCX, XLSX, TXT, JSON into structured documents |
| **Chunking** | LangChain `RecursiveCharacterTextSplitter` | Split long docs into overlapping segments for better retrieval |
| **Embeddings** | Sentence Transformers (`all-MiniLM-L6-v2`) | Turn text chunks into dense vectors for semantic search |
| **Vector store** | FAISS | Local, high-performance similarity search over embeddings (persisted per study space on disk) |
| **LLM / Rewrite / Titling** | Groq + Llama 3.3 | Answer generation, follow-up query rewrite, and first-message session title generation |
| **Persistent memory** | Supabase (`sessions`, `messages`) | Durable per-space, multi-session chat history and message storage |
| **API** | FastAPI | REST backend for spaces, uploads, sessions, chat, and document management |
| **UI** | React + TypeScript + Vite + Zustand + React Query | Multi-space chat UI with persistent active session state |

End-to-end flow: **load → chunk → embed → index → retrieve top-k → prompt LLM with context**.

## Run it

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt   # first time only
```

Create `.env` in the project root with:

- `GROQ_API_KEY=...` ([Groq Console](https://console.groq.com/keys))
- `SUPABASE_URL=...`
- `SUPABASE_ANON_KEY=...`

```powershell
# terminal 1 — backend
.\.venv\Scripts\uvicorn.exe server:app --reload --port 8000

# terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Use the project venv (`.\.venv\Scripts\python.exe`) — system Python does not have the dependencies.

## How to use

1. **Create/select a study space** — Each space has isolated documents, FAISS index files, and session lists.

2. **Upload documents** — Drag and drop or click the upload area in the sidebar. Supported formats: PDF, DOCX, TXT, CSV, XLSX. The space FAISS index rebuilds automatically after each upload.

3. **Manage files** — Click a document to preview it in a slide-over panel (PDF viewer or text excerpt, with search). Use the three-dot menu to rename or delete files. Deleting also triggers a re-index.

4. **Chat with sessions** — Each space supports multiple named sessions:
   - `+ New Session` starts a fresh conversation (session is created on first message).
   - Click any past session in the sidebar to resume its messages.
   - Session titles are generated automatically from the first user question.
   - Session history is persisted in Supabase and survives backend restarts.

5. **Study with your notes** — Examples of what you can ask:
   - *“Summarize chapter 3 of my operating systems notes”*
   - *“Generate 5 exam questions from this PDF”*
   - *“Explain preemptive scheduling in simple terms”*
   - *“What are the main topics covered in my uploaded files?”*

Answers include **Sources Used** so you can see which file(s) the response came from. You can copy or regenerate the last reply.

## Project structure

```
RAG/
├── server.py           FastAPI backend (spaces, sessions, upload, chat, documents)
├── app.py              CLI entry point (optional)
├── frontend/           React + TypeScript UI
│   └── src/
│       ├── api/        typed HTTP client
│       ├── components/ sidebar, chat, upload, preview
│       └── store/      chat + session + UI state
├── src/
│   ├── data_loader.py  multi-format ingestion
│   ├── embedding.py    chunk + embed
│   ├── vector_store.py FAISS persistence
│   ├── rag.py          retrieval + Groq Q&A
│   ├── memory.py       Supabase-backed session/message storage
│   └── supabase_client.py
├── data/               uploaded documents (gitignored)
├── faiss_store/        generated index (gitignored)
├── .env
└── requirements.txt
```

## Git / privacy

- `data/` — document contents are **gitignored** (only `.gitkeep` is tracked)
- `faiss_store/` — generated vectors, gitignored
- `.env` — API keys, gitignored
