"""Bridge between a user's provider preference and the core LLM helpers.

Everything evaluative goes through JSON mode at temperature 0 with the fixed
seed (best-effort, provider-dependent — see core.llm). Raises LLMNotConfigured
when no provider has a server-side key, so callers can fall back to keyword
scoring or return a clear error.
"""

from .. import config
from ..core import llm


class LLMNotConfigured(Exception):
    pass


def resolve_for_user(user: dict):
    """Returns (provider_name, model, cfg) for a user's preferences."""
    name, cfg = config.resolve_provider(user.get("preferred_provider", ""))
    if not cfg:
        raise LLMNotConfigured(
            "No LLM provider is configured on the server. Add an API key to .env.")
    model = user.get("preferred_model") or cfg["model"]
    # A model preference saved for a different provider must not leak across.
    if user.get("preferred_provider") != name:
        model = cfg["model"]
    return name, model, cfg


def make_llm_json(user: dict):
    """Zero-config evaluative JSON caller bound to the user's provider prefs:
    llm_json(system, prompt) -> dict."""
    _, model, cfg = resolve_for_user(user)

    def llm_json(system: str, prompt: str) -> dict:
        raw = llm.llm_chat_json(model, system, prompt, cfg["api_key"], cfg["base_url"],
                                temperature=llm.EVALUATIVE_TEMPERATURE,
                                seed=llm.EVALUATIVE_SEED)
        return llm._extract_json(raw)

    return llm_json


def make_llm_chat(user: dict):
    """Narrative chat caller: llm_chat(system, message) -> str."""
    _, model, cfg = resolve_for_user(user)

    def llm_chat(system: str, message: str) -> str:
        return llm.llm_chat(model, system, message, cfg["api_key"], cfg["base_url"])

    return llm_chat


def is_configured(user: dict) -> bool:
    try:
        resolve_for_user(user)
        return True
    except LLMNotConfigured:
        return False
