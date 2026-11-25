from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/api/restock", tags=["restock"])


@router.get("", response_model=list[schemas.RestockRequestOut])
def list_requests(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return (
        db.query(models.RestockRequest)
        .order_by(models.RestockRequest.created_at.desc())
        .limit(100)
        .all()
    )


@router.post("", response_model=schemas.RestockRequestOut, status_code=status.HTTP_201_CREATED)
def create_request(
    payload: schemas.RestockRequestCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    if not db.get(models.Medicine, payload.medicine_id):
        raise HTTPException(status_code=404, detail="Medicine not found")
    request = models.RestockRequest(
        medicine_id=payload.medicine_id,
        quantity=payload.quantity,
        reason=payload.reason,
        status="pending",
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


@router.put("/{request_id}", response_model=schemas.RestockRequestOut)
def update_request(
    request_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    request = db.get(models.RestockRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Restock request not found")
    new_status = payload.get("status")
    if new_status not in ("pending", "ordered", "received", "cancelled"):
        raise HTTPException(status_code=400, detail="Invalid status")
    request.status = new_status
    db.commit()
    db.refresh(request)
    return request


@router.delete("/{request_id}", status_code=200)
def delete_request(request_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    request = db.get(models.RestockRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Restock request not found")
    db.delete(request)
    db.commit()
    return {"message": "Restock request deleted."}
