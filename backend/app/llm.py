"""Thin Gemini wrapper for the agent's synthesis step. Any failure/timeout is
caught by the caller (app/agent.py) and degrades gracefully -- this module
just raises so callers can decide what "gracefully" means.
"""
from __future__ import annotations

import json

import google.generativeai as genai

from app.config import settings


def _model():
    api_key = settings.require_gemini()
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(settings.gemini_model)


def synthesize_json(prompt: str, timeout_s: int = 25) -> dict:
    """Calls Gemini and parses a JSON object out of the response. Raises on
    any failure (missing key, network error, bad JSON) -- caller handles it."""
    model = _model()
    response = model.generate_content(
        prompt,
        generation_config={"response_mime_type": "application/json", "temperature": 0.2},
        request_options={"timeout": timeout_s},
    )
    text = response.text
    return json.loads(text)
