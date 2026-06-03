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

End-to-end flow: **load → chunk → embed → index → retrieve top-k → prompt LLM with context**.

## Run it

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt   # first time only
```

Create `.env` in the project root with `GROQ_API_KEY=...` ([Groq Console](https://console.groq.com/keys)).

Drop files into `data/`, then:

```powershell
python app.py --query "Summarize the main findings"
python app.py                                        # interactive chat
```

The index **rebuilds automatically** when any file in `data/` is added or updated. Use `--rebuild` only to force a refresh (e.g. after deleting a file from `data/`).

Use the project venv (`.\.venv\Scripts\python.exe`) — system Python does not have the dependencies.

## Project structure

```
app.py              CLI
src/data_loader.py  multi-format ingestion
src/embedding.py    chunk + embed
src/vector_store.py FAISS persistence
src/rag.py          retrieval + Groq Q&A
data/               your documents (not committed)
faiss_store/        generated index (not committed)
```

## Git / privacy

- `data/` — document contents are **gitignored** (only `.gitkeep` is tracked)
- `faiss_store/` — generated vectors, gitignored
- `.env` — API keys, gitignored

## Running with UI

```powershell
# terminal 1
uvicorn server:app --reload --port 8000

# terminal 2
cd frontend
npm install
npm run dev
```
