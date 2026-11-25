from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from . import auth
from .database import get_db
from .models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if not token:
        raise CREDENTIALS_EXCEPTION
    try:
        payload = auth.decode_access_token(token)
    except Exception:
        raise CREDENTIALS_EXCEPTION
    username: str | None = payload.get("sub")
    if not username:
        raise CREDENTIALS_EXCEPTION
    user = db.query(User).filter(User.username == username, User.is_active.is_(True)).first()
    if not user:
        raise CREDENTIALS_EXCEPTION
    return user


def require_role(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return checker
