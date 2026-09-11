"""checkpoint: villages table + farmer clerk linkage

This revision id (6abc13fa7ddc) was already stamped directly on the shared
dev database by another session before this file existed locally — it added
a `villages` table and linked `farmers` to it (village_id) and to Clerk
(clerk_user_id), applied outside this repo's migration history. This file
backfills the migration that describes that already-applied change, so
Alembic's history is coherent again and a fresh database can reach the same
state. Do not expect `upgrade()` to run against the shared dev DB — it's
already there; this matters for anyone migrating a *new* database from zero.

Revision ID: 6abc13fa7ddc
Revises: 8a468308b66a
Create Date: 2026-09-11 19:12:22.541902

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6abc13fa7ddc'
down_revision: Union[str, Sequence[str], None] = '8a468308b66a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "villages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.add_column("farmers", sa.Column("clerk_user_id", sa.String(length=191), nullable=False))
    op.add_column("farmers", sa.Column("village_id", sa.Integer(), nullable=False))
    op.create_foreign_key(
        "farmers_village_id_fkey", "farmers", "villages", ["village_id"], ["id"]
    )
    op.drop_column("farmers", "village")


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        "farmers", sa.Column("village", sa.String(length=120), nullable=False, server_default="")
    )
    op.drop_constraint("farmers_village_id_fkey", "farmers", type_="foreignkey")
    op.drop_column("farmers", "village_id")
    op.drop_column("farmers", "clerk_user_id")
    op.drop_table("villages")
