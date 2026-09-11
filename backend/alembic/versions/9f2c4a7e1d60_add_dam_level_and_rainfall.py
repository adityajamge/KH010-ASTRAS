"""add dam level and rainfall columns

Revision ID: 9f2c4a7e1d60
Revises: 4cb99b3023b9
Create Date: 2026-09-12

The dam dashboard needs a reservoir level (m) and rainfall observations, and
the dam operator publishes supply state — neither existed as columns, so the
UI could only show mock numbers. All additive with defaults; existing rows
are backfilled to the previously-mocked sample values.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f2c4a7e1d60'
down_revision: Union[str, Sequence[str], None] = '4cb99b3023b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "dams",
        sa.Column("water_level", sa.Numeric(6, 2), server_default="118.4", nullable=False),
    )
    op.add_column(
        "dams",
        sa.Column("rainfall_last_24h", sa.Numeric(8, 2), server_default="18", nullable=False),
    )
    op.add_column(
        "dams",
        sa.Column(
            "rainfall_forecast",
            sa.Text(),
            server_default="Medium — 12mm expected over next 24h",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("dams", "rainfall_forecast")
    op.drop_column("dams", "rainfall_last_24h")
    op.drop_column("dams", "water_level")
