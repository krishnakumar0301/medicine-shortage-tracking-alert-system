from datetime import date, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Batch, Medicine, StockTransaction
from ..utils.helpers import medicine_current_stock, stock_status, today


def current_stock_for_medicine(db: Session, medicine_id: int) -> int:
    return medicine_current_stock(db, medicine_id)


def stock_status_for(db: Session, medicine: Medicine) -> str:
    return stock_status(
        current_stock_for_medicine(db, medicine.id), medicine.minimum_stock, medicine.maximum_stock
    )


def add_stock_in(
    db: Session,
    medicine_id: int,
    quantity: int,
    batch_number: str,
    manufacturing_date: date | None = None,
    expiry_date: date | None = None,
    purchase_price: float | None = None,
    supplier_id: int | None = None,
    notes: str | None = None,
    user_id: int | None = None,
    reference_number: str | None = None,
) -> StockTransaction:
    medicine = db.get(Medicine, medicine_id)
    if not medicine:
        raise ValueError("Medicine not found.")
    if quantity <= 0:
        raise ValueError("Quantity must be greater than zero.")
    if expiry_date and manufacturing_date and expiry_date < manufacturing_date:
        raise ValueError("Expiry date must not be earlier than manufacturing date.")

    previous = medicine_current_stock(db, medicine_id)

    batch = (
        db.query(Batch)
        .filter(
            Batch.medicine_id == medicine_id,
            Batch.batch_number == batch_number,
        )
        .first()
    )
    if batch:
        batch.quantity += quantity
        if expiry_date:
            batch.expiry_date = expiry_date
        if manufacturing_date:
            batch.manufacturing_date = manufacturing_date
        if purchase_price is not None:
            batch.purchase_price = purchase_price
        if supplier_id is not None:
            batch.supplier_id = supplier_id
    else:
        batch = Batch(
            medicine_id=medicine_id,
            batch_number=batch_number,
            manufacturing_date=manufacturing_date,
            expiry_date=expiry_date,
            quantity=quantity,
            purchase_price=purchase_price,
            supplier_id=supplier_id,
        )
        db.add(batch)

    db.flush()
    txn = StockTransaction(
        medicine_id=medicine_id,
        batch_id=batch.id,
        transaction_type="in",
        quantity=quantity,
        previous_stock=previous,
        new_stock=previous + quantity,
        reference_number=reference_number,
        notes=notes,
        user_id=user_id,
    )
    db.add(txn)
    db.flush()
    return txn


def issue_stock(
    db: Session,
    medicine_id: int,
    quantity: int,
    reference_number: str | None = None,
    recipient: str | None = None,
    notes: str | None = None,
    user_id: int | None = None,
    specific_batch_id: int | None = None,
) -> list[StockTransaction]:
    medicine = db.get(Medicine, medicine_id)
    if not medicine:
        raise ValueError("Medicine not found.")
    if quantity <= 0:
        raise ValueError("Quantity must be greater than zero.")

    available = medicine_current_stock(db, medicine_id)
    if quantity > available:
        raise ValueError(f"Insufficient stock available. Only {available} units in stock.")

    candidates = [b for b in medicine.batches if b.quantity > 0 and not _is_expired(batch=b)]
    if specific_batch_id:
        candidates = [b for b in candidates if b.id == specific_batch_id]
        if not candidates:
            raise ValueError("Selected batch is not available for issue.")

    candidates.sort(key=lambda b: (b.expiry_date is None, b.expiry_date or date.max, b.id))

    remaining = quantity
    previous_total = available
    transactions: list[StockTransaction] = []

    for batch in candidates:
        if remaining <= 0:
            break
        take = min(batch.quantity, remaining)
        batch.quantity -= take
        remaining -= take
        db.flush()
        txn = StockTransaction(
            medicine_id=medicine_id,
            batch_id=batch.id,
            transaction_type="out",
            quantity=take,
            previous_stock=previous_total,
            new_stock=previous_total - take,
            reference_number=reference_number,
            recipient=recipient,
            notes=notes,
            user_id=user_id,
        )
        db.add(txn)
        previous_total = txn.new_stock
        transactions.append(txn)

    if remaining > 0:
        raise ValueError("Insufficient stock available.")

    db.flush()
    return transactions


def adjust_stock(
    db: Session,
    medicine_id: int,
    quantity: int,
    adjustment_type: str,
    reason: str | None = None,
    user_id: int | None = None,
    batch_id: int | None = None,
) -> StockTransaction:
    if adjustment_type not in ("in", "out"):
        raise ValueError("Adjustment type must be 'in' or 'out'.")
    if quantity <= 0:
        raise ValueError("Quantity must be greater than zero.")

    medicine = db.get(Medicine, medicine_id)
    if not medicine:
        raise ValueError("Medicine not found.")

    previous = current_stock_for_medicine(db, medicine_id)
    note = f"Adjustment ({adjustment_type}): {reason}" if reason else f"Adjustment ({adjustment_type})"

    if adjustment_type == "in":
        if batch_id:
            batch = db.get(Batch, batch_id)
            if not batch or batch.medicine_id != medicine_id:
                raise ValueError("Invalid batch for adjustment.")
        else:
            batch = Batch(
                medicine_id=medicine_id,
                batch_number=f"ADJ-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                quantity=0,
            )
            db.add(batch)
            db.flush()
        batch.quantity += quantity
        new = previous + quantity
    else:
        if quantity > previous:
            raise ValueError(f"Insufficient stock available. Only {previous} units in stock.")
        if batch_id:
            batch = db.get(Batch, batch_id)
            if not batch or batch.medicine_id != medicine_id:
                raise ValueError("Invalid batch for adjustment.")
            if batch.quantity < quantity:
                raise ValueError("Insufficient stock available in selected batch.")
            batch.quantity -= quantity
        else:
            candidates = [b for b in medicine.batches if b.quantity > 0 and not _is_expired(batch=b)]
            candidates.sort(key=lambda b: (b.expiry_date is None, b.expiry_date or date.max, b.id))
            remaining = quantity
            for b in candidates:
                if remaining <= 0:
                    break
                take = min(b.quantity, remaining)
                b.quantity -= take
                remaining -= take
            batch = candidates[0] if candidates else None
        new = previous - quantity

    db.flush()
    txn = StockTransaction(
        medicine_id=medicine_id,
        batch_id=batch.id if batch else None,
        transaction_type="adjustment",
        quantity=quantity,
        previous_stock=previous,
        new_stock=new,
        notes=note,
        user_id=user_id,
    )
    db.add(txn)
    db.flush()
    return txn


def _is_expired(batch: Batch) -> bool:
    return batch.expiry_date is not None and batch.expiry_date < today()


def history(
    db: Session,
    medicine_id: int | None = None,
    txn_type: str | None = None,
    start: date | None = None,
    end: date | None = None,
    limit: int = 200,
    offset: int = 0,
) -> tuple[list[dict], int]:
    query = db.query(StockTransaction)
    count_query = db.query(func.count(StockTransaction.id))

    if medicine_id:
        query = query.filter(StockTransaction.medicine_id == medicine_id)
        count_query = count_query.filter(StockTransaction.medicine_id == medicine_id)
    if txn_type:
        query = query.filter(StockTransaction.transaction_type == txn_type)
        count_query = count_query.filter(StockTransaction.transaction_type == txn_type)
    if start:
        start_dt = datetime.combine(start, datetime.min.time())
        query = query.filter(StockTransaction.transaction_date >= start_dt)
        count_query = count_query.filter(StockTransaction.transaction_date >= start_dt)
    if end:
        end_dt = datetime.combine(end, datetime.max.time())
        query = query.filter(StockTransaction.transaction_date <= end_dt)
        count_query = count_query.filter(StockTransaction.transaction_date <= end_dt)

    total = int(count_query.scalar() or 0)
    rows = query.order_by(StockTransaction.transaction_date.desc(), StockTransaction.id.desc()).offset(offset).limit(limit).all()

    result = []
    for t in rows:
        result.append(
            {
                "id": t.id,
                "medicine_id": t.medicine_id,
                "medicine_name": t.medicine.name if t.medicine else None,
                "medicine_code": t.medicine.medicine_code if t.medicine else None,
                "batch_id": t.batch_id,
                "batch_number": t.batch.batch_number if t.batch else None,
                "transaction_type": t.transaction_type,
                "quantity": t.quantity,
                "previous_stock": t.previous_stock,
                "new_stock": t.new_stock,
                "reference_number": t.reference_number,
                "recipient": t.recipient,
                "transaction_date": t.transaction_date,
                "notes": t.notes,
                "user_id": t.user_id,
            }
        )
    return result, total
