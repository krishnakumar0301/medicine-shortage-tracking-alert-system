from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[schemas.NotificationOut])
def list_notifications(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
    limit: int = 100,
):
    return (
        db.query(models.Notification)
        .order_by(models.Notification.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/unread-count", response_model=dict)
def unread_count(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    count = db.query(models.Notification).filter(models.Notification.is_read.is_(False)).count()
    return {"count": count}


@router.post("/read-all", response_model=dict)
def mark_all_read(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    count = (
        db.query(models.Notification)
        .filter(models.Notification.is_read.is_(False))
        .update({"is_read": True}, synchronize_session=False)
    )
    db.commit()
    return {"updated": count}


@router.post("/{notification_id}/read", response_model=schemas.NotificationOut)
def mark_read(
    notification_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)
):
    n = db.get(models.Notification, notification_id)
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.commit()
    db.refresh(n)
    return n


@router.post("/refresh", response_model=dict)
def regenerate(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    from ..services.alert_service import refresh_all_alerts

    db.query(models.Notification).delete()
    db.commit()
    refresh_all_alerts(db)
    count = db.query(models.Notification).count()
    return {"generated": count}
