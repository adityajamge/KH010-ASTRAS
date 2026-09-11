"""seed C1 canal on Rampur Dam

Revision ID: 8d19312d894e
Revises: c71910d8fe3f
Create Date: 2026-09-11 19:47:37.313633

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8d19312d894e'
down_revision: Union[str, Sequence[str], None] = 'c71910d8fe3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Seed the single hackathon canal (id=1, "C1") on the Rampur Dam.

    Without this, farmer onboarding's canal picker (GET /canals) has nothing
    to show, so farmers had no path — direct or indirect — to dam_id=1.
    Sample values match docs/Dashboards/PS14_Dashboard_Feature_Specification.md
    §4.1 and the frontend's mock canal-overview numbers.
    """
    op.execute(
        sa.text(
            """
            INSERT INTO canals
                (id, dam_id, name, capacity, current_flow, water_level, created_at, updated_at)
            VALUES
                (1, 1, 'C1', 1200, 1000, 2.4, now(), now())
            ON CONFLICT (id) DO NOTHING
            """
        )
    )
    op.execute(
        sa.text(
            "SELECT setval(pg_get_serial_sequence('canals', 'id'), "
            "(SELECT MAX(id) FROM canals))"
        )
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(sa.text("DELETE FROM canals WHERE id = 1"))
