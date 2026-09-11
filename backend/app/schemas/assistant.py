from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ChannelType, MessageRole
from app.schemas.common import ORMBase


class AssistantMessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class AssistantMessageOut(BaseModel):
    reply: str


class AssistantHistoryItem(ORMBase):
    role: MessageRole
    content: str
    channel: ChannelType
    created_at: datetime
