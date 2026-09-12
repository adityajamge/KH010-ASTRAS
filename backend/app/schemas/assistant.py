from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import ChannelType, MessageRole
from app.schemas.common import ORMBase


class AssistantMessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    # The dashboard's language dropdown (frontend/src/lib/i18n.tsx) — when
    # set, the reply follows this rather than whatever language the farmer
    # happened to type in.
    lang: Literal["en", "hi", "mr"] | None = None


class AssistantMessageOut(BaseModel):
    reply: str


class AssistantHistoryItem(ORMBase):
    role: MessageRole
    content: str
    channel: ChannelType
    created_at: datetime
