from collections import defaultdict
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import get_current_user
from ..services.alert_service import expiry_warning_days
from ..services.expiry_service import expiry_distribution, expiry_status_for_medicine
from ..services.health_service import medicine_health_score, overall_health_score, smart_restock_priority
from ..services.prediction_service import monthly_usage_series
from ..services.stock_service import current_stock_for_medicine, stock_status_for

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=dict)
def dashboard(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    medicines = db.query(models.Medicine).filter(models.Medicine.is_active.is_(True)).all()
    warning = expiry_warning_days(db)

    total_medicines = len(medicines)
    total_stock = 0
    low_stock = 0
    out_stock = 0
    expiring = 0
    expired = 0
    restock_needed = 0

    for m in medicines:
        stock = current_stock_for_medicine(db, m.id)
        total_stock += stock
        status = stock_status_for(db, m)
        if status == "out":
            out_stock += 1
            restock_needed += 1
        elif status == "critical":
            low_stock += 1
            restock_needed += 1
        elif status == "low":
            low_stock += 1
            restock_needed += 1
        exp_status, _, _ = expiry_status_for_medicine(db, m, warning)
        if exp_status == "expiring_soon":
            expiring += 1
        elif exp_status == "expired":
            expired += 1

    stats = [
        {"key": "total_medicines", "label": "Total Medicines", "value": total_medicines,
         "sub": "Active catalog items"},
        {"key": "total_stock", "label": "Available Stock", "value": total_stock,
         "sub": "Total units on shelf"},
        {"key": "low_stock", "label": "Low Stock", "value": low_stock, "sub": "Below minimum"},
        {"key": "out_stock", "label": "Out of Stock", "value": out_stock, "sub": "Unavailable"},
        {"key": "expiring", "label": "Expiring Soon", "value": expiring, "sub": f"Within {warning} days"},
        {"key": "expired", "label": "Expired", "value": expired, "sub": "Not issuable"},
        {"key": "restock", "label": "Restock Needed", "value": restock_needed, "sub": "Priority medicines"},
    ]

    # Alerts
    active_alerts = (
        db.query(models.Alert)
        .filter(models.Alert.status == "active")
        .order_by(models.Alert.priority.asc(), models.Alert.created_at.desc())
        .limit(8)
        .all()
    )
    alert_items = []
    for a in active_alerts:
        m = a.medicine
        alert_items.append(
            {
                "type": a.alert_type,
                "priority": a.priority,
                "message": a.message,
                "medicine_id": a.medicine_id,
                "medicine_name": m.name if m else None,
                "current_stock": current_stock_for_medicine(db, a.medicine_id) if m else None,
            }
        )

    # Timeline
    recent_txns = (
        db.query(models.StockTransaction)
        .order_by(models.StockTransaction.transaction_date.desc())
        .limit(12)
        .all()
    )
    timeline = []
    for t in recent_txns:
        direction = "in" if t.transaction_type == "in" else "out"
        text = {
            "in": f"Added {t.quantity} units",
            "out": f"{t.quantity} units issued",
            "adjustment": f"Adjusted by {t.quantity}",
        }.get(t.transaction_type, f"{t.transaction_type}: {t.quantity}")
        timeline.append(
            {
                "date": t.transaction_date,
                "type": t.transaction_type,
                "text": text,
                "medicine_id": t.medicine_id,
                "medicine_name": t.medicine.name if t.medicine else None,
            }
        )

    for m in medicines:
        status = stock_status_for(db, m)
        if status in ("critical", "out") and len(timeline) < 20:
            timeline.append(
                {
                    "date": datetime.utcnow(),
                    "type": "alert",
                    "text": f"{m.name} reached minimum level" if status == "critical"
                    else f"{m.name} is out of stock",
                    "medicine_id": m.id,
                    "medicine_name": m.name,
                }
            )
    timeline.sort(key=lambda e: e["date"], reverse=True)
    timeline = timeline[:16]

    priorities = smart_restock_priority(db)[:8]

    # Charts
    stock_by_category = defaultdict(int)
    for m in medicines:
        stock_by_category[m.category or "General"] += current_stock_for_medicine(db, m.id)
    stock_chart = [{"name": k, "stock": v} for k, v in sorted(stock_by_category.items())]

    monthly_usage = monthly_usage_series(db)

    since = date.today() - timedelta(days=180)
    in_out_rows = (
        db.query(
            func.strftime("%Y-%m", func.date(models.StockTransaction.transaction_date)),
            models.StockTransaction.transaction_type,
            func.sum(models.StockTransaction.quantity),
        )
        .filter(func.date(models.StockTransaction.transaction_date) >= since)
        .group_by(func.strftime("%Y-%m", func.date(models.StockTransaction.transaction_date)), models.StockTransaction.transaction_type)
        .all()
    )
    in_out = defaultdict(lambda: {"stock_in": 0, "stock_out": 0})
    for month, ttype, qty in in_out_rows:
        key = "stock_in" if ttype == "in" else "stock_out"
        in_out[month][key] += int(qty or 0)
    stock_in_out_chart = [
        {"month": k, **v} for k, v in sorted(in_out.items())
    ]

    expiry_chart = expiry_distribution(db)

    health, health_label = overall_health_score(db)

    return {
        "stats": stats,
        "alerts": alert_items,
        "timeline": timeline,
        "priorities": [dict(p) for p in priorities],
        "stock_by_category": stock_chart,
        "monthly_usage": monthly_usage,
        "stock_in_out": stock_in_out_chart,
        "expiry_distribution": expiry_chart,
        "health_score": health,
        "health_label": health_label,
    }
