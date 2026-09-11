"""rename water_sources to dams, link dam to village, canal to dam

Revision ID: 41ab73df085d
Revises: 6abc13fa7ddc
Create Date: 2026-09-11 18:58:37.067237

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '41ab73df085d'
down_revision: Union[str, Sequence[str], None] = '6abc13fa7ddc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.rename_table("water_sources", "dams")
    op.add_column("dams", sa.Column("village_id", sa.Integer(), nullable=False))
    op.create_foreign_key(
        "fk_dams_village_id_villages", "dams", "villages", ["village_id"], ["id"]
    )

    op.add_column("canals", sa.Column("dam_id", sa.Integer(), nullable=False))
    op.create_foreign_key(
        "fk_canals_dam_id_dams",
        "canals",
        "dams",
        ["dam_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("fk_canals_dam_id_dams", "canals", type_="foreignkey")
    op.drop_column("canals", "dam_id")

    op.drop_constraint("fk_dams_village_id_villages", "dams", type_="foreignkey")
    op.drop_column("dams", "village_id")
    op.rename_table("dams", "water_sources")
