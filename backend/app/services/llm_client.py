"""Provider-agnostic LLM client for the AI Coordinator.

docs/PS14_Water_Sharing_Mediation_Agent.md §§12.1, 26, 29: the LLM is the
orchestrator and communication layer, never the source of truth for litres.
This module only normalizes Anthropic's and OpenAI's different tool-calling
wire shapes into one interface so app.services.ai_coordinator's agent loop
never branches on provider — it always calls a deterministic tool
(app.services.mediation / app.services.requests) to get real numbers.

Selected via ``settings.LLM_PROVIDER`` ("anthropic" | "openai"). Swapping
providers is a config change, not a code change.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from app.core.config import settings


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class LLMTurn:
    """One assistant turn: final text (if any) and/or tool calls to run."""

    text: str | None
    tool_calls: list[ToolCall] = field(default_factory=list)
    # Provider-native content, opaque outside this module — round-tripped
    # back into the next request via assistant_message().
    raw: Any = None


class LLMNotConfigured(RuntimeError):
    """The selected provider has no API key set — caller should show a
    friendly "assistant not connected" reply instead of a 500."""


class LLMClient:
    """Normalized interface: one tool schema in, one turn out."""

    def complete(self, system: str, history: list[dict], tools: list[dict]) -> LLMTurn:
        raise NotImplementedError

    def assistant_message(self, turn: LLMTurn) -> dict:
        """The message to append to history for the turn just completed."""
        raise NotImplementedError

    def tool_result_messages(
        self, turn: LLMTurn, results: list[tuple[str, str, bool]]
    ) -> list[dict]:
        """``results`` is (tool_use_id, content, is_error) per tool call in
        ``turn``, in the same order. Returns the message(s) to append next —
        one grouped message for Anthropic, one per result for OpenAI."""
        raise NotImplementedError


#: Both SDKs default to a 10-minute request timeout retried up to twice —
#: fine for a one-off script, not for a call sitting in the critical path
#: of a chat request. Bounded here so a slow/unresponsive provider degrades
#: in seconds, not minutes (this was a real, measured cause of the
#: "sometimes slow" symptom — see docs/EDGE_CASE_AUDIT.md).
_REQUEST_TIMEOUT_SECONDS = 20
_MAX_RETRIES = 1


class AnthropicClient(LLMClient):
    def __init__(self) -> None:
        if not settings.ANTHROPIC_API_KEY:
            raise LLMNotConfigured("ANTHROPIC_API_KEY is not set")
        import anthropic

        self._client = anthropic.Anthropic(
            api_key=settings.ANTHROPIC_API_KEY,
            timeout=_REQUEST_TIMEOUT_SECONDS,
            max_retries=_MAX_RETRIES,
        )
        self._model = settings.ANTHROPIC_MODEL

    def complete(self, system: str, history: list[dict], tools: list[dict]) -> LLMTurn:
        anthropic_tools = [
            {
                "name": t["name"],
                "description": t["description"],
                "input_schema": t["parameters"],
            }
            for t in tools
        ]
        response = self._client.messages.create(
            model=self._model,
            max_tokens=1024,
            system=system,
            tools=anthropic_tools,
            messages=history,
        )
        text = next(
            (b.text for b in response.content if b.type == "text"), None
        )
        tool_calls = [
            ToolCall(id=b.id, name=b.name, arguments=b.input)
            for b in response.content
            if b.type == "tool_use"
        ]
        return LLMTurn(text=text, tool_calls=tool_calls, raw=response.content)

    def assistant_message(self, turn: LLMTurn) -> dict:
        return {"role": "assistant", "content": turn.raw}

    def tool_result_messages(
        self, turn: LLMTurn, results: list[tuple[str, str, bool]]
    ) -> list[dict]:
        return [
            {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_use_id,
                        "content": content,
                        "is_error": is_error,
                    }
                    for tool_use_id, content, is_error in results
                ],
            }
        ]


class OpenAIClient(LLMClient):
    def __init__(self) -> None:
        if not settings.OPENAI_API_KEY:
            raise LLMNotConfigured("OPENAI_API_KEY is not set")
        import openai

        self._client = openai.OpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=_REQUEST_TIMEOUT_SECONDS,
            max_retries=_MAX_RETRIES,
        )
        self._model = settings.OPENAI_MODEL

    def complete(self, system: str, history: list[dict], tools: list[dict]) -> LLMTurn:
        openai_tools = [
            {
                "type": "function",
                "function": {
                    "name": t["name"],
                    "description": t["description"],
                    "parameters": t["parameters"],
                },
            }
            for t in tools
        ]
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "system", "content": system}, *history],
            tools=openai_tools or None,
        )
        message = response.choices[0].message
        tool_calls = [
            ToolCall(
                id=tc.id,
                name=tc.function.name,
                arguments=json.loads(tc.function.arguments) if tc.function.arguments else {},
            )
            for tc in (message.tool_calls or [])
        ]
        return LLMTurn(text=message.content, tool_calls=tool_calls, raw=message)

    def assistant_message(self, turn: LLMTurn) -> dict:
        message = turn.raw
        out: dict[str, Any] = {"role": "assistant", "content": message.content}
        if message.tool_calls:
            out["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                }
                for tc in message.tool_calls
            ]
        return out

    def tool_result_messages(
        self, turn: LLMTurn, results: list[tuple[str, str, bool]]
    ) -> list[dict]:
        return [
            {
                "role": "tool",
                "tool_call_id": tool_use_id,
                "content": f"ERROR: {content}" if is_error else content,
            }
            for tool_use_id, content, is_error in results
        ]


def get_llm_client() -> LLMClient:
    if settings.LLM_PROVIDER == "openai":
        return OpenAIClient()
    return AnthropicClient()
