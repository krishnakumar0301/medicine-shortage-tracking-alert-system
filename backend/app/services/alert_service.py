from datetime import datetime

from sqlalchemy.orm import Session

from ..config import settings
from ..models import Alert, Batch, Medicine, Notification
from .expiry_service import classify_expiry
from .stock_service import current_stock_for_medicine

PRIORITY_OUT = 1
PRIORITY_CRITICAL = 2
PRIORITY_LOW = 3
PRIORITY_EXPIRING = 3
PRIORITY_EXPIRED = 2
PRIORITY_RESTOCK = 3
PRIORITY_HEALTHY = 5


def _deactivate_existing(db: Session, medicine_id: int, alert_type: str):
    db.query(Alert).filter(
        Alert.medicine_id == medicine_id,
        Alert.alert_type == alert_type,
        Alert.status == "active",
    ).update({"status": "resolved", "resolved_at": datetime.utcnow()}, synchronize_session=False)


def _add_alert(db: Session, medicine_id: int, alert_type: str, priority: int, message: str):
    alert = Alert(
        medicine_id=medicine_id,
        alert_type=alert_type,
        priority=priority,
        message=message,
        status="active",
    )
    db.add(alert)


def _add_notification(db: Session, ntype: str, title: str, message: str, medicine_id: int | None):
    db.add(
        Notification(
            notification_type=ntype,
            title=title,
            message=message,
            medicine_id=medicine_id,
            is_read=False,
        )
    )


def refresh_medicine_alerts(db: Session, medicine: Medicine):
    """Recompute stock-based alerts for a single medicine."""
    _deactivate_existing(db, medicine.id, "stock")
    _deactivate_existing(db, medicine.id, "expiry")
    _deactivate_existing(db, medicine.id, "restock")

    current = current_stock_for_medicine(db, medicine.id)

    if current <= 0:
        msg = f"{medicine.name} is currently unavailable (Out of Stock)."
        _add_alert(db, medicine.id, "out_of_stock", PRIORITY_OUT, msg)
        _add_notification(db, "out_of_stock", "Out of Stock", msg, medicine.id)
    elif current <= medicine.minimum_stock:
        msg = f"{medicine.name} stock ({current}) is at or below the minimum level ({medicine.minimum_stock})."
        _add_alert(db, medicine.id, "low_stock", PRIORITY_CRITICAL, msg)
        _add_notification(db, "low_stock", "Shortage Alert", msg, medicine.id)
    else:
        _add_notification(db, "healthy", "Stock Healthy", f"{medicine.name} stock level is healthy ({current} units).", medicine.id)

    for batch in medicine.batches:
        if batch.expiry_date is None:
            continue
        status, days = classify_expiry(batch.expiry_date)
        if status == "expired":
            msg = f"{medicine.name} batch {batch.batch_number} EXPIRED ({abs(days)} days ago)."
            _add_alert(db, medicine.id, "expired", PRIORITY_EXPIRED, msg)
            _add_notification(db, "expired", "Expired Medicine", msg, medicine.id)
        elif status == "expiring_soon":
            msg = f"{medicine.name} batch {batch.batch_number} will expire in {days} days."
            _add_alert(db, medicine.id, "expiring_soon", PRIORITY_EXPIRING, msg)
            _add_notification(db, "expiring_soon", "Expiring Soon", msg, medicine.id)

    if current > 0 and current <= medicine.maximum_stock * 0.25:
        msg = f"Restock recommended for {medicine.name}."
        _add_alert(db, medicine.id, "restock", PRIORITY_RESTOCK, msg)

    db.commit()


def refresh_all_alerts(db: Session):
    medicines = db.query(Medicine).filter(Medicine.is_active.is_(True)).all()
    for m in medicines:
        refresh_medicine_alerts(db, m)


def compute_stock_alert_for(medicine: Medicine, current: int) -> dict:
    if current <= 0:
        return {"type": "out_of_stock", "priority": PRIORITY_OUT,
                "message": f"{medicine.name} is currently unavailable (Out of Stock)."}
    if current <= medicine.minimum_stock:
        return {"type": "low_stock", "priority": PRIORITY_CRITICAL,
                "message": f"{medicine.name} stock is below the minimum required level ({medicine.minimum_stock})."}
    return {"type": "healthy", "priority": PRIORITY_HEALTHY,
            "message": f"{medicine.name} stock is healthy."}


def active_alert_count(db: Session) -> int:
    return db.query(Alert).filter(Alert.status == "active").count()


def expiry_warning_days(db: Session) -> int:
    from ..models import Setting

    row = db.get(Setting, "expiry_warning_days")
    if row and row.value.isdigit():
        return int(row.value)
    return settings.EXPIRY_WARNING_DAYS


def nearest_expiring_batch(db: Session, medicine_id: int) -> Batch | None:
    batches = (
        db.query(Batch)
        .filter(Batch.medicine_id == medicine_id, Batch.quantity > 0)
        .order_by(Batch.expiry_date.asc())
        .all()
    )
    for b in batches:
        if b.expiry_date and b.expiry_date >= datetime.utcnow().date():
            return b
    return None
