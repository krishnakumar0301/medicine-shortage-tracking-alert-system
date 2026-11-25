from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import get_current_user
from ..services.alert_service import expiry_warning_days
from ..services.stock_service import current_stock_for_medicine

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=dict)
def get_settings(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    row = db.get(models.Setting, "expiry_warning_days")
    return {
        "expiry_warning_days": int(row.value) if row and row.value.isdigit() else expiry_warning_days(db),
    }


@router.put("", response_model=dict)
def update_settings(
    payload: dict, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)
):
    warning = int(payload.get("expiry_warning_days") or expiry_warning_days(db))
    if warning < 1:
        warning = 1
    row = db.get(models.Setting, "expiry_warning_days")
    if row:
        row.value = str(warning)
    else:
        db.add(models.Setting(key="expiry_warning_days", value=str(warning)))
    db.commit()
    return {"expiry_warning_days": warning}


@router.get("/health", response_model=dict)
def health_check(db: Session = Depends(get_db)):
    db.execute(models.Setting.__table__.select().limit(1))
    return {"status": "ok", "database": "connected"}


@router.get("/meta", response_model=dict)
def meta(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    medicines = db.query(models.Medicine).filter(models.Medicine.is_active.is_(True)).all()
    categories = sorted({m.category for m in medicines if m.category})
    suppliers = db.query(models.Supplier).filter(models.Supplier.status == "active").all()
    return {
        "categories": categories,
        "suppliers": [
            {"id": s.id, "name": s.name} for s in suppliers
        ],
        "dosage_forms": ["Tablets", "Capsules", "Syrup", "Injection", "Ointment", "Drops", "Powder", "Inhaler", "Solution", "Suspension"],
        "units": ["tablets", "capsules", "ml", "mg", "vials", "bottles", "sachets", "units", "ampoules"],
    }
