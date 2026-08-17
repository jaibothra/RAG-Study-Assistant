import os
import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

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
    "let's go",
    "go for it",
    "yeah",
    "yep",
    "alright",
    "proceed",
    "sure go ahead",
    "yes please do that",
    "sounds good",
    "let's do it",
    "yes that",
    "that one",
    "the first one",
    "the second one",
    "tell me",
    "explain",
    "show me",
    "walk me through it",
}


CONVERSATIONAL_PATTERNS = {
    # Greetings
    "hi",
    "hello",
    "hey",
    "hiya",
    "howdy",
    "hi there",
    "hello there",
    # Acknowledgements
    "thanks",
    "thank you",
    "thank you so much",
    "thanks a lot",
    "cheers",
    "got it",
    "i see",
    "understood",
    "makes sense",
    "cool",
    "great",
    "awesome",
    "nice",
    "good",
    "noted",
    # Conversation enders
    "bye",
    "goodbye",
    "see you",
    "that's all",
    "that's it",
    "i'm done",
    "done",
    "stop",
    "exit",
    # Filler
    "lol",
    "haha",
    "interesting",
    "wow",
    "oh",
    "ah",
    "hmm",
}


def detect_quiz_intent(message: str) -> Tuple[bool, str, int]:
    """
    Returns (is_quiz, topic, num_questions).
    Detects common "quiz me" style prompts and extracts topic + count.
    """
    normalized = message.strip().lower()

    quiz_triggers = [
        "quiz me on",
        "quiz me about",
        "generate a quiz",
        "make a quiz",
        "create a quiz",
        "give me a quiz",
        "test me on",
        "test me about",
        "ask me questions about",
        "give me questions on",
        "give me questions about",
        "quiz on",
        "quiz about",
        "mcq",
        "mcqs",
        "make a mcq",
        "make mcq",
        "make a test",
        "make a test on",
        "generate a test",
        "create a test",
        "give me a test",
        "make me a test",
        "multiple choice",
        "multiple choice questions",
        "multiple choice test",
        "multiple choice quiz",
        "make a multiple choice",
    ]

    numeric_quiz_pattern = re.search(
        r"\b(?:give me|ask me|make|create|generate)\s+\d+\s+questions?\b", normalized
    )
    question_quiz_pattern = re.search(
        r"\b(?:give me|ask me)\s+\d+\s+questions?\s+(?:on|about)\s+(.+)$", normalized
    )
    make_quiz_pattern = re.search(
        r"\bmake\s+a\s+\d+\s+question\s+quiz\s+(?:on|about)\s+(.+)$", normalized
    )

    is_quiz = any(trigger in normalized for trigger in quiz_triggers)
    if not is_quiz and (numeric_quiz_pattern or question_quiz_pattern or make_quiz_pattern):
        is_quiz = True
    if not is_quiz:
        return False, "", 5

    num_match = re.search(r"(\d+)\s*(questions?|mcqs?|q'?s?)", normalized)
    num_questions = int(num_match.group(1)) if num_match else 5
    num_questions = max(1, min(num_questions, 20))

    topic = ""
    for trigger in sorted(quiz_triggers, key=len, reverse=True):
        if trigger in normalized:
            after = normalized.split(trigger, 1)[1].strip()
            after = re.sub(r"^\d+\s*questions?\s*(on|about)?\s*", "", after).strip()
            topic = after
            break

    if not topic:
        topic_match = re.search(r"\bquestions?\s+(?:on|about)\s+(.+)$", normalized)
        if topic_match:
            topic = topic_match.group(1).strip()

    if not topic:
        quiz_about_match = re.search(r"\bquiz\s+(?:on|about)\s+(.+)$", normalized)
        if quiz_about_match:
            topic = quiz_about_match.group(1).strip()

    return True, topic, num_questions


def filter_relevant_chunks(chunks: List[str], topic: str) -> List[str]:
    """Keep only chunks that are meaningfully related to the topic."""
    if not chunks:
        return []

    chunk_text = "\n---\n".join([f"Chunk {i + 1}: {c}" for i, c in enumerate(chunks)])

    filter_prompt = f"""Topic: {topic}

Below are text chunks from study documents. Return a JSON array of the chunk
numbers (1-indexed) that are directly relevant to the topic "{topic}".
If fewer than 3 chunks are relevant, return an empty array.
Return ONLY the JSON array, e.g. [1, 3, 5] or [].

Chunks:
{chunk_text}"""

    try:
        groq_client = _get_groq_client()
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": filter_prompt}],
            max_tokens=50,
            temperature=0,
        )
        raw = (response.choices[0].message.content or "").strip()
        indices = json.loads(raw)
        if not indices:
            return []
        return [chunks[i - 1] for i in indices if isinstance(i, int) and 1 <= i <= len(chunks)]
    except Exception:
        return chunks  # fallback: use all chunks if filtering fails


def generate_quiz(topic: str, num_questions: int, index_path: str) -> Dict:
    """
    Generate a multiple choice quiz grounded in user documents when possible.
    Falls back to model knowledge if retrieval is sparse or unavailable.
    """
    normalized_topic = (topic or "").strip()
    retrieval_query = (
        f"explain {normalized_topic} definition examples applications"
        if normalized_topic
        else "key concepts definition examples applications"
    )
    display_topic = normalized_topic or "your study material"

    context = ""
    try:
        index = Path(index_path)
        inferred_data_dir = index.parent / "documents"
        rag = RAGSearch(
            data_dir=inferred_data_dir if inferred_data_dir.exists() else DEFAULT_DATA_DIR,
            persist_dir=index_path,
        )
        chunks = rag.search(retrieval_query, top_k=8)
        texts = [
            item.get("metadata", {}).get("text", "").strip()
            for item in chunks
            if item.get("metadata")
        ]
        texts = [text for text in texts if text]
        filtered_texts = filter_relevant_chunks(texts, display_topic)
        if len(filtered_texts) >= 3:
            context = "\n\n".join(filtered_texts)
    except Exception:
        context = ""

    if context:
        source_instruction = f"""Use the following study material as your primary source.
Base questions on concepts covered in this material:

{context}"""
    else:
        source_instruction = f"""No sufficiently relevant study material was found for this topic.
Generate questions based on standard academic knowledge of: {display_topic}"""

    quiz_prompt = f"""{source_instruction}

Generate exactly {num_questions} multiple choice questions about: {display_topic}

Requirements:
- Each question tests conceptual understanding, not memorisation
- Questions must be directly and specifically about "{display_topic}" — do not drift
  to tangentially related topics
- Questions should be concise — one or two sentences maximum
- All 4 options (A, B, C, D) should be plausible — no obviously wrong answers
- There must be exactly one unambiguously correct answer per question
- Vary difficulty: mix straightforward and tricky questions
- For the explanation field: explain the underlying concept that makes the
  correct answer right. Do NOT say "option X is correct because it references"
  or "option X is correct because it mentions" — explain the actual concept.
  Write it as: "[Correct answer] because [conceptual reason]. [Wrong answer]
  is a common misconception because [reason]." — refer to wrong options by
  their content, not their letter.
- Each question must also include a "concept" field: a 2-5 word label for
  the underlying concept being tested (e.g. "Gradient descent convergence",
  "Kernel trick in SVMs", "PCA dimensionality reduction"). This will be used
  to tell students what to revise.

Return ONLY a valid JSON array, no markdown, no other text:
[
  {{
    "id": 1,
    "question": "...",
    "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
    "correct": "B",
    "explanation": "...",
    "concept": "..."
  }}
]"""

    groq_client = _get_groq_client()
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": quiz_prompt}],
        max_tokens=3000,
        temperature=0.7,
    )

    raw = (response.choices[0].message.content or "").strip()
    raw = re.sub(r"^```json\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"^```\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        questions = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Quiz generation returned invalid JSON: {raw}") from exc

    if not isinstance(questions, list):
        raise ValueError(f"Quiz generation returned invalid JSON: {raw}")

    return {
        "topic": display_topic,
        "questions": questions,
    }


def is_conversational(message: str) -> bool:
    """
    Returns True if the message is purely conversational and does not
    warrant a vector store retrieval. These messages should be handled
    directly by the LLM without RAG context.
    """
    normalized = message.strip().lower().rstrip(".,!?")
    return normalized in CONVERSATIONAL_PATTERNS


def answer_conversational(message: str, conversation_history: List[Dict]) -> str:
    """
    Handle purely conversational messages without vector store retrieval.
    Responds naturally as a tutor would between teaching moments.
    """
    history_text = ""
    if conversation_history:
        history_text = "Recent conversation context:\n" + "\n".join(
            [
                f"{m['role'].upper()}: {m['content'][:200]}"
                for m in conversation_history[-4:]
            ]
        )

    prompt = f"""{history_text}

Student's message: "{message}"

You are a friendly study tutor. Respond naturally and briefly to this
conversational message. Do not launch into teaching unless the student
asks. Do not reference document content. Just respond like a human tutor
would between lessons — warm but concise, one or two sentences maximum.
Do not add a follow-up nudge to conversational responses."""

    groq_client = _get_groq_client()
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=100,
        temperature=0.8,
    )
    return response.choices[0].message.content.strip()


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
- Match response length to the complexity of the question. Simple factual
  questions deserve concise answers (2-4 sentences). Conceptual questions
  deserve fuller explanations with examples. Multi-part questions deserve
  structured responses. Never pad a response to seem thorough — stop when
  the concept is clear.
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
- You have access to conversation history from this session. Never claim
  this is "the beginning of our conversation" or that you have no memory
  of previous exchanges. If history exists, you have it. Use it confidently.
- Never summarise or recap retrieved content as bullet points unless the
  student explicitly asks for a summary. When the student says "yes go ahead"
  or accepts your offer, follow through on the specific thing you offered to
  explain — do not summarise what was already discussed.
- When the student accepts your follow-up offer ("sure", "yes go ahead" etc.)
  and you have been given a specific topic to explain, focus entirely on
  explaining that topic clearly. Do not summarise or narrate retrieved document
  content as bullet points. Do not say "the material covers" or "the context
  discusses." Teach the concept directly as a tutor would, using the retrieved
  content as your knowledge source — not as text to be recited.
- Use "the material covers", "according to your notes", "the concept here is"
  — never "you covered", "you explained", "you noted".
- Use italic text sparingly. Reserve italics only for technical terms being
  introduced for the first time or for genuine emphasis on a single critical
  word. Do not italicise full sentences, analogies, or explanations.
  Maximum one or two italic phrases per response.

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
