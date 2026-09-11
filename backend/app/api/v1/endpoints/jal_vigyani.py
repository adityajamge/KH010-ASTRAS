"""Jal Vigyani dashboard: dam-scoped read views over canals, farmer
allocation status, under-delivery cases, and the canal schedule.

docs/Dashboards/PS14_Dashboard_Feature_Specification.md §4 (Canal
Authority) and docs/Dashboards/PS14_Three_Interfaces_User_Stories_UI.md
Interface 2 (Jal Vigyani) — this codebase has one combined jal_vigyani
role covering both, scoped to the dam in the account's
publicMetadata.dam_id (see app/core/auth.py).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.auth import require_jal_vigyani_dam_id
from app.db.session import get_db
from app.models.conflict import Conflict
from app.models.enums import AnomalyStatus, ConflictStatus, DeliveryStatus
from app.models.farmer import Farmer
from app.models.monitoring import Anomaly
from app.models.network import Canal, Dam
from app.models.request import Allocation, Delivery, Schedule, WaterRequest
from app.models.village import Village
from app.schemas.jal_vigyani import (
    CanalAssignmentRequest,
    CanalScheduleRow,
    FarmerAllocationSummary,
    FarmerCanalRow,
    JalVigyaniOverview,
    UnderDeliveryRow,
)
from app.schemas.network import CanalRead, DamRead

router = APIRouter(prefix="/jal-vigyani", tags=["jal-vigyani"])


def _dam_canal_ids(db: Session, dam_id: int) -> list[int]:
    return [row[0] for row in db.query(Canal.id).filter(Canal.dam_id == dam_id).all()]


@router.get("/overview", response_model=JalVigyaniOverview)
def get_overview(
    dam_id: int = Depends(require_jal_vigyani_dam_id), db: Session = Depends(get_db)
) -> JalVigyaniOverview:
    dam = db.get(Dam, dam_id)
    if dam is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Dam not found")

    canals = db.query(Canal).filter(Canal.dam_id == dam_id).order_by(Canal.name).all()
    canal_ids = [c.id for c in canals]
    if not canal_ids:
        return JalVigyaniOverview(
            dam=DamRead.model_validate(dam),
            canals=[],
            farmer_count=0,
            active_conflicts=0,
            active_anomalies=0,
            under_delivery_count=0,
        )

    farmer_count = (
        db.query(func.count(Farmer.id)).filter(Farmer.canal_id.in_(canal_ids)).scalar()
        or 0
    )
    active_conflicts = (
        db.query(func.count(Conflict.id))
        .filter(
            Conflict.canal_id.in_(canal_ids),
            Conflict.status != ConflictStatus.RESOLVED,
        )
        .scalar()
        or 0
    )
    active_anomalies = (
        db.query(func.count(Anomaly.id))
        .filter(
            Anomaly.canal_id.in_(canal_ids),
            Anomaly.status.notin_([AnomalyStatus.RESOLVED, AnomalyStatus.DISMISSED]),
        )
        .scalar()
        or 0
    )
    under_delivery_count = (
        db.query(func.count(Delivery.id))
        .join(Allocation, Delivery.allocation_id == Allocation.id)
        .join(Farmer, Allocation.farmer_id == Farmer.id)
        .filter(
            Farmer.canal_id.in_(canal_ids),
            Delivery.delivery_status.in_(
                [DeliveryStatus.UNDER_DELIVERY, DeliveryStatus.INVESTIGATION_REQUIRED]
            ),
        )
        .scalar()
        or 0
    )

    return JalVigyaniOverview(
        dam=DamRead.model_validate(dam),
        canals=[CanalRead.model_validate(c) for c in canals],
        farmer_count=farmer_count,
        active_conflicts=active_conflicts,
        active_anomalies=active_anomalies,
        under_delivery_count=under_delivery_count,
    )


@router.get("/farmer-allocations", response_model=list[FarmerAllocationSummary])
def get_farmer_allocations(
    dam_id: int = Depends(require_jal_vigyani_dam_id), db: Session = Depends(get_db)
) -> list[FarmerAllocationSummary]:
    """Each farmer's most recent request/allocation/delivery. §4.5"""
    canal_ids = _dam_canal_ids(db, dam_id)
    if not canal_ids:
        return []

    farmers = (
        db.query(Farmer).filter(Farmer.canal_id.in_(canal_ids)).order_by(Farmer.name).all()
    )

    rows: list[FarmerAllocationSummary] = []
    for farmer in farmers:
        latest_request = (
            db.query(WaterRequest)
            .filter(WaterRequest.farmer_id == farmer.id)
            .order_by(WaterRequest.request_date.desc(), WaterRequest.created_at.desc())
            .first()
        )
        allocation = (
            db.query(Allocation).filter(Allocation.request_id == latest_request.id).first()
            if latest_request
            else None
        )
        delivery = (
            db.query(Delivery).filter(Delivery.allocation_id == allocation.id).first()
            if allocation
            else None
        )

        allocated = float(allocation.allocated_quantity) if allocation else None
        delivered = float(delivery.delivered_quantity) if delivery else None
        shortfall = (
            round(allocated - delivered, 2)
            if allocated is not None and delivered is not None
            else None
        )
        if delivery is not None:
            row_status = delivery.delivery_status.value
        elif allocation is not None:
            row_status = allocation.status.value
        elif latest_request is not None:
            row_status = latest_request.status.value
        else:
            row_status = "no_request"

        rows.append(
            FarmerAllocationSummary(
                farmer_id=farmer.id,
                farmer_name=farmer.name,
                requested=(
                    float(latest_request.quantity_requested) if latest_request else None
                ),
                allocated=allocated,
                delivered=delivered,
                shortfall=shortfall,
                status=row_status,
            )
        )
    return rows


@router.get("/under-delivery", response_model=list[UnderDeliveryRow])
def get_under_delivery(
    dam_id: int = Depends(require_jal_vigyani_dam_id), db: Session = Depends(get_db)
) -> list[UnderDeliveryRow]:
    """§4.8 — deliveries currently short or flagged for investigation."""
    canal_ids = _dam_canal_ids(db, dam_id)
    if not canal_ids:
        return []

    rows = (
        db.query(Delivery, Farmer)
        .join(Allocation, Delivery.allocation_id == Allocation.id)
        .join(Farmer, Allocation.farmer_id == Farmer.id)
        .filter(
            Farmer.canal_id.in_(canal_ids),
            Delivery.delivery_status.in_(
                [DeliveryStatus.UNDER_DELIVERY, DeliveryStatus.INVESTIGATION_REQUIRED]
            ),
        )
        .order_by(Delivery.created_at.desc())
        .all()
    )
    return [
        UnderDeliveryRow(
            delivery_id=delivery.id,
            farmer_id=farmer.id,
            farmer_name=farmer.name,
            allocated_quantity=float(delivery.allocated_quantity),
            delivered_quantity=float(delivery.delivered_quantity),
            shortfall=round(
                float(delivery.allocated_quantity) - float(delivery.delivered_quantity), 2
            ),
            status=delivery.delivery_status,
        )
        for delivery, farmer in rows
    ]


@router.get("/schedule", response_model=list[CanalScheduleRow])
def get_canal_schedule(
    dam_id: int = Depends(require_jal_vigyani_dam_id), db: Session = Depends(get_db)
) -> list[CanalScheduleRow]:
    """§4.10 — every farmer's time slot across the dam's canals."""
    canal_ids = _dam_canal_ids(db, dam_id)
    if not canal_ids:
        return []

    rows = (
        db.query(Schedule, Farmer)
        .join(Farmer, Schedule.farmer_id == Farmer.id)
        .filter(Farmer.canal_id.in_(canal_ids))
        .order_by(Schedule.date, Schedule.start_time)
        .all()
    )
    return [
        CanalScheduleRow(
            schedule_id=schedule.id,
            farmer_id=farmer.id,
            farmer_name=farmer.name,
            date=schedule.date,
            start_time=schedule.start_time,
            end_time=schedule.end_time,
            quantity=float(schedule.quantity),
            status=schedule.status,
        )
        for schedule, farmer in rows
    ]


def _farmer_canal_row(farmer: Farmer, village_name: str, canal_name: str | None) -> FarmerCanalRow:
    return FarmerCanalRow(
        farmer_id=farmer.id,
        farmer_name=farmer.name,
        village=village_name,
        phone=farmer.phone,
        canal_id=farmer.canal_id,
        canal_name=canal_name,
    )


@router.get("/farmers", response_model=list[FarmerCanalRow])
def list_assignable_farmers(
    dam_id: int = Depends(require_jal_vigyani_dam_id), db: Session = Depends(get_db)
) -> list[FarmerCanalRow]:
    """Farmers this dam's Jal Vigyani can assign a canal to: anyone still
    unassigned, plus anyone already on one of this dam's canals. Farmers
    assigned to another dam's canal never appear."""
    canal_ids = _dam_canal_ids(db, dam_id)
    visibility = (
        or_(Farmer.canal_id.is_(None), Farmer.canal_id.in_(canal_ids))
        if canal_ids
        else Farmer.canal_id.is_(None)
    )
    rows = (
        db.query(Farmer, Village.name, Canal.name)
        .join(Village, Farmer.village_id == Village.id)
        .outerjoin(Canal, Farmer.canal_id == Canal.id)
        .filter(visibility)
        .order_by(Farmer.name)
        .all()
    )
    return [
        _farmer_canal_row(farmer, village_name, canal_name)
        for farmer, village_name, canal_name in rows
    ]


@router.patch("/farmers/{farmer_id}/canal", response_model=FarmerCanalRow)
def assign_farmer_canal(
    farmer_id: int,
    payload: CanalAssignmentRequest,
    dam_id: int = Depends(require_jal_vigyani_dam_id),
    db: Session = Depends(get_db),
) -> FarmerCanalRow:
    """Assign (or, with canal_id null, unassign) a farmer's canal."""
    farmer = db.get(Farmer, farmer_id)
    if farmer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Farmer not found")

    canal_ids = _dam_canal_ids(db, dam_id)
    if not (farmer.canal_id is None or farmer.canal_id in canal_ids):
        # Not visible to this dam's Jal Vigyani — don't leak that they exist.
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Farmer not found")

    if payload.canal_id is not None:
        canal = db.get(Canal, payload.canal_id)
        if canal is None or canal.dam_id != dam_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Canal does not belong to your dam",
            )

    farmer.canal_id = payload.canal_id
    db.commit()
    db.refresh(farmer)

    village = db.get(Village, farmer.village_id)
    canal_name = db.get(Canal, farmer.canal_id).name if farmer.canal_id else None
    return _farmer_canal_row(farmer, village.name if village else "", canal_name)
