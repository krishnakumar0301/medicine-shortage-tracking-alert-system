from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[schemas.AlertOut])
def list_alerts(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
    status: str = "active",
):
    query = db.query(models.Alert)
    if status:
        query = query.filter(models.Alert.status == status)
    return query.order_by(models.Alert.priority.asc(), models.Alert.created_at.desc()).limit(200).all()


@router.get("/summary", response_model=dict)
def alert_summary(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    rows = (
        db.query(models.Alert.alert_type, models.Alert.priority)
        .filter(models.Alert.status == "active")
        .all()
    )
    summary = {"total": len(rows)}
    for alert_type, priority in rows:
        summary[alert_type] = summary.get(alert_type, 0) + 1
    return summary


@router.post("/{alert_id}/resolve", response_model=schemas.AlertOut)
def resolve_alert(alert_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    alert = db.get(models.Alert, alert_id)
    if not alert:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Alert not found")
    if alert.status == "active":
        from datetime import datetime

        alert.status = "resolved"
        alert.resolved_at = datetime.utcnow()
        db.commit()
        db.refresh(alert)
    return alert


@router.post("/resolve-all", response_model=dict)
def resolve_all(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    from datetime import datetime

    count = (
        db.query(models.Alert)
        .filter(models.Alert.status == "active")
        .update({"status": "resolved", "resolved_at": datetime.utcnow()}, synchronize_session=False)
    )
    db.commit()
    return {"resolved": count}
