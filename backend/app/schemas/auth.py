from pydantic import BaseModel


class MeResponse(BaseModel):
    user_id: str
    role: str | None = None
    # Assigned dam (dam_operator / jal_vigyani only) — see app/core/auth.py.
    dam_id: int | None = None
