import threading
import time
from typing import Annotated

import firebase_admin
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.identity import User
from app.db.session import get_session
from app.errors import DomainError

_bearer = HTTPBearer(auto_error=False)
_init_lock = threading.Lock()


def verify_token(token: str, project_id: str) -> dict:
    # The SDK honors FIREBASE_AUTH_EMULATOR_HOST only when explicitly configured.
    with _init_lock:
        try:
            firebase_app = firebase_admin.get_app(project_id)
        except ValueError:
            firebase_app = firebase_admin.initialize_app(
                options={"projectId": project_id}, name=project_id
            )
    try:
        claims = auth.verify_id_token(token, app=firebase_app, check_revoked=True)
        # The emulator omits the SDK's time validation. Keep local behavior strict.
        expires = claims.get("exp")
        if not isinstance(expires, (int, float)) or expires <= time.time():
            raise ValueError("Token has expired")
        return claims
    except (ValueError, firebase_admin.exceptions.FirebaseError) as exc:
        raise DomainError("invalid_token", "Sign in again to continue.", 401) from exc


def current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    session: Annotated[Session, Depends(get_session)],
) -> User:
    if credentials is None:
        raise DomainError("authentication_required", "Sign in to continue.", 401)
    claims = verify_token(
        credentials.credentials, request.app.state.settings.firebase_project_id
    )
    uid = claims.get("uid")
    if not isinstance(uid, str) or not uid or len(uid) > 128:
        raise DomainError("invalid_token", "Token has no valid user identity.", 401)
    session.execute(
        insert(User)
        .values(firebase_uid=uid)
        .on_conflict_do_nothing(index_elements=[User.firebase_uid])
    )
    session.commit()
    return session.scalar(select(User).where(User.firebase_uid == uid))


def admin_user(user: Annotated[User, Depends(current_user)]) -> User:
    if not user.is_admin:
        raise DomainError(
            "admin_required", "Platform administrator access required.", 403
        )
    return user


SessionDep = Annotated[Session, Depends(get_session)]
UserDep = Annotated[User, Depends(current_user)]
AdminDep = Annotated[User, Depends(admin_user)]
