"""seed 10 more canals on Rampur Dam

Revision ID: 4cb99b3023b9
Revises: 8d19312d894e
Create Date: 2026-09-11 19:58:43.966520

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4cb99b3023b9'
down_revision: Union[str, Sequence[str], None] = '8d19312d894e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Seed canals C2..C11 (10 rows) on the Rampur Dam, alongside the
    existing C1 (see 8d19312d894e). Capacity/flow/level values are varied
    but plausible sample data, same spirit as C1's spec-derived numbers."""
    canals = [
        (2, "C2", 1000, 820, 2.1),
        (3, "C3", 950, 780, 1.9),
        (4, "C4", 1100, 900, 2.2),
        (5, "C5", 1050, 860, 2.0),
        (6, "C6", 900, 700, 1.8),
        (7, "C7", 1150, 940, 2.3),
        (8, "C8", 980, 810, 2.0),
        (9, "C9", 1020, 830, 2.1),
        (10, "C10", 890, 690, 1.7),
        (11, "C11", 1080, 870, 2.15),
    ]
    insert = sa.text(
        """
        INSERT INTO canals
            (id, dam_id, name, capacity, current_flow, water_level, created_at, updated_at)
        VALUES
            (:id, 1, :name, :capacity, :current_flow, :water_level, now(), now())
        ON CONFLICT (id) DO NOTHING
        """
    )
    for id_, name, capacity, current_flow, water_level in canals:
        op.execute(
            insert.bindparams(
                id=id_,
                name=name,
                capacity=capacity,
                current_flow=current_flow,
                water_level=water_level,
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
    op.execute(sa.text("DELETE FROM canals WHERE id BETWEEN 2 AND 11"))
