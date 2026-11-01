from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.schema.user import User


def find_user(session: Session, uid: str):
    return session.scalar(select(User).where(User.firebase_uid == uid))


def synchronize_user(session: Session, claims: dict):
    user = find_user(session, claims["uid"])
    if user is None:
        user = User(firebase_uid=claims["uid"])
        session.add(user)
    for field, claim in (("email", "email"), ("display_name", "name"), ("photo_url", "picture")):
        setattr(user, field, claims.get(claim))
    user.email_verified = bool(claims.get("email_verified", False))
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        if find_user(session, claims["uid"]) is None:
            raise
        # Another request created this Firebase identity first.
        return synchronize_user(session, claims)
    session.refresh(user)
    return user
