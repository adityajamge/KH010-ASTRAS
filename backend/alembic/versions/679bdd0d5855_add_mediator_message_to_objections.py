"""add mediator_message to objections

Revision ID: 679bdd0d5855
Revises: 9f2c4a7e1d60
Create Date: 2026-09-12 02:31:53.338613

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '679bdd0d5855'
down_revision: Union[str, Sequence[str], None] = '9f2c4a7e1d60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "objections", sa.Column("mediator_message", sa.Text(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("objections", "mediator_message")
