"""Operator-only commands. Run: python -m app.cli grant-admin FIREBASE_UID."""

import argparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.db.identity import User
from app.db.session import make_engine


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["grant-admin"])
    parser.add_argument("firebase_uid")
    args = parser.parse_args()
    engine = make_engine(Settings())
    with Session(engine) as session:
        user = session.scalar(
            select(User).where(User.firebase_uid == args.firebase_uid)
        )
        if user is None:
            parser.error("User must sign in and call /api/v1/me first.")
        user.is_admin = True
        session.commit()
    engine.dispose()
    print("Administrator access granted.")


if __name__ == "__main__":
    main()
