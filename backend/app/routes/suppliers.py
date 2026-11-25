from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..services.stock_service import current_stock_for_medicine

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


@router.get("", response_model=list[schemas.SupplierOut])
def list_suppliers(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
    search: str | None = None,
):
    query = db.query(models.Supplier)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(models.Supplier.name.ilike(like) | models.Supplier.email.ilike(like))
    return query.order_by(models.Supplier.name).all()


@router.get("/{supplier_id}", response_model=schemas.SupplierOut)
def get_supplier(supplier_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    supplier = db.get(models.Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


@router.get("/{supplier_id}/details", response_model=dict)
def supplier_details(supplier_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    supplier = db.get(models.Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    medicines = (
        db.query(models.Medicine)
        .filter(models.Medicine.supplier_id == supplier_id, models.Medicine.is_active.is_(True))
        .all()
    )
    medicine_list = [
        {
            "id": m.id,
            "name": m.name,
            "code": m.medicine_code,
            "category": m.category,
            "current_stock": current_stock_for_medicine(db, m.id),
        }
        for m in medicines
    ]

    orders = (
        db.query(models.StockTransaction)
        .filter(models.StockTransaction.transaction_type == "in")
        .join(models.Medicine, models.Medicine.supplier_id == supplier_id)
        .order_by(models.StockTransaction.transaction_date.desc())
        .limit(50)
        .all()
    )
    order_history = [
        {
            "id": t.id,
            "medicine_name": t.medicine.name if t.medicine else None,
            "batch_number": t.batch.batch_number if t.batch else None,
            "quantity": t.quantity,
            "transaction_date": t.transaction_date,
            "notes": t.notes,
        }
        for t in orders
    ]
    return {
        "supplier": schemas.SupplierOut.model_validate(supplier).model_dump(),
        "medicines": medicine_list,
        "orders": order_history,
        "medicine_count": len(medicine_list),
    }


@router.post("", response_model=schemas.SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: schemas.SupplierCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if db.query(models.Supplier).filter(models.Supplier.name == payload.name.strip()).first():
        raise HTTPException(status_code=400, detail="A supplier with this name already exists.")
    supplier = models.Supplier(
        name=payload.name.strip(),
        contact_person=payload.contact_person,
        phone=payload.phone,
        email=payload.email,
        address=payload.address,
        status=payload.status or "active",
    )
    db.add(supplier)
    db.flush()
    db.add(
        models.AuditLog(
            entity_type="supplier",
            entity_id=supplier.id,
            action="create",
            details=f"Created supplier {supplier.name}",
            user_id=user.id,
        )
    )
    db.commit()
    db.refresh(supplier)
    return supplier


@router.put("/{supplier_id}", response_model=schemas.SupplierOut)
def update_supplier(
    supplier_id: int,
    payload: schemas.SupplierUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    supplier = db.get(models.Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    if payload.name is not None:
        clash = (
            db.query(models.Supplier)
            .filter(models.Supplier.name == payload.name.strip(), models.Supplier.id != supplier_id)
            .first()
        )
        if clash:
            raise HTTPException(status_code=400, detail="A supplier with this name already exists.")
        supplier.name = payload.name.strip()
    for field in ["contact_person", "phone", "email", "address", "status"]:
        value = getattr(payload, field)
        if value is not None:
            setattr(supplier, field, value)
    db.add(
        models.AuditLog(
            entity_type="supplier",
            entity_id=supplier.id,
            action="update",
            details=f"Updated supplier {supplier.name}",
            user_id=user.id,
        )
    )
    db.commit()
    db.refresh(supplier)
    return supplier


@router.delete("/{supplier_id}", status_code=200)
def delete_supplier(
    supplier_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)
):
    supplier = db.get(models.Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    related = (
        db.query(models.Medicine).filter(models.Medicine.supplier_id == supplier_id).count()
        + db.query(models.Batch).filter(models.Batch.supplier_id == supplier_id).count()
    )
    if related > 0:
        supplier.status = "inactive"
        db.commit()
        return {"message": "Supplier has linked medicines; marked inactive instead of deleted."}
    db.add(
        models.AuditLog(
            entity_type="supplier",
            entity_id=supplier.id,
            action="delete",
            details=f"Deleted supplier {supplier.name}",
            user_id=user.id,
        )
    )
    db.delete(supplier)
    db.commit()
    return {"message": "Supplier deleted successfully."}
