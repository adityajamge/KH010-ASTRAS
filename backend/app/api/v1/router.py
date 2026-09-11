from fastapi import APIRouter

from app.api.v1.endpoints import canals, dashboard, dams, farmers, health, mediation, me, requests

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(me.router)
api_router.include_router(farmers.router)
api_router.include_router(canals.router)
api_router.include_router(dams.router)
api_router.include_router(requests.router)
api_router.include_router(dashboard.router)
api_router.include_router(mediation.router)
