"""seed Rampur Dam

Revision ID: c71910d8fe3f
Revises: 41ab73df085d
Create Date: 2026-09-11 18:58:57.107840

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c71910d8fe3f'
down_revision: Union[str, Sequence[str], None] = '41ab73df085d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Seed the single hackathon village + dam (id=1 each).

    Dynamic dam state (storage/inflow/outflow) starts at the sample values
    from docs/Dashboards/PS14_Dashboard_Feature_Specification.md §5.1,
    matching the frontend's mock dam-overview numbers. Both are seeded
    infrastructure, never created through the app, so this is the only
    place these rows get inserted. Village id=1 "Rampur" may already exist
    (applied directly on the shared dev DB before this migration existed) —
    ON CONFLICT DO NOTHING makes this idempotent either way.
    """
    op.execute(
        sa.text(
            """
            INSERT INTO villages (id, name, created_at, updated_at)
            VALUES (1, 'Rampur', now(), now())
            ON CONFLICT (id) DO NOTHING
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO dams
                (id, name, village_id, total_available, current_storage, inflow, outflow, created_at, updated_at)
            VALUES
                (1, 'Rampur Dam', 1, 4200, 5000, 850, 700, now(), now())
            ON CONFLICT (id) DO NOTHING
            """
        )
    )
    # Explicit ids above bypass the sequences — realign them so the next
    # app-driven insert (if any) doesn't collide with id=1.
    op.execute(
        sa.text(
            "SELECT setval(pg_get_serial_sequence('villages', 'id'), "
            "(SELECT MAX(id) FROM villages))"
        )
    )
    op.execute(
        sa.text(
            "SELECT setval(pg_get_serial_sequence('dams', 'id'), "
            "(SELECT MAX(id) FROM dams))"
        )
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(sa.text("DELETE FROM dams WHERE id = 1"))
    op.execute(sa.text("DELETE FROM villages WHERE id = 1"))
