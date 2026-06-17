import os

from dotenv import load_dotenv
from supabase import Client, create_client
from typing import Optional

load_dotenv()

_client: Optional[Client] = None


def _normalize_supabase_url(url: str) -> str:
    normalized = url.strip().rstrip("/")
    if normalized.endswith("/rest/v1"):
        return normalized[: -len("/rest/v1")]
    return normalized


def get_supabase() -> Client:
    """Return singleton Supabase client."""
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env")
        _client = create_client(_normalize_supabase_url(url), key)
    return _client
