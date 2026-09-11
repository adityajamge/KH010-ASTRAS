from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "jalsetu-api"
    version: str = "0.1.0"
    environment: str = "development"
