from app.schemas.common import TimestampedRead


class VillageRead(TimestampedRead):
    name: str
