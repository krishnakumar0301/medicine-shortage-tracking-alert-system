from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import settings
from ..models import DemandEntry, Medicine, StockTransaction
from .stock_service import current_stock_for_medicine


def _usage_series(db: Session, medicine_id: int, days: int = 120) -> dict[date, int]:
    since = date.today() - timedelta(days=days)
    rows = (
        db.query(DemandEntry.date, func.sum(DemandEntry.quantity_used))
        .filter(DemandEntry.medicine_id == medicine_id, DemandEntry.date >= since)
        .group_by(DemandEntry.date)
        .all()
    )
    return {d: int(qty or 0) for d, qty in rows}


def _inferred_usage(db: Session, medicine_id: int, days: int = 120) -> dict[date, int]:
    """Infer daily usage from stock-out transactions as a fallback signal."""
    since = date.today() - timedelta(days=days)
    rows = (
        db.query(
            func.date(StockTransaction.transaction_date),
            func.sum(StockTransaction.quantity),
        )
        .filter(
            StockTransaction.medicine_id == medicine_id,
            StockTransaction.transaction_type == "out",
            func.date(StockTransaction.transaction_date) >= since,
        )
        .group_by(func.date(StockTransaction.transaction_date))
        .all()
    )
    return {date.fromisoformat(d): int(qty or 0) for d, qty in rows}


def merged_usage(db: Session, medicine_id: int, days: int = 120) -> dict[date, int]:
    explicit = _usage_series(db, medicine_id, days)
    inferred = _inferred_usage(db, medicine_id, days)
    merged: dict[date, int] = {}
    for k, v in {**explicit, **inferred}.items():
        merged[k] = max(explicit.get(k, 0), inferred.get(k, 0))
    return merged


def average_daily_usage(db: Session, medicine_id: int, days: int = 120) -> float:
    usage = merged_usage(db, medicine_id, days)
    if not usage:
        return 0.0
    # only count days that actually had stock activity to avoid dilution by zero days
    return sum(usage.values()) / days


def monthly_usage_series(db: Session, days: int = 120) -> list[dict]:
    """Monthly usage across all medicines for the chart."""
    since = date.today() - timedelta(days=days)
    explicit = (
        db.query(
            func.strftime("%Y-%m", DemandEntry.date),
            func.sum(DemandEntry.quantity_used),
        )
        .filter(DemandEntry.date >= since)
        .group_by(func.strftime("%Y-%m", DemandEntry.date))
        .all()
    )
    inferred = (
        db.query(
            func.strftime("%Y-%m", func.date(StockTransaction.transaction_date)),
            func.sum(StockTransaction.quantity),
        )
        .filter(
            StockTransaction.transaction_type == "out",
            func.date(StockTransaction.transaction_date) >= since,
        )
        .group_by(func.strftime("%Y-%m", func.date(StockTransaction.transaction_date)))
        .all()
    )
    merged: dict[str, int] = {}
    for month, qty in explicit:
        merged[month] = merged.get(month, 0) + int(qty or 0)
    for month, qty in inferred:
        merged[month] = max(merged.get(month, 0), int(qty or 0))
    return [{"month": k, "usage": v} for k, v in sorted(merged.items())]


def predict_next_month(db: Session, medicine_id: int, days: int = 120) -> float:
    usage = merged_usage(db, medicine_id, days)
    if not usage:
        return 0.0
    ordered = sorted(usage.items())
    xs = [i for i in range(len(ordered))]
    ys = [float(v) for _, v in ordered]
    n = len(xs)
    if n < 2:
        return sum(ys) / (days / 30.0)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    denom = sum((x - mean_x) ** 2 for x in xs) or 1.0
    slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)) / denom
    intercept = mean_y - slope * mean_x
    next_x = n
    daily = max(slope * next_x + intercept, 0.0)
    return round(daily * 30, 1)


def forecast_series(db: Session, medicine_id: int, horizon_days: int = 30, days: int = 120) -> list[dict]:
    usage = merged_usage(db, medicine_id, days)
    ordered = sorted(usage.items())
    xs = [i for i in range(len(ordered))]
    ys = [float(v) for _, v in ordered]
    n = len(xs)
    if n < 2:
        base = (sum(ys) / (days / 30.0)) if days else 0
        step = 0.0
    else:
        mean_x = sum(xs) / n
        mean_y = sum(ys) / n
        denom = sum((x - mean_x) ** 2 for x in xs) or 1.0
        slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)) / denom
        intercept = mean_y - slope * mean_x
        base = max(slope * n + intercept, 0.0)
        step = max(slope, 0.0)

    points = []
    for i in range(1, horizon_days + 1):
        value = max(base + step * i, 0.0)
        d = date.today() + timedelta(days=i)
        points.append({"date": d.isoformat(), "predicted": round(value, 2)})
    return points


def build_prediction(db: Session, medicine: Medicine, days: int | None = None) -> dict:
    history_days = days or settings.PREDICTION_HISTORY_DAYS
    lead_time = settings.LEAD_TIME_DAYS
    safety_factor = settings.SAFETY_STOCK_FACTOR

    avg_daily = average_daily_usage(db, medicine.id, history_days)
    avg_monthly = round(avg_daily * 30, 1)
    predicted_next_month = predict_next_month(db, medicine.id, history_days)
    safety_stock = round(max(avg_daily, 0) * lead_time * safety_factor, 1)
    lead_time_demand = round(max(avg_daily, 0) * lead_time, 1)
    current = current_stock_for_medicine(db, medicine.id)
    reorder_point = round(safety_stock + lead_time_demand, 1)
    recommended = round(max(predicted_next_month + safety_stock - current, 0), 1)

    return {
        "medicine_id": medicine.id,
        "medicine_name": medicine.name,
        "current_stock": current,
        "avg_daily_usage": round(avg_daily, 2),
        "avg_monthly_usage": avg_monthly,
        "predicted_next_month": predicted_next_month,
        "safety_stock": safety_stock,
        "lead_time_demand": lead_time_demand,
        "reorder_point": reorder_point,
        "recommended_reorder_qty": recommended,
        "forecast": forecast_series(db, medicine.id, 30, history_days),
        "note": "Prediction is an estimate for planning purposes only, not medical advice.",
    }


def daily_usage_snapshot(db: Session, medicine_id: int) -> int:
    usage = merged_usage(db, medicine_id, 1)
    return int(sum(usage.values()) or 0)
