from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..services.alert_service import expiry_warning_days
from ..services.expiry_service import (
    batch_out_list,
    classify_expiry,
    expiry_distribution,
    expiry_status_for_medicine,
    fefo_recommendation,
)
from ..services.stock_service import current_stock_for_medicine

router = APIRouter(prefix="/api/expiry", tags=["expiry"])


@router.get("", response_model=dict)
def expiry_monitor(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
    status: str | None = Query(None, description="expired | expiring_soon | safe"),
    medicine_id: int | None = Query(None),
    days: int | None = Query(None, ge=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
):
    warning = days or expiry_warning_days(db)
    medicines = db.query(models.Medicine).filter(models.Medicine.is_active.is_(True))
    if medicine_id:
        medicines = medicines.filter(models.Medicine.id == medicine_id)
    medicines = medicines.all()

    rows = []
    for m in medicines:
        exp_status, exp_days, earliest = expiry_status_for_medicine(db, m, warning)
        for b in m.batches:
            if b.quantity <= 0:
                continue
            b_status, b_days = classify_expiry(b.expiry_date, warning)
            rows.append(
                {
                    "medicine_id": m.id,
                    "medicine_name": m.name,
                    "medicine_code": m.medicine_code,
                    "batch_id": b.id,
                    "batch_number": b.batch_number,
                    "quantity": b.quantity,
                    "unit": m.unit,
                    "expiry_date": b.expiry_date,
                    "days_remaining": b_days,
                    "status": b_status,
                    "total_stock": current_stock_for_medicine(db, m.id),
                }
            )

    if status:
        rows = [r for r in rows if r["status"] == status]

    rows.sort(key=lambda r: (r["status"] != "expired", r["status"] != "expiring_soon", r["days_remaining"] is None, r["days_remaining"] or 10**9))

    total = len(rows)
    start = (page - 1) * page_size
    return {
        "items": rows[start : start + page_size],
        "total": total,
        "page": page,
        "page_size": page_size,
        "stats": {
            "expired": sum(1 for r in rows if r["status"] == "expired"),
            "expiring_soon": sum(1 for r in rows if r["status"] == "expiring_soon"),
            "safe": sum(1 for r in rows if r["status"] == "safe"),
        },
        "distribution": expiry_distribution(db),
        "warning_days": warning,
    }


@router.get("/fefo/{medicine_id}", response_model=list[dict])
def fefo(medicine_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return fefo_recommendation(db, medicine_id)


@router.get("/batches/out", response_model=list[dict])
def usable_batches(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return batch_out_list(db)


@router.get("/settings", response_model=dict)
def expiry_settings(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return {"warning_days": expiry_warning_days(db), "default": settings.EXPIRY_WARNING_DAYS}


@router.put("/settings", response_model=dict)
def update_expiry_settings(
    payload: dict, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)
):
    from ..models import Setting

    days = int(payload.get("warning_days") or settings.EXPIRY_WARNING_DAYS)
    if days < 1:
        days = 1
    row = db.get(Setting, "expiry_warning_days")
    if row:
        row.value = str(days)
    else:
        db.add(Setting(key="expiry_warning_days", value=str(days)))
    db.commit()
    return {"warning_days": days}
