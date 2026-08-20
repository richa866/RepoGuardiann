"""Thin Gemini wrapper for the agent's synthesis step. Any failure/timeout is
caught by the caller (app/agent.py) and degrades gracefully -- this module
just raises so callers can decide what "gracefully" means.
"""
from __future__ import annotations

import json

import google.generativeai as genai

from app.config import settings


def short_error(exc: Exception, limit: int = 150) -> str:
    """Google's API exceptions stringify to many lines (quota violation
    details, doc links, protobuf dumps) -- fine to raise, not fine to log at
    full length every time a caller falls back. Callers logging a Gemini
    failure should use this instead of embedding str(exc) directly."""
    text = str(exc).split("\n", 1)[0].strip()
    return text if len(text) <= limit else text[:limit] + "..."


# Model families that exist on a Gemini API key but aren't suited to this
# app's JSON-synthesis / function-calling workload -- text-to-speech,
# image/video generation, robotics, computer-use, and deep-research models
# return different response shapes (or none at all) and would break
# synthesize_json's JSON-parsing contract and the tool-use loop's
# function-calling contract. Filtering these out is a correctness filter
# (which models can even do this job), not a business-logic magic number.
_UNSUITABLE_MODEL_SUBSTRINGS = (
    "tts", "image", "video", "robotics", "computer-use", "deep-research",
    "gemma", "lyria", "antigravity", "nano-banana", "embedding",
)

_model_list_cache: list[str] | None = None


def get_fallback_models() -> list[str]:
    """Every model this API key can call generateContent on that's suited to
    this workload, with the configured GEMINI_MODEL tried first. Gemini's
    free tier tracks quota PER MODEL
    (GenerateRequestsPerDayPerProjectPerModel-FreeTier) -- when the
    configured model's daily quota is exhausted, every other model on the
    same key still has its own separate, untouched quota, so trying the next
    one is a genuine workaround, not a retry of the same failure.

    Queried from the live API rather than a hand-maintained list in .env, so
    it stays correct as Google adds or retires models without a code or
    config change -- "all models available to this API key" means asking
    the key what it actually has access to, not maintaining a string that
    can silently go stale. Cached for the process lifetime -- the available
    model set doesn't change during a run, and listing models is itself a
    billable API call not worth repeating on every synthesis request.
    """
    global _model_list_cache
    if _model_list_cache is not None:
        return _model_list_cache

    primary = settings.gemini_model
    api_key = settings.require_gemini()
    genai.configure(api_key=api_key)

    try:
        available = [
            m.name.removeprefix("models/")
            for m in genai.list_models()
            if "generateContent" in m.supported_generation_methods
            and not any(bad in m.name.lower() for bad in _UNSUITABLE_MODEL_SUBSTRINGS)
        ]
    except Exception:
        # Listing models is itself an API call and can fail independently of
        # generation (network, auth, even its own quota) -- don't let a
        # listing failure block synthesis entirely; just fall back to
        # whatever's configured.
        available = []

    if not available:
        _model_list_cache = [primary]
    else:
        _model_list_cache = [primary] + [m for m in available if m != primary]
    return _model_list_cache


def synthesize_json(prompt: str, timeout_s: int = 25) -> dict:
    """Calls Gemini and parses a JSON object out of the response. Tries every
    available model on this API key in order (see get_fallback_models)
    before giving up -- a 429 on the configured model doesn't mean every
    model sharing this key is exhausted, since quota is tracked per model.
    Raises the last model's failure if all of them fail; caller handles it
    (evaluate_issue falls all the way through to the deterministic
    rule-based tier only once every model here has failed).
    """
    api_key = settings.require_gemini()
    genai.configure(api_key=api_key)

    last_exc: Exception | None = None
    for model_name in get_fallback_models():
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json", "temperature": 0.2},
                request_options={"timeout": timeout_s},
            )
            return json.loads(response.text)
        except Exception as exc:
            last_exc = exc
            continue
    raise last_exc
