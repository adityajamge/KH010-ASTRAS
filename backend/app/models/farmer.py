from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import PriorityLevel


class Farmer(Base, TimestampMixin):
    __tablename__ = "farmers"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Clerk user id (the "sub" claim) — links this profile to the signed-in
    # farmer so the onboarding form only ever runs once per account.
    clerk_user_id: Mapped[str] = mapped_column(String(191), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    # Every farmer is auto-assigned to village id 1 at onboarding — there is
    # no village picker in the UI (single-village prototype).
    village_id: Mapped[int] = mapped_column(ForeignKey("villages.id"))
    phone: Mapped[str] = mapped_column(String(20))
    canal_id: Mapped[int | None] = mapped_column(
        ForeignKey("canals.id", ondelete="SET NULL"), nullable=True
    )
    # Primary/default field for quick lookups (a farmer's other plots live
    # in `fields`, joined on fields.farmer_id). Nullable + SET NULL so the
    # farmer row can be created before its first field. use_alter breaks the
    # farmers<->fields circular FK into a separate ALTER TABLE, so table
    # creation order (and Alembic autogenerate) doesn't deadlock on it.
    field_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "fields.id", ondelete="SET NULL", use_alter=True, name="fk_farmers_field_id"
        ),
        nullable=True,
    )

    fields: Mapped[list["Field"]] = relationship(
        back_populates="farmer", foreign_keys="Field.farmer_id"
    )


class Field(Base, TimestampMixin):
    __tablename__ = "fields"

    id: Mapped[int] = mapped_column(primary_key=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"))
    area_acres: Mapped[float] = mapped_column(Numeric(8, 2))
    crop: Mapped[str] = mapped_column(String(80))
    crop_stage: Mapped[str] = mapped_column(String(80))
    priority: Mapped[PriorityLevel] = mapped_column(default=PriorityLevel.NORMAL)

    farmer: Mapped["Farmer"] = relationship(
        back_populates="fields", foreign_keys=[farmer_id]
    )
