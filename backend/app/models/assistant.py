"""AI Coordinator conversation log — the audit trail for every chat turn,

website and Twilio alike (docs/PS14_Water_Sharing_Mediation_Agent.md "AI Chat
+ Twilio"). ``actor_id`` is the Clerk user id for both channels — a Twilio
message is attributed to the farmer account matched by phone number, never
to an anonymous phone number, so the record reads the same as a website chat.
"""

from datetime import datetime

from sqlalchemy import DateTime, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import ActorType, ChannelType, MessageRole


class AssistantMessage(Base):
    __tablename__ = "assistant_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_type: Mapped[ActorType] = mapped_column(default=ActorType.FARMER)
    actor_id: Mapped[str] = mapped_column(String(120), index=True)
    channel: Mapped[ChannelType] = mapped_column(default=ChannelType.WEB)
    role: Mapped[MessageRole]
    content: Mapped[str] = mapped_column(Text)
    # Tool calls + results for this turn, for the audit trail — never shown
    # verbatim to the farmer, but inspectable by a Jal Vigyani reviewing a
    # dispute (PS14 §19 glass-box principle extended to the chat channel).
    meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
