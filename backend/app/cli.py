"""Operator commands: grant-admin and explicit NBA data synchronization."""

import argparse
import json
import math

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.db.identity import User
from app.db.session import make_engine


def positive_float(value):
    result = float(value)
    if not math.isfinite(result) or result <= 0:
        raise argparse.ArgumentTypeError("Must be a finite positive number")
    return result


def nonnegative_int(value):
    result = int(value)
    if result < 0:
        raise argparse.ArgumentTypeError("Must be nonnegative")
    return result


def positive_int(value):
    result = nonnegative_int(value)
    if result == 0 or result >= 2**31:
        raise argparse.ArgumentTypeError("Must be between 1 and 2147483647")
    return result


def main():
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    grant = commands.add_parser("grant-admin")
    grant.add_argument("firebase_uid")
    sync = commands.add_parser(
        "nba-sync", help="Sync NBA players and full career season totals"
    )
    sync.add_argument("--admin-uid", required=True)
    selection = sync.add_mutually_exclusive_group(required=True)
    selection.add_argument(
        "--active", action="store_true", help="Current-season rostered players"
    )
    selection.add_argument(
        "--player-id", type=positive_int, action="append", dest="player_ids"
    )
    sync.add_argument("--offset", type=nonnegative_int, default=0)
    sync.add_argument("--limit", type=positive_int)
    sync.add_argument("--timeout", type=positive_float, default=20)
    sync.add_argument("--retries", type=int, choices=range(6), default=2)
    sync.add_argument(
        "--delay",
        type=positive_float,
        default=1,
        help="Minimum seconds between NBA requests",
    )
    args = parser.parse_args()
    engine = make_engine(Settings())
    try:
        if args.command == "grant-admin":
            with Session(engine) as session:
                user = session.scalar(
                    select(User).where(User.firebase_uid == args.firebase_uid)
                )
                if user is None:
                    parser.error("User must sign in and call /api/v1/me first.")
                user.is_admin = True
                session.commit()
            print("Administrator access granted.")
        else:
            from app.jobs.nba_sync import sync_nba
            from app.providers.nba import NBAClient, NBADataError

            try:
                result = sync_nba(
                    engine,
                    args.admin_uid,
                    NBAClient(args.timeout, args.retries, args.delay),
                    active=args.active,
                    player_ids=args.player_ids or (),
                    offset=args.offset,
                    limit=args.limit,
                    on_progress=lambda item: print(json.dumps(item), flush=True),
                )
            except NBADataError as exc:
                parser.error(str(exc))
            print(json.dumps(result), flush=True)
            if result["status"] != "complete":
                raise SystemExit(1)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
