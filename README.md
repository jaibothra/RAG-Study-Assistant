# Document Q&A with RAG

A retrieval-augmented generation pipeline that ingests your own documents (PDF, CSV, Word, Excel, and more), finds the most relevant passages, and answers questions with a fast LLM — grounded in your files, not generic web knowledge.

## Stack

| Layer | Technology | Role |
|-------|------------|------|
| **Ingestion** | LangChain Community loaders | Parse PDFs, CSVs, DOCX, XLSX, TXT, JSON into structured documents |
| **Chunking** | LangChain `RecursiveCharacterTextSplitter` | Split long docs into overlapping segments for better retrieval |
| **Embeddings** | Sentence Transformers (`all-MiniLM-L6-v2`) | Turn text chunks into dense vectors for semantic search |
| **Vector store** | FAISS | Local, high-performance similarity search over embeddings (persisted on disk) |
| **Generation** | Groq + Llama 3.3 | Low-latency answers from retrieved context only |
| **API** | FastAPI | REST backend for uploads, chat, and document management |
| **UI** | React + TypeScript + Vite | Dark-theme web app for document upload and chat |

End-to-end flow: **load → chunk → embed → index → retrieve top-k → prompt LLM with context**.

## Run it

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt   # first time only
```

Create `.env` in the project root with `GROQ_API_KEY=...` ([Groq Console](https://console.groq.com/keys)).

```powershell
# terminal 1 — backend
uvicorn server:app --reload --port 8000

# terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Use the project venv (`.\.venv\Scripts\python.exe`) — system Python does not have the dependencies.

## How to use

1. **Upload documents** — Drag and drop or click the upload area in the sidebar. Supported formats: PDF, DOCX, TXT, CSV, XLSX. The FAISS index rebuilds automatically after each upload.

2. **Manage files** — Click a document to preview it in a slide-over panel (PDF viewer or text excerpt, with search). Use the three-dot menu to rename or delete files. Deleting also triggers a re-index.

3. **Ask questions** — Type in the chat input or use the quick-action chips (e.g. “Summarize notes”, “Generate questions”, “Explain concepts”). The app retrieves relevant chunks from your documents and answers with Groq.

4. **Study with your notes** — Examples of what you can ask:
   - *“Summarize chapter 3 of my operating systems notes”*
   - *“Generate 5 exam questions from this PDF”*
   - *“Explain preemptive scheduling in simple terms”*
   - *“What are the main topics covered in my uploaded files?”*

Answers include **Sources Used** so you can see which file(s) the response came from. You can copy or regenerate the last reply.

## Project structure

```
RAG/
├── server.py           FastAPI backend (upload, chat, documents)
├── app.py              CLI entry point (optional)
├── frontend/           React + TypeScript UI
│   └── src/
│       ├── api/        typed HTTP client
│       ├── components/ sidebar, chat, upload, preview
│       └── store/      chat + UI state
├── src/
│   ├── data_loader.py  multi-format ingestion
│   ├── embedding.py    chunk + embed
│   ├── vector_store.py FAISS persistence
│   └── rag.py          retrieval + Groq Q&A
├── data/               uploaded documents (gitignored)
├── faiss_store/        generated index (gitignored)
├── .env
└── requirements.txt
```

## Git / privacy

- `data/` — document contents are **gitignored** (only `.gitkeep` is tracked)
- `faiss_store/` — generated vectors, gitignored
- `.env` — API keys, gitignored
