"""add assistant_messages

Revision ID: 274c20517e12
Revises: 9f2c4a7e1d60
Create Date: 2026-09-11

The AI Coordinator (app/services/ai_coordinator.py) needs a conversation log
shared by the website chat and the Twilio webhook — same table either way,
distinguished only by ``channel``, so a farmer's history reads as one
workflow regardless of which surface they used.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '274c20517e12'
down_revision: Union[str, Sequence[str], None] = '9f2c4a7e1d60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'assistant_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column(
            'actor_type',
            # create_type=False: this enum already exists (created by
            # 8a468308b66a for audit_logs.actor_type) — Alembic's
            # create_table always issues CREATE TYPE for an inline sa.Enum
            # (unlike plain SQLAlchemy metadata.create_all, it does not
            # checkfirst), so reusing the type name here would otherwise
            # fail with "type actortype already exists".
            postgresql.ENUM(
                'FARMER', 'JAL_VIGYANI', 'DAM_OPERATOR', 'SYSTEM', 'AI_AGENT',
                name='actortype', create_type=False,
            ),
            nullable=False,
        ),
        sa.Column('actor_id', sa.String(length=120), nullable=False),
        sa.Column('channel', sa.Enum('WEB', 'TWILIO', name='channeltype'), nullable=False),
        sa.Column('role', sa.Enum('USER', 'ASSISTANT', name='messagerole'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('meta', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_assistant_messages_actor_id'), 'assistant_messages', ['actor_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_assistant_messages_actor_id'), table_name='assistant_messages')
    op.drop_table('assistant_messages')
