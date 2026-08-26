import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from groq import Groq
from pydantic import BaseModel, Field

from src.data_loader import SUPPORTED_EXTENSIONS, load_all_documents
from src.memory import (
    add_message,
    clear_history,
    clear_nudge,
    create_session,
    delete_session,
    get_history_full,
    get_last_nudge,
    get_recent_history,
    get_sessions,
    session_belongs_to_space,
    set_last_nudge,
    update_session_title,
)
from src.rag import (
    DEFAULT_STORE_DIR,
    RAGSearch,
    answer_question,
    answer_conversational,
    detect_next_topic_intent,
    detect_quiz_intent,
    generate_next_suggestions,
    generate_quiz,
    is_conversational,
)
from src.vector_store import FaissVectorStore

DATA_DIR = Path("data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
SPACES_DIR = Path("spaces")
SPACES_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_EXTENSIONS = {".pdf", ".docx", ".csv", ".txt", ".xlsx"}


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    type: Literal["chat", "quiz", "suggestions"]
    answer: Optional[str] = None
    sources: List[str] = Field(default_factory=list)
    session_id: Optional[str] = None
    quiz: Optional[Dict[str, Any]] = None
    suggestions: Optional[List[Dict[str, str]]] = None


class UploadResponse(BaseModel):
    uploaded: List[str]


class DocumentItem(BaseModel):
    name: str
    size: int


class DocumentsResponse(BaseModel):
    documents: List[DocumentItem]


class DeleteResponse(BaseModel):
    deleted: str


class RenameRequest(BaseModel):
    new_name: str


class RenameResponse(BaseModel):
    renamed: str


class DocumentPreviewResponse(BaseModel):
    name: str
    size: int
    extension: str
    excerpt: str
    page_count: Optional[int] = None


class ErrorResponse(BaseModel):
    error: str


class CreateSpaceRequest(BaseModel):
    name: str


class UpdateSpaceRequest(BaseModel):
    name: str


class SpaceResponse(BaseModel):
    id: str
    name: str
    created_at: str


class SpaceListItem(BaseModel):
    id: str
    name: str
    created_at: str
    document_count: int


class DeleteSpaceResponse(BaseModel):
    deleted: str


class ClearHistoryResponse(BaseModel):
    cleared: str


class SessionItem(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str


class SessionsResponse(BaseModel):
    sessions: List[SessionItem]


class SessionMessageItem(BaseModel):
    role: str
    content: str
    sources: List[str] = []
    created_at: Optional[str] = None


class SessionMessagesResponse(BaseModel):
    messages: List[SessionMessageItem]


app = FastAPI(title="RAG API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_groq_client() -> Groq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is missing")
    return Groq(api_key=api_key)


def _rebuild_index(data_dir: Path = DATA_DIR, store_dir: Path = Path(DEFAULT_STORE_DIR)) -> None:
    documents = load_all_documents(str(data_dir))
    if not documents:
        for index_file in ("faiss.index", "metadata.pkl"):
            path = store_dir / index_file
            if path.exists():
                path.unlink()
        return
    store = FaissVectorStore(str(store_dir))
    store.build_from_documents(documents)


def _safe_destination(name: str, base_dir: Path = DATA_DIR) -> Path:
    safe_name = Path(name).name
    destination = base_dir / safe_name
    if destination.parent.resolve() != base_dir.resolve():
        raise HTTPException(status_code=400, detail="Invalid filename")
    return destination


def _space_root(space_id: str) -> Path:
    root = SPACES_DIR / space_id
    if not root.is_dir():
        raise HTTPException(status_code=404, detail="Space not found")
    return root


def _space_documents_dir(space_id: str) -> Path:
    docs = _space_root(space_id) / "documents"
    docs.mkdir(parents=True, exist_ok=True)
    return docs


def _space_faiss_dir(space_id: str) -> Path:
    index_dir = _space_root(space_id) / "faiss_index"
    index_dir.mkdir(parents=True, exist_ok=True)
    return index_dir


def _ensure_session_in_space(space_id: str, session_id: str) -> None:
    try:
        belongs = session_belongs_to_space(session_id, space_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Supabase error while validating session: {exc}") from exc
    if not belongs:
        raise HTTPException(status_code=404, detail="Session not found in this space")


def _read_space_metadata(space_id: str) -> dict:
    meta_path = _space_root(space_id) / "metadata.json"
    if not meta_path.is_file():
        raise HTTPException(status_code=404, detail="Space metadata not found")
    return json.loads(meta_path.read_text(encoding="utf-8"))


def _write_space_metadata(space_id: str, metadata: dict) -> None:
    meta_path = _space_root(space_id) / "metadata.json"
    meta_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")


def _space_response(space_id: str) -> SpaceResponse:
    meta = _read_space_metadata(space_id)
    return SpaceResponse(id=meta["id"], name=meta["name"], created_at=meta["created_at"])


def _document_count(space_id: str) -> int:
    docs_dir = _space_root(space_id) / "documents"
    if not docs_dir.is_dir():
        return 0
    return sum(
        1
        for file_path in docs_dir.iterdir()
        if file_path.is_file() and not file_path.name.startswith(".")
    )


def _rebuild_space_index(space_id: str) -> None:
    _rebuild_index(_space_documents_dir(space_id), _space_faiss_dir(space_id))


@app.exception_handler(HTTPException)
async def http_exception_handler(_, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail)})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"error": str(exc)})


@app.exception_handler(Exception)
async def generic_exception_handler(_, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc)})


@app.post("/spaces", response_model=SpaceResponse, responses={400: {"model": ErrorResponse}})
async def create_space(payload: CreateSpaceRequest):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Space name cannot be empty")

    space_id = str(uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    space_dir = SPACES_DIR / space_id
    (space_dir / "documents").mkdir(parents=True, exist_ok=True)
    (space_dir / "faiss_index").mkdir(parents=True, exist_ok=True)
    metadata = {"id": space_id, "name": name, "created_at": created_at}
    (space_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return SpaceResponse(id=space_id, name=name, created_at=created_at)


@app.get("/spaces", response_model=List[SpaceListItem])
async def list_spaces():
    spaces: List[SpaceListItem] = []
    if not SPACES_DIR.is_dir():
        return spaces

    for space_dir in sorted(SPACES_DIR.iterdir()):
        if not space_dir.is_dir():
            continue
        meta_path = space_dir / "metadata.json"
        if not meta_path.is_file():
            continue
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        space_id = meta.get("id", space_dir.name)
        spaces.append(
            SpaceListItem(
                id=space_id,
                name=meta.get("name", "Untitled"),
                created_at=meta.get("created_at", ""),
                document_count=_document_count(space_id),
            )
        )
    return spaces


@app.delete(
    "/spaces/{space_id}",
    response_model=DeleteSpaceResponse,
    responses={404: {"model": ErrorResponse}},
)
async def delete_space(space_id: str):
    space_dir = _space_root(space_id)
    shutil.rmtree(space_dir)
    return DeleteSpaceResponse(deleted=space_id)


@app.patch(
    "/spaces/{space_id}",
    response_model=SpaceResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def update_space(space_id: str, payload: UpdateSpaceRequest):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Space name cannot be empty")

    metadata = _read_space_metadata(space_id)
    metadata["name"] = name
    _write_space_metadata(space_id, metadata)
    return _space_response(space_id)


@app.post(
    "/spaces/{space_id}/upload",
    response_model=UploadResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def upload_space_documents(space_id: str, files: List[UploadFile] = File(...)):
    docs_dir = _space_documents_dir(space_id)
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    uploaded: List[str] = []
    for file in files:
        ext = Path(file.filename or "").suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS or ext not in UPLOAD_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.filename}",
            )
        destination = _safe_destination(file.filename or "", docs_dir)
        content = await file.read()
        destination.write_bytes(content)
        uploaded.append(destination.name)

    _rebuild_space_index(space_id)
    return UploadResponse(uploaded=uploaded)


@app.get(
    "/spaces/{space_id}/documents",
    response_model=DocumentsResponse,
    responses={404: {"model": ErrorResponse}},
)
async def list_space_documents(space_id: str):
    docs_dir = _space_documents_dir(space_id)
    documents: List[DocumentItem] = []
    for file_path in sorted(docs_dir.glob("*")):
        if file_path.is_file() and not file_path.name.startswith("."):
            documents.append(DocumentItem(name=file_path.name, size=file_path.stat().st_size))
    return DocumentsResponse(documents=documents)


@app.delete(
    "/spaces/{space_id}/documents/{filename}",
    response_model=DeleteResponse,
    responses={404: {"model": ErrorResponse}},
)
async def delete_space_document(space_id: str, filename: str):
    docs_dir = _space_documents_dir(space_id)
    target = _safe_destination(filename, docs_dir)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Document not found")

    os.remove(target)
    _rebuild_space_index(space_id)
    return DeleteResponse(deleted=target.name)


@app.post(
    "/spaces/{space_id}/chat",
    response_model=ChatResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def chat_in_space(space_id: str, payload: ChatRequest):
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    _space_root(space_id)
    docs_dir = _space_documents_dir(space_id)
    faiss_dir = _space_faiss_dir(space_id)
    session_id = payload.session_id
    is_new_session = session_id is None

    try:
        if session_id is None:
            session_id = create_session(space_id)
        else:
            _ensure_session_in_space(space_id, session_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Supabase error while preparing session: {exc}") from exc

    is_quiz, topic, num_questions = detect_quiz_intent(message)
    if is_quiz:
        resolved_topic = topic or message
        index_path = str(faiss_dir)
        try:
            quiz_data = generate_quiz(resolved_topic, num_questions, index_path)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(exc)}") from exc

        try:
            add_message(session_id, space_id, "user", message)
            add_message(
                session_id,
                space_id,
                "assistant",
                f"Generated a {num_questions}-question quiz on {quiz_data.get('topic', resolved_topic)}.",
            )
            clear_nudge(session_id)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Supabase error while storing chat: {exc}") from exc

        return ChatResponse(
            type="quiz",
            quiz=quiz_data,
            answer=None,
            sources=[],
            session_id=session_id,
        )

    if detect_next_topic_intent(message):
        try:
            history = get_recent_history(session_id)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Supabase error: {exc}") from exc
        index_path = str(faiss_dir)
        suggestions = generate_next_suggestions(history, index_path)
        try:
            add_message(session_id, space_id, "user", message)
            add_message(session_id, space_id, "assistant", "Here are your next study suggestions.")
            clear_nudge(session_id)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Supabase error: {exc}") from exc
        return ChatResponse(
            type="suggestions",
            suggestions=suggestions,
            answer=None,
            sources=[],
            session_id=session_id,
        )

    if is_conversational(message):
        try:
            history = get_recent_history(session_id)
            answer = answer_conversational(message, history)
            add_message(session_id, space_id, "user", message)
            add_message(session_id, space_id, "assistant", answer)
            clear_nudge(session_id)
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Supabase error while handling conversational chat: {exc}",
            ) from exc

        return ChatResponse(type="chat", answer=answer, sources=[], session_id=session_id)

    try:
        history = get_recent_history(session_id)
        last_nudge = get_last_nudge(session_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Supabase error while preparing session: {exc}") from exc

    rag = RAGSearch(data_dir=docs_dir, persist_dir=faiss_dir)
    results = rag.search(message, top_k=5)
    answer = answer_question(
        message,
        str(faiss_dir),
        conversation_history=history,
        last_nudge=last_nudge,
    )

    sources: List[str] = []
    for item in results:
        metadata = item.get("metadata") or {}
        source_path = metadata.get("source")
        if source_path:
            source_name = Path(source_path).name
            if source_name not in sources:
                sources.append(source_name)

    try:
        # Extract nudge from the response and store it explicitly for the next turn.
        # The nudge is always the last paragraph (separated by a blank line).
        parts = answer.split("\n\n")
        if len(parts) >= 2:
            set_last_nudge(session_id, parts[-1].strip())
        else:
            clear_nudge(session_id)

        add_message(session_id, space_id, "user", message)
        add_message(session_id, space_id, "assistant", answer, sources)

        if is_new_session:
            groq_client = _get_groq_client()
            title_prompt = f"""Generate a short, specific session title for a study session
that started with this question: "{message}"

Rules:
- Title case
- Maximum 6 words
- Phrase it as a topic or question, not a statement
- Examples: "What Is Gradient Descent?", "Support Vector Machines Explained",
  "Neural Network Backpropagation", "Types of Regression Models"

Return only the title. Nothing else."""
            title_response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": title_prompt}],
                max_tokens=20,
                temperature=0,
            )
            generated_title = title_response.choices[0].message.content.strip()
            if generated_title:
                update_session_title(session_id, generated_title)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Supabase error while storing chat: {exc}") from exc

    return ChatResponse(type="chat", answer=answer, sources=sources, session_id=session_id)


@app.get(
    "/spaces/{space_id}/sessions",
    response_model=SessionsResponse,
    responses={404: {"model": ErrorResponse}, 502: {"model": ErrorResponse}},
)
async def list_sessions(space_id: str):
    _space_root(space_id)
    try:
        sessions = get_sessions(space_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Supabase error while listing sessions: {exc}") from exc
    return SessionsResponse(sessions=sessions)


@app.delete(
    "/spaces/{space_id}/sessions/{session_id}",
    response_model=DeleteResponse,
    responses={404: {"model": ErrorResponse}, 502: {"model": ErrorResponse}},
)
async def remove_session(space_id: str, session_id: str):
    _space_root(space_id)
    _ensure_session_in_space(space_id, session_id)
    try:
        delete_session(session_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Supabase error while deleting session: {exc}") from exc
    return DeleteResponse(deleted=session_id)


@app.delete(
    "/spaces/{space_id}/sessions/{session_id}/history",
    response_model=ClearHistoryResponse,
    responses={404: {"model": ErrorResponse}, 502: {"model": ErrorResponse}},
)
async def clear_session_history(space_id: str, session_id: str):
    _space_root(space_id)
    _ensure_session_in_space(space_id, session_id)
    try:
        clear_history(session_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Supabase error while clearing history: {exc}") from exc
    return ClearHistoryResponse(cleared=session_id)


@app.get(
    "/spaces/{space_id}/sessions/{session_id}/messages",
    response_model=SessionMessagesResponse,
    responses={404: {"model": ErrorResponse}, 502: {"model": ErrorResponse}},
)
async def list_session_messages(space_id: str, session_id: str):
    _space_root(space_id)
    _ensure_session_in_space(space_id, session_id)
    try:
        messages = get_history_full(session_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Supabase error while loading messages: {exc}") from exc
    return SessionMessagesResponse(messages=messages)


@app.post(
    "/spaces/{space_id}/sessions/{session_id}/suggestions",
    responses={404: {"model": ErrorResponse}, 502: {"model": ErrorResponse}},
)
async def get_suggestions(space_id: str, session_id: str):
    _space_root(space_id)
    _ensure_session_in_space(space_id, session_id)
    try:
        history = get_recent_history(session_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Supabase error: {exc}") from exc
    index_path = str(_space_faiss_dir(space_id))
    suggestions = generate_next_suggestions(history, index_path)
    return {"suggestions": suggestions}


@app.delete(
    "/spaces/{space_id}/history",
    response_model=ClearHistoryResponse,
    responses={404: {"model": ErrorResponse}, 400: {"model": ErrorResponse}, 502: {"model": ErrorResponse}},
)
async def clear_space_history(space_id: str, session_id: str):
    _space_root(space_id)
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    _ensure_session_in_space(space_id, session_id)
    try:
        clear_history(session_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Supabase error while clearing history: {exc}") from exc
    return ClearHistoryResponse(cleared=session_id)


@app.get(
    "/spaces/{space_id}/documents/{filename}/preview",
    response_model=DocumentPreviewResponse,
    responses={404: {"model": ErrorResponse}},
)
async def preview_space_document(space_id: str, filename: str):
    target = _safe_destination(filename, _space_documents_dir(space_id))
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Document not found")

    excerpt, page_count = _build_preview_excerpt(target)
    return DocumentPreviewResponse(
        name=target.name,
        size=target.stat().st_size,
        extension=target.suffix.lower(),
        excerpt=excerpt,
        page_count=page_count,
    )


@app.get(
    "/spaces/{space_id}/documents/{filename}/file",
    responses={404: {"model": ErrorResponse}},
)
async def get_space_document_file(space_id: str, filename: str):
    target = _safe_destination(filename, _space_documents_dir(space_id))
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Document not found")
    return FileResponse(target, filename=target.name)


@app.post("/upload", response_model=UploadResponse, responses={400: {"model": ErrorResponse}})
async def upload_documents(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    uploaded: List[str] = []
    for file in files:
        ext = Path(file.filename or "").suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS or ext not in UPLOAD_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.filename}",
            )
        destination = _safe_destination(file.filename or "")
        content = await file.read()
        destination.write_bytes(content)
        uploaded.append(destination.name)

    _rebuild_index()
    return UploadResponse(uploaded=uploaded)


@app.post(
    "/chat",
    response_model=ChatResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def chat(payload: ChatRequest):
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    rag = RAGSearch()
    results = rag.search(message, top_k=5)
    answer = rag.search_and_answer(message, top_k=5)

    sources: List[str] = []
    for item in results:
        metadata = item.get("metadata") or {}
        source_path = metadata.get("source")
        if source_path:
            source_name = Path(source_path).name
            if source_name not in sources:
                sources.append(source_name)

    return ChatResponse(type="chat", answer=answer, sources=sources)


@app.get("/documents", response_model=DocumentsResponse)
async def list_documents():
    documents: List[DocumentItem] = []
    for file_path in sorted(DATA_DIR.glob("*")):
        if file_path.is_file() and not file_path.name.startswith("."):
            documents.append(DocumentItem(name=file_path.name, size=file_path.stat().st_size))
    return DocumentsResponse(documents=documents)


@app.delete(
    "/documents/{filename}",
    response_model=DeleteResponse,
    responses={404: {"model": ErrorResponse}},
)
async def delete_document(filename: str):
    target = _safe_destination(filename)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Document not found")

    os.remove(target)
    _rebuild_index()
    return DeleteResponse(deleted=target.name)


@app.patch(
    "/documents/{filename}",
    response_model=RenameResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def rename_document(filename: str, payload: RenameRequest):
    target = _safe_destination(filename)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Document not found")

    new_name = Path(payload.new_name).name
    if not new_name or new_name.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid filename")

    ext = Path(new_name).suffix.lower()
    if ext not in UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    destination = _safe_destination(new_name)
    if destination.exists() and destination != target:
        raise HTTPException(status_code=400, detail="A file with that name already exists")

    os.rename(target, destination)
    _rebuild_index()
    return RenameResponse(renamed=destination.name)


def _build_preview_excerpt(file_path: Path) -> Tuple[str, Optional[int]]:
    ext = file_path.suffix.lower()
    page_count = None

    if ext in {".txt", ".md", ".csv", ".json"}:
        return file_path.read_text(encoding="utf-8", errors="ignore")[:12000], None

    if ext == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(str(file_path))
        page_count = len(reader.pages)
        parts = []
        for page in reader.pages[:8]:
            parts.append(page.extract_text() or "")
        return "\n\n".join(parts)[:12000], page_count

    if ext == ".docx":
        from docx2txt import process

        return (process(str(file_path)) or "")[:12000], None

    if ext == ".xlsx":
        import openpyxl

        wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        lines = []
        for sheet in wb.worksheets:
            for row in sheet.iter_rows(values_only=True, max_row=200):
                cells = [str(c) for c in row if c is not None]
                if cells:
                    lines.append(" | ".join(cells))
        wb.close()
        return "\n".join(lines)[:12000], None

    return "", None


@app.get(
    "/documents/{filename}/preview",
    response_model=DocumentPreviewResponse,
    responses={404: {"model": ErrorResponse}},
)
async def preview_document(filename: str):
    target = _safe_destination(filename)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Document not found")

    excerpt, page_count = _build_preview_excerpt(target)
    return DocumentPreviewResponse(
        name=target.name,
        size=target.stat().st_size,
        extension=target.suffix.lower(),
        excerpt=excerpt,
        page_count=page_count,
    )


@app.get("/documents/{filename}/file", responses={404: {"model": ErrorResponse}})
async def get_document_file(filename: str):
    target = _safe_destination(filename)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Document not found")
    return FileResponse(target, filename=target.name)
