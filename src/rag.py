import os
from pathlib import Path
from typing import List, Optional, Union

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from langchain_groq import ChatGroq

from src.data_loader import latest_data_mtime, load_all_documents
from src.vector_store import FaissVectorStore

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA_DIR = PROJECT_ROOT / "data"
DEFAULT_STORE_DIR = PROJECT_ROOT / "faiss_store"

load_dotenv(PROJECT_ROOT / ".env")


def _index_mtime(persist_dir: str) -> float:
    times = []
    for name in ("faiss.index", "metadata.pkl"):
        path = os.path.join(persist_dir, name)
        if os.path.exists(path):
            times.append(os.path.getmtime(path))
    return max(times) if times else 0.0


def _should_rebuild_index(data_dir: Path, persist_dir: str, force: bool) -> bool:
    faiss_path = os.path.join(persist_dir, "faiss.index")
    meta_path = os.path.join(persist_dir, "metadata.pkl")
    index_exists = os.path.exists(faiss_path) and os.path.exists(meta_path)

    if force or not index_exists:
        return True
    return latest_data_mtime(data_dir) > _index_mtime(persist_dir)


class RAGSearch:
    def __init__(
        self,
        data_dir: Optional[Union[str, Path]] = None,
        persist_dir: Optional[Union[str, Path]] = None,
        embedding_model: str = "all-MiniLM-L6-v2",
        llm_model: Optional[str] = None,
        rebuild: bool = False,
    ):
        self.data_dir = Path(data_dir or DEFAULT_DATA_DIR)
        self.persist_dir = str(persist_dir or DEFAULT_STORE_DIR)
        self.vectorstore = FaissVectorStore(self.persist_dir, embedding_model)

        faiss_path = os.path.join(self.persist_dir, "faiss.index")
        meta_path = os.path.join(self.persist_dir, "metadata.pkl")
        index_exists = os.path.exists(faiss_path) and os.path.exists(meta_path)

        if _should_rebuild_index(self.data_dir, self.persist_dir, rebuild):
            if rebuild:
                print("[INFO] Rebuilding index (forced)...")
            elif not index_exists:
                print("[INFO] Building index...")
            else:
                print("[INFO] data/ changed — rebuilding index...")
            docs = load_all_documents(str(self.data_dir))
            self.vectorstore.build_from_documents(docs)
        else:
            self.vectorstore.load()

        groq_api_key = os.getenv("GROQ_API_KEY")
        if not groq_api_key:
            raise ValueError(
                "GROQ_API_KEY is missing. Add it to .env in the project root (https://console.groq.com)"
            )

        model = llm_model or os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        self.llm = ChatGroq(groq_api_key=groq_api_key, model_name=model)

    def search(self, query: str, top_k: int = 5) -> List[dict]:
        return self.vectorstore.query(query, top_k=top_k)

    def search_and_answer(self, query: str, top_k: int = 5) -> str:
        results = self.search(query, top_k=top_k)
        texts = [r["metadata"].get("text", "") for r in results if r.get("metadata")]
        context = "\n\n---\n\n".join(t for t in texts if t.strip())
        if not context:
            return "No relevant documents found in the index."

        prompt = f"""You are a helpful assistant. Answer the user's question using ONLY the context below.
If the context does not contain enough information, say so clearly.

Question: {query}

Context:
{context}

Answer:"""
        response = self.llm.invoke([HumanMessage(content=prompt)])
        return response.content
