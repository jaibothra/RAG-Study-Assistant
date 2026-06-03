from typing import List, Any

from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer


class EmbeddingPipeline:
    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
    ):
        self.model = SentenceTransformer(model_name)
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

    def chunk_documents(self, documents: List[Any]) -> List[Any]:
        if not documents:
            return []
        return self.splitter.split_documents(documents)

    def embed_chunks(self, chunks: List[Any]) -> List[List[float]]:
        if not chunks:
            return []
        texts = [chunk.page_content for chunk in chunks]
        return self.model.encode(texts).tolist()
