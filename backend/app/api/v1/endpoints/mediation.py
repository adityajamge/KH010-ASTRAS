"""Farmer mediation: view the current proposal, object, or accept it.

Objecting records a structured objection (PS14 §16) and reruns the
deterministic engine with the farmer's priority boosted — the response is a
revised, or evidence-backed unchanged, proposal. Accepting freezes a
versioned agreement (PS14 §20).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import AuthUser, require_farmer
from app.schemas.conflict import AgreementRead
from app.schemas.dashboard import (
    AcceptResult,
    MediationView,
    ObjectionResult,
    ObjectionSubmit,
)
from app.services.farmers import get_own_farmer
from app.services.mediation import accept_proposal, mediation_view, record_objection
from app.db.session import get_db

router = APIRouter(prefix="/mediation", tags=["mediation"])

#: Labels shown as objection chips in the UI, in enum order.
OBJECTION_OPTIONS = [
    "Need more water",
    "Need different time",
    "Crop critical",
    "Emergency",
    "Other",
]


@router.get("/me", response_model=MediationView)
def read_own_mediation(
    user: AuthUser = Depends(require_farmer), db: Session = Depends(get_db)
) -> MediationView:
    """The signed-in farmer's current proposal plus glass-box evidence."""
    farmer = get_own_farmer(db, user)
    return MediationView(**mediation_view(db, farmer), objection_options=OBJECTION_OPTIONS)


@router.post("/objections", response_model=ObjectionResult)
def submit_objection(
    payload: ObjectionSubmit,
    user: AuthUser = Depends(require_farmer),
    db: Session = Depends(get_db),
) -> ObjectionResult:
    """Object to the proposal; returns the recalculated proposal."""
    farmer = get_own_farmer(db, user)
    try:
        result = record_objection(
            db, farmer, user, payload.reason, payload.details
        )
    except ValueError as exc:
        message = str(exc)
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
                if message.startswith("No open")
                else status.HTTP_400_BAD_REQUEST
            ),
            detail=message,
        )
    db.commit()
    return ObjectionResult(**result)


@router.post("/accept", response_model=AcceptResult)
def accept_current_proposal(
    user: AuthUser = Depends(require_farmer), db: Session = Depends(get_db)
) -> AcceptResult:
    """Accept the proposal; freezes a versioned agreement."""
    farmer = get_own_farmer(db, user)
    try:
        agreement = accept_proposal(db, farmer, user)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        )
    allocated = float(agreement.final_allocation.get(str(farmer.id), 0.0))
    db.commit()
    db.refresh(agreement)
    return AcceptResult(
        agreement=AgreementRead.model_validate(agreement), allocated=allocated
    )
