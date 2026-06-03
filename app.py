"""
RAG CLI — load documents, embed into FAISS, query with Groq.

Usage:
  python app.py                          # interactive Q&A
  python app.py --query "your question"  # single question
  python app.py --rebuild                # force re-index (also auto-runs when data/ changes)
"""
import argparse

from src.rag import RAGSearch


def main() -> None:
    parser = argparse.ArgumentParser(description="RAG over local documents with Groq")
    parser.add_argument("--query", "-q", help="Ask one question and exit")
    parser.add_argument("--top-k", type=int, default=5, help="Number of chunks to retrieve")
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Force rebuild of the FAISS index (normally rebuilds automatically when data/ is newer)",
    )
    args = parser.parse_args()

    rag = RAGSearch(rebuild=args.rebuild)

    if args.query:
        print(rag.search_and_answer(args.query, top_k=args.top_k))
        return

    print("RAG ready. Type a question (or 'quit' to exit).\n")
    while True:
        try:
            query = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not query or query.lower() in {"quit", "exit", "q"}:
            break
        print(f"\nAssistant: {rag.search_and_answer(query, top_k=args.top_k)}\n")


if __name__ == "__main__":
    main()
