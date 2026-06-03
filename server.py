import os
from pathlib import Path
from typing import List, Optional, Tuple

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from src.data_loader import SUPPORTED_EXTENSIONS, load_all_documents
from src.rag import DEFAULT_STORE_DIR, RAGSearch
from src.vector_store import FaissVectorStore

DATA_DIR = Path("data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_EXTENSIONS = {".pdf", ".docx", ".csv", ".txt", ".xlsx"}


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    answer: str
    sources: List[str]


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


app = FastAPI(title="RAG API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _rebuild_index() -> None:
    documents = load_all_documents(str(DATA_DIR))
    if not documents:
        for index_file in ("faiss.index", "metadata.pkl"):
            path = Path(DEFAULT_STORE_DIR) / index_file
            if path.exists():
                path.unlink()
        return
    store = FaissVectorStore(str(DEFAULT_STORE_DIR))
    store.build_from_documents(documents)


def _safe_destination(name: str) -> Path:
    safe_name = Path(name).name
    destination = DATA_DIR / safe_name
    if destination.parent.resolve() != DATA_DIR.resolve():
        raise HTTPException(status_code=400, detail="Invalid filename")
    return destination


@app.exception_handler(HTTPException)
async def http_exception_handler(_, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail)})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"error": str(exc)})


@app.exception_handler(Exception)
async def generic_exception_handler(_, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc)})


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

    return ChatResponse(answer=answer, sources=sources)


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
