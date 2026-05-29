from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, field_validator

from ..db import get_db

USER_ID = "default"

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdateBody(BaseModel):
    starting_capital: float

    @field_validator("starting_capital")
    @classmethod
    def must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("starting_capital must be > 0")
        return v


@router.get("")
def get_settings():
    with get_db() as conn:
        row = conn.execute(
            "SELECT starting_capital FROM app_settings WHERE id=?", (USER_ID,)
        ).fetchone()
    if row is None:
        return {"starting_capital": 10000.0}
    return {"starting_capital": row["starting_capital"]}


@router.put("")
def update_settings(body: SettingsUpdateBody):
    with get_db() as conn:
        conn.execute(
            "UPDATE app_settings SET starting_capital=? WHERE id=?",
            (body.starting_capital, USER_ID),
        )
    return {"starting_capital": body.starting_capital}
