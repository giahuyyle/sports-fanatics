from app.db.events import DraftEvent


def emit(session, draft, kind, payload):
    session.add(
        DraftEvent(
            draft_id=draft.id, revision=draft.revision, kind=kind, payload=payload
        )
    )
