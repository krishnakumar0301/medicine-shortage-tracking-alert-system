import hashlib
import re
from datetime import date, datetime, time, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Batch, Medicine, StockTransaction


def today() -> date:
    return date.today()


def medicine_current_stock(db: Session, medicine_id: int) -> int:
    total = (
        db.query(func.coalesce(func.sum(Batch.quantity), 0))
        .filter(Batch.medicine_id == medicine_id)
        .scalar()
    )
    return int(total or 0)


def medicine_current_stock_map(db: Session) -> dict[int, int]:
    rows = db.query(Batch.medicine_id, func.coalesce(func.sum(Batch.quantity), 0)).group_by(
        Batch.medicine_id
    ).all()
    return {mid: int(qty or 0) for mid, qty in rows}


def stock_status(current: int, minimum: int, maximum: int) -> str:
    if current <= 0:
        return "out"
    if current <= minimum:
        return "critical"
    if current <= maximum * 0.4 and maximum > 0:
        return "low"
    if current <= maximum:
        return "healthy"
    return "over"


def days_remaining(expiry_date: date | None, reference: date | None = None) -> int | None:
    if expiry_date is None:
        return None
    ref = reference or today()
    return (expiry_date - ref).days


def status_for_expiry(expiry_date: date | None, warning_days: int = 30, reference: date | None = None) -> str:
    days = days_remaining(expiry_date, reference)
    if days is None:
        return "unknown"
    if days < 0:
        return "expired"
    if days <= warning_days:
        return "expiring_soon"
    return "safe"


def fefo_order_batches(batches: list[Batch]) -> list[Batch]:
    """Sort batches so the earliest expiry is consumed first."""
    return sorted(
        batches,
        key=lambda b: (b.expiry_date is None, b.expiry_date or date.max, b.id),
    )


def allocate_stock(
    db: Session, medicine: Medicine, quantity: int, reference: str | None = None,
    recipient: str | None = None, notes: str | None = None, user_id: int | None = None,
) -> list[StockTransaction]:
    """Issue stock from batches using FEFO. Raises ValueError if insufficient."""
    if quantity <= 0:
        raise ValueError("Quantity must be greater than zero.")
    if quantity > medicine_current_stock(db, medicine.id):
        raise ValueError("Insufficient stock available.")

    available = [b for b in medicine.batches if b.quantity > 0 and not _is_expired(b)]
    ordered = fefo_order_batches(available)

    remaining = quantity
    transactions: list[StockTransaction] = []
    previous_total = medicine_current_stock(db, medicine.id)

    for batch in ordered:
        if remaining <= 0:
            break
        take = min(batch.quantity, remaining)
        batch.quantity -= take
        remaining -= take
        db.flush()
        txn = StockTransaction(
            medicine_id=medicine.id,
            batch_id=batch.id,
            transaction_type="out",
            quantity=take,
            previous_stock=previous_total,
            new_stock=previous_total - take,
            reference_number=reference,
            recipient=recipient,
            notes=notes,
            user_id=user_id,
        )
        db.add(txn)
        transactions.append(txn)
        previous_total = txn.new_stock

    if remaining > 0:
        raise ValueError("Insufficient stock available.")

    db.flush()
    return transactions


def _is_expired(batch: Batch) -> bool:
    return batch.expiry_date is not None and batch.expiry_date < today()


def date_to_datetime_range(start: date | None, end: date | None):
    start_dt = datetime.combine(start, time.min) if start else None
    end_dt = datetime.combine(end, time.max) if end else None
    return start_dt, end_dt


def generate_medicine_code(name: str, last_number: int = 0) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]", "", name or "").upper()[:6] or "MED"
    return f"{slug}-{last_number + 1:04d}"


def parse_date(value: str | date | None) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()


def mask_hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:16]
