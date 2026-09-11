from fastapi import APIRouter

from app.api.v1.endpoints import (
    assistant,
    canals,
    conflicts,
    dashboard,
    dams,
    farmers,
    health,
    jal_vigyani,
    me,
    mediation,
    monitoring,
    network,
    requests,
    twilio_webhook,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(me.router)
api_router.include_router(farmers.router)
api_router.include_router(canals.router)
api_router.include_router(dams.router)
api_router.include_router(requests.router)
api_router.include_router(dashboard.router)
api_router.include_router(mediation.router)
api_router.include_router(jal_vigyani.router)
api_router.include_router(monitoring.router)
api_router.include_router(conflicts.router)
api_router.include_router(assistant.router)
api_router.include_router(twilio_webhook.router)
api_router.include_router(network.router)
