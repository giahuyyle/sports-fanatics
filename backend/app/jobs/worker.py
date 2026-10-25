"""Run with python -m app.jobs.worker. Multiple workers use SKIP LOCKED."""

import logging
import signal
import threading
import time
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.db.draft import Draft, League
from app.db.session import make_engine
from app.domain.drafts import automatic_pick
from app.observability import configure_logging, metrics, record

logger = logging.getLogger(__name__)


def process_expired(engine, timeout=2.0):
    with Session(engine) as session, session.begin():
        league = session.scalar(
            select(League)
            .join(Draft, Draft.id == League.id)
            .where(League.status == "live", Draft.deadline <= datetime.now(UTC))
            .order_by(Draft.deadline)
            .with_for_update(of=League, skip_locked=True)
            .limit(1)
        )
        if league is None:
            return False
        draft = session.get(Draft, league.id)
        lag = (datetime.now(UTC) - draft.deadline).total_seconds()
        record("worker_turns")
        record("worker_lag_seconds_total", lag)
        logger.info(
            "expired_turn", extra={"draft_id": str(draft.id), "lag_seconds": lag}
        )
        automatic_pick(session, league, draft, timeout)
        return True


def main():
    configure_logging()
    settings = Settings()
    engine = make_engine(settings)
    stopping = threading.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: stopping.set())
    last_metrics = time.monotonic()
    try:
        while not stopping.is_set():
            try:
                for _ in range(100):
                    if stopping.is_set() or not process_expired(
                        engine, settings.solver_timeout_seconds
                    ):
                        break
            except Exception:
                record("worker_failures")
                logger.exception("worker_iteration_failed")
            if time.monotonic() - last_metrics >= 60:
                logger.info("worker_metrics", extra={"metrics": metrics()})
                last_metrics = time.monotonic()
            stopping.wait(settings.worker_interval_seconds)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
