"""merge assistant_messages and mediator_message heads

Revision ID: 14c1af94c832
Revises: 274c20517e12, 679bdd0d5855
Create Date: 2026-09-12 06:28:46.716997

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '14c1af94c832'
down_revision: Union[str, Sequence[str], None] = ('274c20517e12', '679bdd0d5855')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
