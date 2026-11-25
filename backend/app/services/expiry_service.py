from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Batch, Medicine, StockTransaction
from ..utils.helpers import days_remaining, medicine_current_stock, stock_status, today


def classify_expiry(expiry_date: date | None, warning_days: int = 30, reference: date | None = None) -> tuple[str, int | None]:
    days = days_remaining(expiry_date, reference)
    if days is None:
        return "unknown", None
    if days < 0:
        return "expired", abs(days)
    if days <= warning_days:
        return "expiring_soon", days
    return "safe", days


def expiry_status_for_medicine(db: Session, medicine: Medicine, warning_days: int = 30) -> tuple[str, int | None, date | None]:
    """Returns (status, min_days_remaining, earliest_expiry) across active batches."""
    active_batches = [b for b in medicine.batches if b.quantity > 0]
    if not active_batches:
        return "no_stock", None, None
    earliest: date | None = None
    for b in active_batches:
        if b.expiry_date and (earliest is None or b.expiry_date < earliest):
            earliest = b.expiry_date
    if earliest is None:
        return "unknown", None, None
    status, days = classify_expiry(earliest, warning_days)
    return status, days, earliest


def expire_stats(db: Session, warning_days: int = 30) -> dict:
    stats = {"expired": 0, "expiring_soon": 0, "safe": 0, "no_stock": 0, "expired_units": 0}
    medicines = db.query(Medicine).filter(Medicine.is_active.is_(True)).all()
    for m in medicines:
        status, days, earliest = expiry_status_for_medicine(db, m, warning_days)
        key = status if status != "unknown" else "no_stock"
        stats[key] = stats.get(key, 0) + 1
        if status == "expired":
            expired_units = 0
            for b in m.batches:
                if b.expiry_date and b.expiry_date < today():
                    expired_units += b.quantity
            stats["expired_units"] += expired_units
    return stats


def expiry_distribution(db: Session) -> list[dict]:
    buckets = {"expired": 0, "0-30": 0, "31-60": 0, "61-90": 0, "91-180": 0, "180+": 0}
    ref = today()
    medicines = db.query(Medicine).filter(Medicine.is_active.is_(True)).all()
    for m in medicines:
        status, days, _ = expiry_status_for_medicine(db, m)
        if status == "no_stock":
            continue
        if status == "expired" or days is None:
            buckets["expired"] += 1
        elif days <= 30:
            buckets["0-30"] += 1
        elif days <= 60:
            buckets["31-60"] += 1
        elif days <= 90:
            buckets["61-90"] += 1
        elif days <= 180:
            buckets["91-180"] += 1
        else:
            buckets["180+"] += 1
    return [{"bucket": k, "count": v} for k, v in buckets.items()]


def is_expired(batch: Batch) -> bool:
    return batch.expiry_date is not None and batch.expiry_date < today()


def fefo_recommendation(db: Session, medicine_id: int) -> list[dict]:
    """Return usable batches sorted by expiry (FEFO)."""
    batches = (
        db.query(Batch)
        .filter(Batch.medicine_id == medicine_id, Batch.quantity > 0)
        .order_by(Batch.expiry_date.asc().nullslast())
        .all()
    )
    result = []
    for b in batches:
        if b.expiry_date and b.expiry_date < today():
            continue
        days = days_remaining(b.expiry_date)
        result.append(
            {
                "batch_id": b.id,
                "batch_number": b.batch_number,
                "quantity": b.quantity,
                "expiry_date": b.expiry_date,
                "days_remaining": days,
                "status": classify_expiry(b.expiry_date)[0],
                "use_first": b.id == batches[0].id and b.expiry_date is not None,
            }
        )
    return result


def batch_out_list(db: Session, medicine_id: int | None = None) -> list[dict]:
    query = db.query(Batch).join(Medicine).filter(Batch.quantity > 0)
    if medicine_id:
        query = query.filter(Batch.medicine_id == medicine_id)
    rows = query.order_by(Medicine.name, Batch.expiry_date.asc().nullslast()).all()
    out = []
    for b in rows:
        if is_expired(b):
            continue
        out.append(
            {
                "batch_id": b.id,
                "batch_number": b.batch_number,
                "medicine_id": b.medicine_id,
                "medicine_name": b.medicine.name,
                "medicine_code": b.medicine.medicine_code,
                "quantity": b.quantity,
                "expiry_date": b.expiry_date,
                "days_remaining": days_remaining(b.expiry_date),
                "unit": b.medicine.unit,
            }
        )
    return out


def last_transaction_time(db: Session, medicine_id: int, txn_type: str) -> object | None:
    return (
        db.query(func.max(StockTransaction.transaction_date))
        .filter(StockTransaction.medicine_id == medicine_id, StockTransaction.transaction_type == txn_type)
        .scalar()
    )
