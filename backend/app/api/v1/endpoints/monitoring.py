"""Ground evidence for Jal Vigyani: recording flow measurements and
reporting infrastructure/water-loss anomalies, scoped to the account's dam.

docs/Dashboards/PS14_Three_Interfaces_User_Stories_UI.md JV-US-02 (Record
Water Flow) / JV-US-03 (Report Infrastructure Problem);
docs/Dashboards/PS14_Dashboard_Feature_Specification.md §4.7 — anomalies
are reported as "investigation required", never as a conclusion of theft.
"""

import math

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import require_jal_vigyani_dam_id
from app.db.session import get_db
from app.models.monitoring import Anomaly, SensorReading
from app.models.network import Canal
from app.schemas.monitoring import (
    AnomalyCreate,
    AnomalyRead,
    AnomalyStatusUpdate,
    SensorReadingCreate,
    SensorReadingRead,
)

router = APIRouter(prefix="/monitoring", tags=["monitoring"])

#: A reading further above a canal's physical capacity than this is not a
#: real measurement — some slack is allowed for a canal briefly running
#: above its nominal rating, not for a sensor fault reporting several times
#: the canal's physical size (PS14 edge-case audit §1.4/§9.1).
_MAX_FLOW_OVER_CAPACITY = 1.5
#: A reading more than this many times the previous one at the same
#: location is flagged as an implausible jump rather than silently trusted
#: (PS14 §1.4 "rate-of-change checks"). This is a heuristic guard against
#: an obviously stuck/glitching sensor, not a scientific threshold — a
#: genuine sudden event (gate opened, pump started) should be filed as an
#: anomaly instead, which carries its own investigation workflow.
_MAX_FLOW_JUMP_RATIO = 4.0


def _own_canal_ids(db: Session, dam_id: int) -> list[int]:
    return [row[0] for row in db.query(Canal.id).filter(Canal.dam_id == dam_id).all()]


def _require_own_canal(db: Session, dam_id: int, canal_id: int) -> Canal:
    canal = db.get(Canal, canal_id)
    if canal is None or canal_id not in _own_canal_ids(db, dam_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Canal not found for this dam")
    return canal


def _validate_sensor_reading(db: Session, canal: Canal, payload: SensorReadingCreate) -> None:
    """Range + rate-of-change sanity checks, so an impossible/stuck/glitching
    reading is rejected before it ever reaches the water balance instead of
    silently corrupting it (PS14 loophole audit §1.4, §9.1, §9.2, §9.5)."""
    if not (math.isfinite(payload.flow) and math.isfinite(payload.water_level)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Flow and water level must be finite numbers")
    if payload.flow < 0 or payload.water_level < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Flow and water level cannot be negative")
    if payload.flow > float(canal.capacity) * _MAX_FLOW_OVER_CAPACITY:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=(
                f"{payload.flow:.0f} exceeds canal {canal.name}'s capacity "
                f"({float(canal.capacity):.0f}) by more than a physically plausible margin — "
                "check the sensor before recording this reading."
            ),
        )

    last = (
        db.query(SensorReading)
        .filter(SensorReading.canal_id == payload.canal_id, SensorReading.location == payload.location)
        .order_by(SensorReading.recorded_at.desc())
        .first()
    )
    if last is not None and float(last.flow) > 0:
        jump = payload.flow / float(last.flow)
        if jump > _MAX_FLOW_JUMP_RATIO or jump < 1 / _MAX_FLOW_JUMP_RATIO:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"{payload.flow:.0f} is a {jump:.1f}x jump from the last reading at this "
                    f"location ({float(last.flow):.0f}) — looks like a sensor fault. If this is "
                    "a genuine sudden change, report it as an anomaly instead so it's investigated."
                ),
            )


@router.get("/sensor-readings", response_model=list[SensorReadingRead])
def list_sensor_readings(
    canal_id: int | None = None,
    dam_id: int = Depends(require_jal_vigyani_dam_id),
    db: Session = Depends(get_db),
) -> list[SensorReading]:
    canal_ids = _own_canal_ids(db, dam_id)
    if canal_id is not None:
        _require_own_canal(db, dam_id, canal_id)
        canal_ids = [canal_id]
    if not canal_ids:
        return []
    return (
        db.query(SensorReading)
        .filter(SensorReading.canal_id.in_(canal_ids))
        .order_by(SensorReading.recorded_at.desc())
        .limit(200)
        .all()
    )


@router.post(
    "/sensor-readings", response_model=SensorReadingRead, status_code=status.HTTP_201_CREATED
)
def record_sensor_reading(
    payload: SensorReadingCreate,
    dam_id: int = Depends(require_jal_vigyani_dam_id),
    db: Session = Depends(get_db),
) -> SensorReading:
    """JV-US-02 — record an observed water-flow measurement."""
    canal = _require_own_canal(db, dam_id, payload.canal_id)
    _validate_sensor_reading(db, canal, payload)
    reading = SensorReading(**payload.model_dump())
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading


@router.get("/anomalies", response_model=list[AnomalyRead])
def list_anomalies(
    dam_id: int = Depends(require_jal_vigyani_dam_id), db: Session = Depends(get_db)
) -> list[Anomaly]:
    return anomalies_for_canals(db, _own_canal_ids(db, dam_id))


def anomalies_for_canals(db: Session, canal_ids: list[int]) -> list[Anomaly]:
    """Plain function, not a route — see farmer_allocations_for_canals in
    jal_vigyani.py for why (avoids re-deriving canal_ids a caller already
    has). Never call with caller-supplied ids from an HTTP request."""
    if not canal_ids:
        return []
    return (
        db.query(Anomaly)
        .filter(Anomaly.canal_id.in_(canal_ids))
        .order_by(Anomaly.created_at.desc())
        .all()
    )


@router.post("/anomalies", response_model=AnomalyRead, status_code=status.HTTP_201_CREATED)
def report_anomaly(
    payload: AnomalyCreate,
    dam_id: int = Depends(require_jal_vigyani_dam_id),
    db: Session = Depends(get_db),
) -> Anomaly:
    """JV-US-03 — report a flow discrepancy or infrastructure problem."""
    _require_own_canal(db, dam_id, payload.canal_id)
    anomaly = Anomaly(**payload.model_dump())
    db.add(anomaly)
    db.commit()
    db.refresh(anomaly)
    return anomaly


@router.patch("/anomalies/{anomaly_id}/status", response_model=AnomalyRead)
def update_anomaly_status(
    anomaly_id: int,
    payload: AnomalyStatusUpdate,
    dam_id: int = Depends(require_jal_vigyani_dam_id),
    db: Session = Depends(get_db),
) -> Anomaly:
    """§4.9 — investigation workflow: investigating / resolved / dismissed."""
    anomaly = (
        db.query(Anomaly)
        .filter(Anomaly.id == anomaly_id, Anomaly.canal_id.in_(_own_canal_ids(db, dam_id)))
        .first()
    )
    if anomaly is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Anomaly not found")
    anomaly.status = payload.status
    db.commit()
    db.refresh(anomaly)
    return anomaly
