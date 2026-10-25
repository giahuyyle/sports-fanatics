import asyncio
import json
import time
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.leagues import snapshot
from app.auth import AdminDep, SessionDep, UserDep
from app.db.draft import Draft
from app.db.events import DraftEvent
from app.domain.catalog import audit
from app.domain.drafts import candidates, lock_league, membership, selections
from app.domain.events import emit
from app.domain.roster import solve_completion
from app.errors import DomainError
from app.observability import metrics

router = APIRouter(tags=["events and recovery"])


def event_batch(engine, draft_id, after):
    with Session(engine) as session:
        rows = session.scalars(
            select(DraftEvent)
            .where(DraftEvent.draft_id == draft_id, DraftEvent.revision > after)
            .order_by(DraftEvent.revision)
            .limit(100)
        ).all()
        return [
            {"revision": e.revision, "kind": e.kind, "payload": e.payload} for e in rows
        ]


@router.get("/leagues/{league_id}/events")
def events(
    league_id: UUID,
    request: Request,
    user: UserDep,
    session: SessionDep,
    after_revision: int = Query(0, ge=0),
    follow: bool = True,
):
    membership(session, league_id, user)
    draft = session.get(Draft, league_id)
    if not draft:
        raise DomainError(
            "draft_not_started", "Start the draft before subscribing.", 409
        )
    last_event = request.headers.get("last-event-id")
    if last_event is not None:
        try:
            after_revision = max(after_revision, int(last_event))
        except ValueError as exc:
            raise DomainError(
                "invalid_cursor", "Last-Event-ID must be a revision number.", 422
            ) from exc
    if after_revision > draft.revision:
        raise DomainError(
            "invalid_cursor", "Cursor is ahead of the draft. Fetch a snapshot.", 422
        )
    # Do not hold an authentication transaction/connection throughout a stream.
    session.rollback()
    token = request.headers["authorization"].split(" ", 1)[1]
    engine = request.app.state.engine
    project = request.app.state.settings.firebase_project_id

    async def stream():
        from app.auth import verify_token

        cursor, last_auth = after_revision, time.monotonic()
        while True:
            if await request.is_disconnected():
                break
            if time.monotonic() - last_auth > 60:
                try:
                    await asyncio.to_thread(verify_token, token, project)
                except DomainError:
                    yield "event: authentication_required\ndata: {}\n\n"
                    break
                last_auth = time.monotonic()
            batch = await asyncio.to_thread(event_batch, engine, league_id, cursor)
            for event in batch:
                cursor = event["revision"]
                yield (
                    f"id: {cursor}\nevent: {event['kind']}\n"
                    f"data: {json.dumps(event)}\n\n"
                )
            if not follow and len(batch) < 100:
                break
            if not batch:
                yield ": keepalive\n\n"
                await asyncio.sleep(1)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/admin/leagues/{league_id}/resume")
def resume(league_id: UUID, request: Request, user: AdminDep, session: SessionDep):
    league = lock_league(session, league_id)
    if league.status != "paused":
        raise DomainError("draft_not_paused", "Only paused drafts can be resumed.")
    draft = session.get(Draft, league_id)
    draft.completion = solve_completion(
        candidates(session, draft.pool_id),
        draft.manager_order,
        selections(session, draft.id),
        request.app.state.settings.solver_timeout_seconds,
    )
    league.status = "live"
    draft.pause_reason = None
    draft.deadline = datetime.now(UTC) + timedelta(seconds=league.timer)
    draft.revision += 1
    emit(session, draft, "draft.resumed", {"deadline": draft.deadline.isoformat()})
    audit(session, user, "draft.resume", league_id)
    session.commit()
    return snapshot(session, league_id)


@router.get("/admin/metrics")
def admin_metrics(user: AdminDep):
    return {
        "scope": "this API process; worker counters are emitted to its JSON logs",
        "counters": metrics(),
    }
