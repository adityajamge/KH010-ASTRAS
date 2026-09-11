"""Assistant chat shapes. Stateless — no server-side conversation memory
(that's a deliberate scope call; a memory framework can be layered on later)."""

from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    # Prior turns from this session, oldest first — the client (not the
    # server) owns conversation state, so it resends what it wants Claude
    # to see.
    history: list[ChatMessage] = Field(default_factory=list, max_length=40)


class ChatResponse(BaseModel):
    reply: str
