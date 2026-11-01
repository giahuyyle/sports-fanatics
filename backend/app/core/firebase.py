from functools import lru_cache
from threading import Lock

import firebase_admin
from firebase_admin import auth, exceptions
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import config

bearer = HTTPBearer(auto_error=False)
_initialization_lock = Lock()


@lru_cache
def firebase_app():
    if not config.firebase_project_id:
        raise ValueError("Firebase project is not configured")
    with _initialization_lock:
        try:
            return firebase_admin.get_app("sports-fanatics")
        except ValueError:
            return firebase_admin.initialize_app(
                options={"projectId": config.firebase_project_id}, name="sports-fanatics"
            )


def verified_identity(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    unauthorized = HTTPException(401, "Please sign in again", headers={"WWW-Authenticate": "Bearer"})
    if credentials is None:
        raise unauthorized
    try:
        app = firebase_app()
    except Exception:
        raise HTTPException(503, "Account service is not configured") from None
    try:
        return auth.verify_id_token(credentials.credentials, app=app, check_revoked=True)
    except (auth.InvalidIdTokenError, auth.RevokedIdTokenError, auth.UserDisabledError, auth.UserNotFoundError, ValueError):
        raise unauthorized from None
    except (exceptions.FirebaseError, OSError):
        raise HTTPException(503, "Account service is temporarily unavailable") from None
