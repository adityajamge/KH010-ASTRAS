from sqlalchemy import ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import (
    AgreementStatus,
    ConflictStatus,
    ObjectionReason,
    ObjectionStatus,
    PriorityLevel,
)


class Conflict(Base, TimestampMixin):
    __tablename__ = "conflicts"

    id: Mapped[int] = mapped_column(primary_key=True)
    conflict_code: Mapped[str] = mapped_column(String(20), unique=True)
    canal_id: Mapped[int] = mapped_column(ForeignKey("canals.id", ondelete="CASCADE"))
    status: Mapped[ConflictStatus] = mapped_column(default=ConflictStatus.DETECTED)
    total_demand: Mapped[float] = mapped_column(Numeric(10, 2))
    available_water: Mapped[float] = mapped_column(Numeric(10, 2))
    shortage: Mapped[float] = mapped_column(Numeric(10, 2))
    priority: Mapped[PriorityLevel] = mapped_column(default=PriorityLevel.NORMAL)
    proposal: Mapped[str | None] = mapped_column(Text, nullable=True)


class ConflictParticipant(Base):
    """Every farmer a conflict concerns — not just the ones who object.

    docs/Dashboards/PS14_Dashboard_Feature_Specification.md §4.6 lists all
    farmers involved in a conflict ("Farmers: A, B, C") even though only one
    of them may have filed an objection.
    """

    __tablename__ = "conflict_participants"
    __table_args__ = (UniqueConstraint("conflict_id", "farmer_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    conflict_id: Mapped[int] = mapped_column(ForeignKey("conflicts.id", ondelete="CASCADE"))
    farmer_id: Mapped[int] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"))
    request_id: Mapped[int | None] = mapped_column(
        ForeignKey("water_requests.id", ondelete="SET NULL"), nullable=True
    )


class Objection(Base, TimestampMixin):
    __tablename__ = "objections"

    id: Mapped[int] = mapped_column(primary_key=True)
    conflict_id: Mapped[int] = mapped_column(ForeignKey("conflicts.id", ondelete="CASCADE"))
    farmer_id: Mapped[int] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"))
    reason: Mapped[ObjectionReason]
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ObjectionStatus] = mapped_column(default=ObjectionStatus.PENDING)
    #: Mediation agent's negotiation-style reply, grounded in the engine's
    #: numbers/evidence (never a source of numbers itself). Null when the
    #: LLM was unconfigured or unreachable — the deterministic reason still
    #: covers that case.
    mediator_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class Agreement(Base, TimestampMixin):
    """Versioned, auditable record of a finalized allocation.

    docs/PS14_Water_Sharing_Mediation_Agent.md §20 / §CROSS-US-07: once
    farmers accept a proposal it becomes its own immutable/versioned record
    distinct from the audit event log — allocations can keep changing, but
    each accepted agreement is a frozen snapshot.
    """

    __tablename__ = "agreements"

    id: Mapped[int] = mapped_column(primary_key=True)
    agreement_code: Mapped[str] = mapped_column(String(30), unique=True)
    conflict_id: Mapped[int | None] = mapped_column(
        ForeignKey("conflicts.id", ondelete="SET NULL"), nullable=True
    )
    canal_id: Mapped[int | None] = mapped_column(
        ForeignKey("canals.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[AgreementStatus] = mapped_column(default=AgreementStatus.PROPOSED)
    version: Mapped[int] = mapped_column(Integer, default=1)
    # Snapshot at acceptance time — {farmer_id: allocated_quantity, ...}.
    final_allocation: Mapped[dict] = mapped_column(JSON)
    participants: Mapped[list] = mapped_column(JSON)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Points at the agreement this one replaces, forming a version chain.
    supersedes_id: Mapped[int | None] = mapped_column(
        ForeignKey("agreements.id", ondelete="SET NULL"), nullable=True
    )
