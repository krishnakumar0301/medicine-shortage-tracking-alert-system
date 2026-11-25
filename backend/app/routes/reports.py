import csv
import io
from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import get_current_user
from ..services.expiry_service import classify_expiry, expiry_status_for_medicine
from ..services.prediction_service import build_prediction
from ..services.stock_service import current_stock_for_medicine, history, stock_status_for

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _csv_response(rows: list[dict], filename: str) -> StreamingResponse:
    buffer = io.StringIO()
    if rows:
        writer = csv.DictWriter(buffer, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    else:
        buffer.write("No data\n")
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def _date_range(start: date | None, end: date | None):
    return start, end


@router.get("/inventory", response_model=dict)
def inventory_report(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
    category: str | None = None,
    medicine_id: int | None = None,
):
    medicines = db.query(models.Medicine).filter(models.Medicine.is_active.is_(True))
    if category:
        medicines = medicines.filter(models.Medicine.category == category)
    if medicine_id:
        medicines = medicines.filter(models.Medicine.id == medicine_id)

    rows = []
    for m in medicines.all():
        stock = current_stock_for_medicine(db, m.id)
        exp_status, days, earliest = expiry_status_for_medicine(db, m)
        rows.append(
            {
                "code": m.medicine_code,
                "name": m.name,
                "generic": m.generic_name or "",
                "category": m.category,
                "current_stock": stock,
                "unit": m.unit,
                "minimum": m.minimum_stock,
                "maximum": m.maximum_stock,
                "status": stock_status_for(db, m),
                "expiry_status": exp_status,
                "days_to_expiry": days if days is not None else "",
                "earliest_expiry": earliest or "",
                "location": m.storage_location or "",
                "price": m.selling_price if m.selling_price is not None else "",
            }
        )
    return {"rows": rows, "total": len(rows)}


@router.get("/shortage")
def shortage_report(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
    category: str | None = None,
):
    medicines = db.query(models.Medicine).filter(models.Medicine.is_active.is_(True))
    if category:
        medicines = medicines.filter(models.Medicine.category == category)
    rows = []
    for m in medicines.all():
        stock = current_stock_for_medicine(db, m.id)
        status = stock_status_for(db, m)
        if status in ("out", "critical", "low"):
            rows.append(
                {
                    "code": m.medicine_code,
                    "name": m.name,
                    "current_stock": stock,
                    "minimum": m.minimum_stock,
                    "maximum": m.maximum_stock,
                    "status": status,
                    "deficit": max(m.minimum_stock - stock, 0),
                }
            )
    return _csv_response(rows, "shortage_report.csv")


@router.get("/expiry")
def expiry_report(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
    status_filter: str | None = Query(None, alias="status"),
):
    medicines = db.query(models.Medicine).filter(models.Medicine.is_active.is_(True)).all()
    rows = []
    for m in medicines:
        for b in m.batches:
            if b.quantity <= 0:
                continue
            exp_status, days = classify_expiry(b.expiry_date)
            if status_filter and exp_status != status_filter:
                continue
            rows.append(
                {
                    "code": m.medicine_code,
                    "name": m.name,
                    "batch": b.batch_number,
                    "quantity": b.quantity,
                    "unit": m.unit,
                    "expiry_date": b.expiry_date or "",
                    "days_remaining": days if days is not None else "",
                    "status": exp_status,
                }
            )
    return _csv_response(rows, "expiry_report.csv")


@router.get("/stock-in")
def stock_in_report(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
    start: date | None = None,
    end: date | None = None,
):
    rows, total = history(db, txn_type="in", start=start, end=end, limit=10000)
    data = [
        {
            "date": r["transaction_date"].date() if r["transaction_date"] else "",
            "medicine": r["medicine_name"],
            "batch": r["batch_number"],
            "quantity": r["quantity"],
            "previous": r["previous_stock"],
            "new": r["new_stock"],
            "reference": r["reference_number"],
        }
        for r in rows
    ]
    return _csv_response(data, "stock_in_report.csv")


@router.get("/stock-out")
def stock_out_report(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
    start: date | None = None,
    end: date | None = None,
):
    rows, total = history(db, txn_type="out", start=start, end=end, limit=10000)
    data = [
        {
            "date": r["transaction_date"].date() if r["transaction_date"] else "",
            "medicine": r["medicine_name"],
            "batch": r["batch_number"],
            "quantity": r["quantity"],
            "previous": r["previous_stock"],
            "new": r["new_stock"],
            "recipient": r["recipient"],
            "reference": r["reference_number"],
        }
        for r in rows
    ]
    return _csv_response(data, "stock_out_report.csv")


@router.get("/demand")
def demand_report(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    medicines = db.query(models.Medicine).filter(models.Medicine.is_active.is_(True)).all()
    rows = []
    for m in medicines:
        pred = build_prediction(db, m)
        rows.append(
            {
                "code": m.medicine_code,
                "name": m.name,
                "current_stock": pred["current_stock"],
                "avg_daily_usage": pred["avg_daily_usage"],
                "avg_monthly_usage": pred["avg_monthly_usage"],
                "predicted_next_month": pred["predicted_next_month"],
                "safety_stock": pred["safety_stock"],
                "reorder_point": pred["reorder_point"],
                "recommended_reorder": pred["recommended_reorder_qty"],
                "note": "Estimate only",
            }
        )
    return _csv_response(rows, "demand_report.csv")


@router.get("/suppliers")
def supplier_report(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    suppliers = db.query(models.Supplier).all()
    rows = []
    for s in suppliers:
        rows.append(
            {
                "id": s.id,
                "name": s.name,
                "contact_person": s.contact_person,
                "phone": s.phone,
                "email": s.email,
                "address": s.address,
                "status": s.status,
                "medicines_supplied": db.query(models.Medicine)
                .filter(models.Medicine.supplier_id == s.id)
                .count(),
            }
        )
    return _csv_response(rows, "supplier_report.csv")


@router.get("/restock")
def restock_report(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    medicines = db.query(models.Medicine).filter(models.Medicine.is_active.is_(True)).all()
    rows = []
    for m in medicines:
        pred = build_prediction(db, m)
        if pred["recommended_reorder_qty"] > 0:
            rows.append(
                {
                    "code": m.medicine_code,
                    "name": m.name,
                    "current_stock": pred["current_stock"],
                    "minimum": m.minimum_stock,
                    "recommended_reorder": pred["recommended_reorder_qty"],
                    "priority": "High",
                }
            )
    return _csv_response(rows, "restock_report.csv")
