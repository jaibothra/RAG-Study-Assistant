from typing import Dict, List, Optional

from src.supabase_client import get_supabase

# ─── In-memory nudge store (ephemeral, intentionally not persisted) ──────────
# Nudges are single-turn state — no value in persisting across restarts
_last_nudge: Dict[str, str] = {}


# ─── Session management ───────────────────────────────────────────────────────
def create_session(space_id: str, title: str = "New Session") -> str:
    """Create a new session in Supabase. Returns the new session ID."""
    sb = get_supabase()
    result = sb.table("sessions").insert({"space_id": space_id, "title": title}).execute()
    return result.data[0]["id"]


def get_sessions(space_id: str) -> List[Dict]:
    """Return all sessions for a space ordered by most recent first."""
    sb = get_supabase()
    result = (
        sb.table("sessions")
        .select("id, title, created_at, updated_at")
        .eq("space_id", space_id)
        .order("updated_at", desc=True)
        .execute()
    )
    return result.data


def session_belongs_to_space(session_id: str, space_id: str) -> bool:
    """Return True when the session exists and belongs to the given space."""
    sb = get_supabase()
    result = (
        sb.table("sessions")
        .select("id")
        .eq("id", session_id)
        .eq("space_id", space_id)
        .limit(1)
        .execute()
    )
    return bool(result.data)


def update_session_title(session_id: str, title: str) -> None:
    """Update the title of a session."""
    sb = get_supabase()
    sb.table("sessions").update({"title": title}).eq("id", session_id).execute()


def delete_session(session_id: str) -> None:
    """Delete a session and all its messages (cascade handles messages)."""
    sb = get_supabase()
    sb.table("sessions").delete().eq("id", session_id).execute()


# ─── Message / history management ────────────────────────────────────────────
def get_history(session_id: str) -> List[Dict]:
    """Return full message history for a session as list of {role, content}."""
    sb = get_supabase()
    result = (
        sb.table("messages")
        .select("role, content")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .execute()
    )
    return [{"role": row["role"], "content": row["content"]} for row in result.data]


def get_history_full(session_id: str) -> List[Dict]:
    """Return full message history for frontend display."""
    sb = get_supabase()
    result = (
        sb.table("messages")
        .select("role, content, sources, created_at")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .execute()
    )
    return [
        {
            "role": row["role"],
            "content": row["content"],
            "sources": row.get("sources") or [],
            "created_at": row.get("created_at"),
        }
        for row in result.data
    ]


def get_recent_history(session_id: str, n: int = 6) -> List[Dict]:
    """Return the last n messages for context window management."""
    return get_history(session_id)[-n:]


def add_message(
    session_id: str,
    space_id: str,
    role: str,
    content: str,
    sources: List[str] = [],
) -> None:
    """Append a message to a session."""
    sb = get_supabase()
    sb.table("messages").insert(
        {
            "session_id": session_id,
            "space_id": space_id,
            "role": role,
            "content": content,
            "sources": sources,
        }
    ).execute()


def clear_history(session_id: str) -> None:
    """Delete all messages for a session."""
    sb = get_supabase()
    sb.table("messages").delete().eq("session_id", session_id).execute()
    clear_nudge(session_id)


# ─── Nudge store (in-memory, ephemeral) ───────────────────────────────────────
def set_last_nudge(session_id: str, nudge: str) -> None:
    _last_nudge[session_id] = nudge


def get_last_nudge(session_id: str) -> Optional[str]:
    return _last_nudge.get(session_id, None)


def clear_nudge(session_id: str) -> None:
    _last_nudge.pop(session_id, None)
