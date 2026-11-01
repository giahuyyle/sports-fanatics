from fastapi import APIRouter, Depends, HTTPException
from app.api.v1.player import SessionDep
from app.core.firebase import verified_identity
from app.models.user import UserResponse
from app.services.users import find_user, synchronize_user

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/me", response_model=UserResponse)
def sync_me(session: SessionDep, claims: dict = Depends(verified_identity)):
    return synchronize_user(session, claims)


@router.get("/me", response_model=UserResponse)
def get_me(session: SessionDep, claims: dict = Depends(verified_identity)):
    user = find_user(session, claims["uid"])
    if user is None:
        raise HTTPException(404, "Account has not been synchronized")
    return user
