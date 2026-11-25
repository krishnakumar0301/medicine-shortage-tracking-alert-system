from sqlalchemy.orm import Session

from ..models import Medicine
from .expiry_service import expiry_status_for_medicine
from .prediction_service import average_daily_usage, build_prediction
from .stock_service import current_stock_for_medicine, stock_status_for
from .alert_service import expiry_warning_days


def medicine_health_score(db: Session, medicine: Medicine) -> dict:
    """0-100 health score based on stock availability, expiry risk, demand and restock status."""
    current = current_stock_for_medicine(db, medicine.id)
    minimum = medicine.minimum_stock
    maximum = medicine.maximum_stock or (minimum * 4 or 100)

    score = 0.0

    if current <= 0:
        stock_component = 0
    elif current <= minimum:
        stock_component = 25
    elif current <= maximum * 0.4:
        stock_component = 55
    else:
        stock_component = 100
    score += stock_component * 0.5

    warning = expiry_warning_days(db)
    status, days, _ = expiry_status_for_medicine(db, medicine, warning)
    if status == "expired":
        expiry_component = 0
    elif status == "expiring_soon":
        expiry_component = 40
    elif status == "safe":
        expiry_component = 100
    else:
        expiry_component = 50
    score += expiry_component * 0.2

    usage = average_daily_usage(db, medicine.id)
    if usage > 0:
        days_of_supply = (current / usage) if usage else 0
        if days_of_supply >= 30:
            demand_component = 100
        elif days_of_supply >= 14:
            demand_component = 70
        elif days_of_supply >= 7:
            demand_component = 45
        else:
            demand_component = 20
    else:
        demand_component = 60
    score += demand_component * 0.2

    pred = build_prediction(db, medicine)
    if pred["recommended_reorder_qty"] > 0:
        restock_component = 35
    else:
        restock_component = 100
    score += restock_component * 0.1

    score = round(max(0.0, min(100.0, score)), 1)

    if score >= 80:
        label = "Excellent"
    elif score >= 60:
        label = "Good"
    elif score >= 40:
        label = "Fair"
    else:
        label = "Critical"
    return {"score": score, "label": label}


def overall_health_score(db: Session) -> tuple[float, str]:
    medicines = db.query(Medicine).filter(Medicine.is_active.is_(True)).all()
    if not medicines:
        return 0.0, "No data"
    total = sum(medicine_health_score(db, m)["score"] for m in medicines)
    score = round(total / len(medicines), 1)
    if score >= 80:
        label = "Excellent"
    elif score >= 60:
        label = "Good"
    elif score >= 40:
        label = "Fair"
    else:
        label = "Critical"
    return score, label


def smart_restock_priority(db: Session) -> list[dict]:
    """Rank medicines by shortage risk and demand."""
    medicines = db.query(Medicine).filter(Medicine.is_active.is_(True)).all()
    items = []
    for m in medicines:
        current = current_stock_for_medicine(db, m.id)
        status = stock_status_for(db, m)
        usage = average_daily_usage(db, m.id)
        pred = build_prediction(db, m)
        reorder = pred["recommended_reorder_qty"]

        if status == "out":
            score = 100
            priority = "critical"
        elif status == "critical":
            score = 85
            priority = "critical"
        elif status == "low":
            score = 60
            priority = "high"
        elif reorder > 0 and usage > 0:
            score = 45
            priority = "medium"
        elif reorder > 0:
            score = 35
            priority = "medium"
        else:
            score = 10
            priority = "low"

        items.append(
            {
                "medicine_id": m.id,
                "medicine_name": m.name,
                "medicine_code": m.medicine_code,
                "current_stock": current,
                "minimum_stock": m.minimum_stock,
                "stock_status": status,
                "priority": priority,
                "priority_score": score,
                "avg_daily_usage": round(usage, 2),
                "recommended_reorder": reorder,
            }
        )
    items.sort(key=lambda x: x["priority_score"], reverse=True)
    return items
