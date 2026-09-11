from fastapi import APIRouter

from app.api.v1.endpoints import canals, conflicts, farmers, health, jal_vigyani, me, monitoring

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(me.router)
api_router.include_router(farmers.router)
api_router.include_router(canals.router)
api_router.include_router(jal_vigyani.router)
api_router.include_router(monitoring.router)
api_router.include_router(conflicts.router)
