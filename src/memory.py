from typing import Dict, List, Optional

# swap this dict with Supabase calls later
# Key: space_id, Value: list of message dicts
_store: Dict[str, List[Dict]] = {}

# swap this dict with Supabase calls later
# Key: space_id, Value: the nudge sentence from the last assistant response
_last_nudge: Dict[str, str] = {}


def get_history(space_id: str) -> List[Dict]:
    """Return conversation history for a space. Returns empty list if none."""
    return _store.get(space_id, [])


def add_message(space_id: str, role: str, content: str) -> None:
    """Append a single message to a space's history."""
    if space_id not in _store:
        _store[space_id] = []
    _store[space_id].append({"role": role, "content": content})


def clear_history(space_id: str) -> None:
    """Clear all history and the stored nudge for a space."""
    _store[space_id] = []
    clear_nudge(space_id)


def get_recent_history(space_id: str, n: int = 6) -> List[Dict]:
    """Return the last n messages for context window management."""
    return get_history(space_id)[-n:]


def set_last_nudge(space_id: str, nudge: str) -> None:
    """Store the nudge from the most recent assistant response."""
    _last_nudge[space_id] = nudge


def get_last_nudge(space_id: str) -> Optional[str]:
    """Return the stored nudge for this space, or None if not set."""
    return _last_nudge.get(space_id, None)


def clear_nudge(space_id: str) -> None:
    """Clear the stored nudge after it has been consumed."""
    _last_nudge.pop(space_id, None)
