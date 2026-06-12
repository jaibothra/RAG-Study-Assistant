import os
from pathlib import Path
from typing import Dict, List, Optional, Union

from dotenv import load_dotenv
from groq import Groq
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from src.data_loader import latest_data_mtime, load_all_documents
from src.vector_store import FaissVectorStore

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA_DIR = PROJECT_ROOT / "data"
DEFAULT_STORE_DIR = PROJECT_ROOT / "faiss_store"

load_dotenv(PROJECT_ROOT / ".env")


def _get_groq_client() -> Groq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError(
            "GROQ_API_KEY is missing. Add it to .env in the project root (https://console.groq.com)"
        )
    return Groq(api_key=api_key)


AFFIRMATIVE = {
    "yes",
    "yes go ahead",
    "go ahead",
    "sure",
    "okay",
    "ok",
    "go on",
    "yes do that",
    "please",
    "yes please",
    "do it",
    "do that",
    "yeah",
    "yep",
    "alright",
    "proceed",
    "sure go ahead",
    "yes please do that",
    "sounds good",
    "let's do it",
}


def rewrite_query(
    original_query: str,
    conversation_history: List[Dict],
    last_nudge: Optional[str] = None,
) -> str:
    """
    Rewrite vague follow-up queries into specific standalone search queries.

    Fast path: if the user responds affirmatively AND a nudge is stored,
    use the nudge text directly as the query — no LLM call needed.

    Slow path: vague query without a stored nudge — use LLM to rewrite
    using conversation history.

    If query is already specific, return unchanged.
    """
    normalized = original_query.strip().lower().rstrip(".,!")

    # Fast path — affirmative + stored nudge: inject nudge directly as the query
    if normalized in AFFIRMATIVE and last_nudge:
        return last_nudge

    if normalized in AFFIRMATIVE:
        return original_query

    if not conversation_history:
        return original_query

    history_text = "\n".join(
        [f"{msg['role'].upper()}: {msg['content']}" for msg in conversation_history[-6:]]
    )

    rewrite_prompt = f"""Given this conversation:
{history_text}

User's new message: "{original_query}"

Rewrite this as a specific standalone search query based on context.
If it's already a specific question, return it unchanged.
Return only the query. No explanation. No quotes."""

    try:
        groq_client = _get_groq_client()
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": rewrite_prompt}],
            max_tokens=100,
            temperature=0,
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return original_query


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

    def search_and_answer(
        self,
        query: str,
        top_k: int = 5,
        conversation_history: Optional[List[Dict]] = None,
        last_nudge: Optional[str] = None,
    ) -> str:
        history = conversation_history or []
        retrieval_query = rewrite_query(query, history, last_nudge=last_nudge)
        results = self.search(retrieval_query, top_k=top_k)
        texts = [r["metadata"].get("text", "") for r in results if r.get("metadata")]
        context = "\n\n---\n\n".join(t for t in texts if t.strip())
        if not context:
            return "No relevant documents found in the index."

        recent_history = history[-6:]

        system_prompt = """You are an expert Socratic tutor helping a student deeply understand \
concepts from their study materials.

When answering:
- Give a thorough, complete explanation — do not truncate or summarise \
  prematurely. A good answer is as long as the concept requires.
- Always use at least one concrete real-world analogy or example to \
  make the concept tangible. Introduce it naturally ("Think of it like...", \
  "For example...", "A good analogy here is...").
- Break complex concepts into clear steps or parts. Use short paragraphs, \
  not walls of text.
- If the concept has common misconceptions, briefly address them.
- Never say "based on the context provided" or "according to the documents." \
  Teach naturally as a confident tutor would.
- Only use information from the provided context. If the context does not \
  contain enough information to answer fully, say so honestly.

Critical rules about voice and role:
- The retrieved context comes from study documents written by textbook authors
  or professors — NOT by the student. Never say "you've explained", "you've
  noted", "you've highlighted", "you mentioned", "as you described", or any
  phrase that attributes the document content to the student.
- You are the tutor. The student is learning. Speak as a teacher explaining
  to a learner — not as someone summarising what the learner already knows.
- Never summarise or recap retrieved content as bullet points unless the
  student explicitly asks for a summary. When the student says "yes go ahead"
  or accepts your offer, follow through on the specific thing you offered to
  explain — do not summarise what was already discussed.
- Use "the material covers", "according to your notes", "the concept here is"
  — never "you covered", "you explained", "you noted".

After your answer, on a new line separated by a blank line, add exactly \
one Socratic nudge — a single natural sentence that either:
  a) Offers to explain a related concept that logically follows \
     ("If you'd like, I can walk you through [specific concept] next, \
     which builds directly on this.")
  b) Offers a quick comprehension check \
     ("Want me to give you a quick question to test if this concept is solid?")

Choose whichever is more appropriate given what was just explained.
The nudge must feel like a natural tutor suggestion, not a robotic prompt.
Do not label it. Do not use bullet points. Just one sentence on its own line."""

        langchain_messages = [SystemMessage(content=system_prompt)]
        for msg in recent_history:
            role = msg.get("role")
            content = msg.get("content", "")
            if role == "user":
                langchain_messages.append(HumanMessage(content=content))
            elif role == "assistant":
                langchain_messages.append(AIMessage(content=content))
        langchain_messages.append(
            HumanMessage(
                content=f"Context:\n{context}\n\nQuestion: {query}",
            ),
        )

        response = self.llm.invoke(langchain_messages, temperature=0.7)
        return response.content


def answer_question(
    question: str,
    context_or_index_path: str,
    conversation_history: Optional[List[Dict]] = None,
    last_nudge: Optional[str] = None,
) -> str:
    index_path = Path(context_or_index_path)
    inferred_data_dir = index_path.parent / "documents"
    rag = RAGSearch(
        data_dir=inferred_data_dir if inferred_data_dir.exists() else DEFAULT_DATA_DIR,
        persist_dir=context_or_index_path,
    )
    return rag.search_and_answer(
        question,
        top_k=5,
        conversation_history=conversation_history or [],
        last_nudge=last_nudge,
    )
