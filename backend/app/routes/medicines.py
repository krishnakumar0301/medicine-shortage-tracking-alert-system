from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..services.alert_service import expiry_warning_days, refresh_medicine_alerts
from ..services.expiry_service import expiry_status_for_medicine, last_transaction_time
from ..services.prediction_service import average_daily_usage
from ..services.stock_service import add_stock_in, current_stock_for_medicine, stock_status_for, history
from ..utils.helpers import generate_medicine_code, stock_status

router = APIRouter(prefix="/api/medicines", tags=["medicines"])


def _list_item(db: Session, m: models.Medicine, warning_days: int) -> schemas.MedicineListItem:
    current = current_stock_for_medicine(db, m.id)
    status_str = stock_status(current, m.minimum_stock, m.maximum_stock)
    exp_status, days, earliest = expiry_status_for_medicine(db, m, warning_days)
    active_alerts = (
        db.query(models.Alert)
        .filter(models.Alert.medicine_id == m.id, models.Alert.status == "active")
        .count()
    )
    return schemas.MedicineListItem(
        **schemas.MedicineOut.model_validate(m).model_dump(),
        current_stock=current,
        stock_status=status_str,
        expiry_status=exp_status,
        days_to_expiry=days,
        earliest_expiry=earliest,
        alert_count=active_alerts,
        avg_monthly_usage=round(average_daily_usage(db, m.id) * 30, 1),
        last_restocked=last_transaction_time(db, m.id, "in"),
        last_issued=last_transaction_time(db, m.id, "out"),
    )


@router.get("", response_model=dict)
def list_medicines(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
    search: str | None = None,
    category: str | None = None,
    stock_status_filter: str | None = Query(None, alias="stock_status"),
    expiry_filter: str | None = Query(None, alias="expiry"),
    sort_by: str = "name",
    sort_dir: str = "asc",
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    warning = expiry_warning_days(db)
    query = db.query(models.Medicine).filter(models.Medicine.is_active.is_(True))

    if search:
        like = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.Medicine.name.ilike(like),
                models.Medicine.generic_name.ilike(like),
                models.Medicine.medicine_code.ilike(like),
                models.Medicine.brand_name.ilike(like),
            )
        )
    if category:
        query = query.filter(models.Medicine.category == category)

    medicines = query.all()
    items = [_list_item(db, m, warning) for m in medicines]

    if stock_status_filter:
        items = [it for it in items if it.stock_status == stock_status_filter]

    if expiry_filter:
        items = [it for it in items if it.expiry_status == expiry_filter]

    if sort_by == "stock":
        order = {"out": 0, "critical": 1, "low": 2, "healthy": 3, "over": 4}
        items.sort(key=lambda it: (order.get(it.stock_status, 9), it.name), reverse=(sort_dir == "desc"))
    elif sort_by == "expiry":
        items.sort(
            key=lambda it: (it.earliest_expiry is None, it.earliest_expiry or date.max),
            reverse=(sort_dir == "desc"),
        )
    elif sort_by == "category":
        items.sort(key=lambda it: (it.category, it.name), reverse=(sort_dir == "desc"))
    elif sort_by == "code":
        items.sort(key=lambda it: it.medicine_code, reverse=(sort_dir == "desc"))
    elif sort_by == "stock_level":
        items.sort(key=lambda it: it.current_stock, reverse=(sort_dir == "desc"))
    else:
        items.sort(key=lambda it: it.name, reverse=(sort_dir == "desc"))

    total_filtered = len(items)
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]

    return {
        "items": [it.model_dump(mode="json") for it in page_items],
        "total": total_filtered,
        "page": page,
        "page_size": page_size,
        "categories": [
            c[0]
            for c in db.query(models.Medicine.category)
            .distinct()
            .order_by(models.Medicine.category)
            .all()
        ],
    }


@router.get("/options", response_model=list[dict])
def medicine_options(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    medicines = (
        db.query(models.Medicine)
        .filter(models.Medicine.is_active.is_(True))
        .order_by(models.Medicine.name)
        .all()
    )
    return [
        {
            "id": m.id,
            "name": m.name,
            "code": m.medicine_code,
            "current_stock": current_stock_for_medicine(db, m.id),
            "unit": m.unit,
            "stock_status": stock_status_for(db, m),
        }
        for m in medicines
    ]


@router.get("/{medicine_id}", response_model=schemas.MedicineDetailOut)
def get_medicine(
    medicine_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)
):
    m = db.get(models.Medicine, medicine_id)
    if not m or not m.is_active:
        raise HTTPException(status_code=404, detail="Medicine not found")
    current = current_stock_for_medicine(db, m.id)
    batches = sorted(
        m.batches,
        key=lambda b: (b.expiry_date is None, b.expiry_date or date.max, b.id),
    )
    detail = schemas.MedicineDetailOut(
        **schemas.MedicineOut.model_validate(m).model_dump(),
        current_stock=current,
        stock_status=stock_status(current, m.minimum_stock, m.maximum_stock),
        batches=[schemas.BatchOut.model_validate(b).model_dump() for b in batches],
        supplier=schemas.SupplierOut.model_validate(m.supplier).model_dump()
        if m.supplier
        else None,
    )
    return detail


@router.post("", response_model=schemas.MedicineDetailOut, status_code=status.HTTP_201_CREATED)
def create_medicine(
    payload: schemas.MedicineCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if db.query(models.Medicine).filter(models.Medicine.name == payload.name.strip()).first():
        raise HTTPException(status_code=400, detail="A medicine with this name already exists.")

    last_med = db.query(models.Medicine).order_by(models.Medicine.id.desc()).first()
    medicine = models.Medicine(
        medicine_code=generate_medicine_code(payload.name, last_med.id if last_med else 0),
        name=payload.name.strip(),
        generic_name=payload.generic_name,
        brand_name=payload.brand_name,
        category=payload.category or "General",
        dosage_form=payload.dosage_form,
        strength=payload.strength,
        unit=payload.unit or "tablets",
        minimum_stock=payload.minimum_stock or 0,
        maximum_stock=payload.maximum_stock or 0,
        storage_location=payload.storage_location,
        selling_price=payload.selling_price,
        description=payload.description,
        supplier_id=payload.supplier_id,
    )
    db.add(medicine)
    db.flush()

    if payload.batch and payload.batch.quantity and payload.batch.quantity > 0:
        add_stock_in(
            db,
            medicine.id,
            payload.batch.quantity,
            payload.batch.batch_number,
            payload.batch.manufacturing_date,
            payload.batch.expiry_date,
            payload.batch.purchase_price,
            payload.batch.supplier_id or payload.supplier_id,
            notes="Initial stock on medicine creation",
            user_id=user.id,
        )

    db.add(
        models.AuditLog(
            entity_type="medicine",
            entity_id=medicine.id,
            action="create",
            details=f"Created medicine {medicine.name}",
            user_id=user.id,
        )
    )
    db.commit()
    db.refresh(medicine)
    refresh_medicine_alerts(db, medicine)
    return get_medicine(medicine.id, db, user)


@router.put("/{medicine_id}", response_model=schemas.MedicineDetailOut)
def update_medicine(
    medicine_id: int,
    payload: schemas.MedicineUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    m = db.get(models.Medicine, medicine_id)
    if not m:
        raise HTTPException(status_code=404, detail="Medicine not found")

    if payload.name is not None:
        clash = (
            db.query(models.Medicine)
            .filter(models.Medicine.name == payload.name.strip(), models.Medicine.id != medicine_id)
            .first()
        )
        if clash:
            raise HTTPException(status_code=400, detail="A medicine with this name already exists.")
        m.name = payload.name.strip()

    for field in [
        "generic_name",
        "brand_name",
        "category",
        "dosage_form",
        "strength",
        "unit",
        "storage_location",
        "description",
    ]:
        value = getattr(payload, field)
        if value is not None:
            setattr(m, field, value)
    for field in ["minimum_stock", "maximum_stock"]:
        value = getattr(payload, field)
        if value is not None:
            setattr(m, field, value)
    if payload.selling_price is not None:
        m.selling_price = payload.selling_price
    if payload.supplier_id is not None:
        m.supplier_id = payload.supplier_id

    db.add(
        models.AuditLog(
            entity_type="medicine",
            entity_id=m.id,
            action="update",
            details=f"Updated medicine {m.name}",
            user_id=user.id,
        )
    )
    db.commit()
    refresh_medicine_alerts(db, m)
    return get_medicine(m.id, db, user)


@router.delete("/{medicine_id}", status_code=200)
def delete_medicine(
    medicine_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)
):
    m = db.get(models.Medicine, medicine_id)
    if not m:
        raise HTTPException(status_code=404, detail="Medicine not found")

    has_history = (
        db.query(models.StockTransaction)
        .filter(models.StockTransaction.medicine_id == medicine_id)
        .count()
        > 0
    )
    if has_history:
        m.is_active = False
        db.add(
            models.AuditLog(
                entity_type="medicine",
                entity_id=m.id,
                action="deactivate",
                details=f"Deactivated medicine {m.name} (history preserved)",
                user_id=user.id,
            )
        )
        db.commit()
        return {"message": "Medicine deactivated. Transaction history preserved."}

    db.add(
        models.AuditLog(
            entity_type="medicine",
            entity_id=m.id,
            action="delete",
            details=f"Deleted medicine {m.name}",
            user_id=user.id,
        )
    )
    db.delete(m)
    db.commit()
    return {"message": "Medicine deleted successfully."}


@router.post("/{medicine_id}/batches", response_model=schemas.TransactionOut, status_code=status.HTTP_201_CREATED)
def create_batch(
    medicine_id: int,
    payload: schemas.BatchIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    txn = add_stock_in(
        db,
        medicine_id,
        payload.quantity,
        payload.batch_number,
        payload.manufacturing_date,
        payload.expiry_date,
        payload.purchase_price,
        payload.supplier_id,
        notes="Batch added manually",
        user_id=user.id,
    )
    db.commit()
    refresh_medicine_alerts(db, db.get(models.Medicine, medicine_id))
    return txn


@router.get("/{medicine_id}/history", response_model=dict)
def medicine_history(
    medicine_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
    limit: int = Query(200, ge=1, le=500),
):
    rows, total = history(db, medicine_id=medicine_id, limit=limit)
    return {"items": rows, "total": total}
