from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..services.alert_service import refresh_medicine_alerts
from ..services.expiry_service import batch_out_list, fefo_recommendation
from ..services.stock_service import (
    add_stock_in,
    adjust_stock,
    current_stock_for_medicine,
    history,
    issue_stock,
)
from ..utils.helpers import stock_status

router = APIRouter(prefix="/api/stock", tags=["stock"])


@router.post("/in", response_model=schemas.TransactionDetail, status_code=status.HTTP_201_CREATED)
def stock_in(
    medicine_id: int,
    payload: schemas.StockIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    try:
        txn = add_stock_in(
            db,
            medicine_id,
            payload.quantity,
            payload.batch_number,
            payload.manufacturing_date,
            payload.expiry_date,
            payload.purchase_price,
            payload.supplier_id,
            payload.notes,
            user.id,
            reference_number=f"IN-{txn_id_hint(db)}",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    db.commit()
    db.refresh(txn)
    refresh_medicine_alerts(db, db.get(models.Medicine, medicine_id))
    medicine = txn.medicine
    return schemas.TransactionDetail(
        **schemas.TransactionOut.model_validate(txn).model_dump(),
        medicine_name=medicine.name if medicine else None,
        batch_number=txn.batch.batch_number if txn.batch else None,
    )


def txn_id_hint(db: Session) -> str:
    return "SYS"


@router.post("/out", response_model=list[schemas.TransactionDetail], status_code=status.HTTP_201_CREATED)
def stock_out(
    medicine_id: int,
    payload: schemas.StockOut,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    try:
        txns = issue_stock(
            db,
            medicine_id,
            payload.quantity,
            payload.reference_number,
            payload.recipient,
            payload.notes,
            user.id,
            payload.batch_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    db.commit()
    refresh_medicine_alerts(db, db.get(models.Medicine, medicine_id))
    result = []
    for t in txns:
        db.refresh(t)
        result.append(
            schemas.TransactionDetail(
                **schemas.TransactionOut.model_validate(t).model_dump(),
                medicine_name=t.medicine.name if t.medicine else None,
                batch_number=t.batch.batch_number if t.batch else None,
            )
        )
    return result


@router.post("/adjust", response_model=schemas.TransactionDetail)
def stock_adjust(
    medicine_id: int,
    payload: schemas.StockAdjust,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    try:
        txn = adjust_stock(
            db,
            medicine_id,
            payload.quantity,
            payload.adjustment_type,
            payload.reason,
            user.id,
            payload.batch_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    db.commit()
    db.refresh(txn)
    refresh_medicine_alerts(db, db.get(models.Medicine, medicine_id))
    return schemas.TransactionDetail(
        **schemas.TransactionOut.model_validate(txn).model_dump(),
        medicine_name=txn.medicine.name if txn.medicine else None,
        batch_number=txn.batch.batch_number if txn.batch else None,
    )


@router.get("/history", response_model=dict)
def stock_history(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
    medicine_id: int | None = None,
    transaction_type: str | None = None,
    start: date | None = None,
    end: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
):
    rows, total = history(
        db,
        medicine_id=medicine_id,
        txn_type=transaction_type,
        start=start,
        end=end,
        limit=page_size,
        offset=(page - 1) * page_size,
    )
    return {"items": rows, "total": total, "page": page, "page_size": page_size}


@router.get("/batches/out", response_model=list[dict])
def out_batches(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return batch_out_list(db)


@router.get("/fefo/{medicine_id}", response_model=list[dict])
def fefo(medicine_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    if not db.get(models.Medicine, medicine_id):
        raise HTTPException(status_code=404, detail="Medicine not found")
    return fefo_recommendation(db, medicine_id)


@router.get("/overview/{medicine_id}", response_model=dict)
def stock_overview(
    medicine_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)
):
    m = db.get(models.Medicine, medicine_id)
    if not m:
        raise HTTPException(status_code=404, detail="Medicine not found")
    current = current_stock_for_medicine(db, m.id)
    return {
        "medicine_id": m.id,
        "name": m.name,
        "current_stock": current,
        "minimum_stock": m.minimum_stock,
        "maximum_stock": m.maximum_stock,
        "status": stock_status(current, m.minimum_stock, m.maximum_stock),
        "batches": [
            {
                "batch_id": b.id,
                "batch_number": b.batch_number,
                "quantity": b.quantity,
                "expiry_date": b.expiry_date,
                "days_remaining": (b.expiry_date - date.today()).days if b.expiry_date else None,
            }
            for b in sorted(m.batches, key=lambda x: (x.expiry_date is None, x.expiry_date or date.max))
        ],
    }
