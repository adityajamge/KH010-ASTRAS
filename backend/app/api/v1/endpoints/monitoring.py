"""Ground evidence for Jal Vigyani: recording flow measurements and
reporting infrastructure/water-loss anomalies, scoped to the account's dam.

docs/Dashboards/PS14_Three_Interfaces_User_Stories_UI.md JV-US-02 (Record
Water Flow) / JV-US-03 (Report Infrastructure Problem);
docs/Dashboards/PS14_Dashboard_Feature_Specification.md §4.7 — anomalies
are reported as "investigation required", never as a conclusion of theft.
"""

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


def _own_canal_ids(db: Session, dam_id: int) -> list[int]:
    return [row[0] for row in db.query(Canal.id).filter(Canal.dam_id == dam_id).all()]


def _require_own_canal(db: Session, dam_id: int, canal_id: int) -> None:
    if canal_id not in _own_canal_ids(db, dam_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Canal not found for this dam")


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
    _require_own_canal(db, dam_id, payload.canal_id)
    reading = SensorReading(**payload.model_dump())
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading


@router.get("/anomalies", response_model=list[AnomalyRead])
def list_anomalies(
    dam_id: int = Depends(require_jal_vigyani_dam_id), db: Session = Depends(get_db)
) -> list[Anomaly]:
    canal_ids = _own_canal_ids(db, dam_id)
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
