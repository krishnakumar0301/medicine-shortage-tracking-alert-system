from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import get_current_user
from ..services.expiry_service import classify_expiry
from ..services.stock_service import current_stock_for_medicine

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("", response_model=dict)
def global_search(
    q: str = Query("", min_length=1),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
    limit: int = Query(15, ge=1, le=50),
):
    term = q.strip()
    if not term:
        return {"medicines": [], "suppliers": [], "batches": [], "transactions": [], "total": 0}

    like = f"%{term}%"

    medicines = (
        db.query(models.Medicine)
        .filter(
            models.Medicine.is_active.is_(True),
            or_(
                models.Medicine.name.ilike(like),
                models.Medicine.generic_name.ilike(like),
                models.Medicine.medicine_code.ilike(like),
                models.Medicine.brand_name.ilike(like),
            ),
        )
        .order_by(models.Medicine.name)
        .limit(limit)
        .all()
    )
    medicine_results = [
        {
            "id": m.id,
            "name": m.name,
            "code": m.medicine_code,
            "generic_name": m.generic_name,
            "category": m.category,
            "current_stock": current_stock_for_medicine(db, m.id),
            "type": "medicine",
        }
        for m in medicines
    ]

    suppliers = (
        db.query(models.Supplier)
        .filter(
            or_(
                models.Supplier.name.ilike(like),
                models.Supplier.email.ilike(like),
                models.Supplier.contact_person.ilike(like),
            )
        )
        .order_by(models.Supplier.name)
        .limit(limit)
        .all()
    )
    supplier_results = [
        {
            "id": s.id,
            "name": s.name,
            "email": s.email,
            "contact_person": s.contact_person,
            "type": "supplier",
        }
        for s in suppliers
    ]

    batches = (
        db.query(models.Batch)
        .filter(models.Batch.batch_number.ilike(like))
        .limit(limit)
        .all()
    )
    batch_results = [
        {
            "id": b.id,
            "batch_number": b.batch_number,
            "medicine_id": b.medicine_id,
            "medicine_name": b.medicine.name if b.medicine else None,
            "quantity": b.quantity,
            "expiry_date": b.expiry_date,
            "expiry_status": classify_expiry(b.expiry_date)[0],
            "type": "batch",
        }
        for b in batches
    ]

    transactions = (
        db.query(models.StockTransaction)
        .filter(
            or_(
                models.StockTransaction.reference_number.ilike(like),
                models.StockTransaction.recipient.ilike(like),
            )
        )
        .order_by(models.StockTransaction.transaction_date.desc())
        .limit(limit)
        .all()
    )
    transaction_results = [
        {
            "id": t.id,
            "reference": t.reference_number,
            "type": t.transaction_type,
            "medicine_id": t.medicine_id,
            "medicine_name": t.medicine.name if t.medicine else None,
            "quantity": t.quantity,
            "date": t.transaction_date,
            "recipient": t.recipient,
            "type2": "transaction",
        }
        for t in transactions
    ]

    results = medicine_results + supplier_results + batch_results + transaction_results
    return {"medicines": medicine_results, "suppliers": supplier_results, "batches": batch_results,
            "transactions": transaction_results, "total": len(results)}
