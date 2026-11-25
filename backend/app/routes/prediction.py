from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..services.prediction_service import build_prediction

router = APIRouter(prefix="/api/predictions", tags=["predictions"])


@router.get("", response_model=list[schemas.PredictionOut])
def all_predictions(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    medicines = db.query(models.Medicine).filter(models.Medicine.is_active.is_(True)).all()
    result = [build_prediction(db, m) for m in medicines]
    result.sort(key=lambda r: r["recommended_reorder_qty"], reverse=True)
    return result


@router.get("/{medicine_id}", response_model=schemas.PredictionOut)
def prediction_for_medicine(
    medicine_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)
):
    m = db.get(models.Medicine, medicine_id)
    if not m:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return build_prediction(db, m)
