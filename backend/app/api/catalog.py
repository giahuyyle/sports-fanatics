import csv
import io
import json
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

from app.auth import AdminDep, SessionDep, UserDep
from app.db.catalog import (
    AuditLog,
    ExternalPlayerID,
    ImportRun,
    NBATeam,
    Player,
    PlayerPool,
    PlayerPosition,
    PoolPlayer,
    SeasonStats,
)
from app.domain.catalog import audit, coverage, current_season
from app.errors import DomainError
from app.observability import record

router = APIRouter(tags=["players and administration"])
Position = Literal["PG", "SG", "SF", "PF", "C"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class PlayerInput(Input):
    name: str = Field(min_length=1, max_length=120)
    rookie_season: int = Field(ge=1946, le=2100)
    no_appearances: bool = False
    archived: bool = False
    tier: int = Field(ge=1, le=5)
    priority: int = Field(ge=0)
    positions: list[Position] = Field(min_length=1, max_length=5)
    nba_team_id: UUID | None = None
    external_ids: dict[str, str] = Field(default_factory=dict)

    @model_validator(mode="after")
    def valid(self):
        if self.rookie_season > current_season():
            raise ValueError("Rookie season cannot be in the future")
        if self.no_appearances and self.rookie_season != current_season():
            raise ValueError(
                "No-appearance exemption is only for current-season rookies"
            )
        if any(
            not k or len(k) > 60 or not v or len(v) > 120
            for k, v in self.external_ids.items()
        ):
            raise ValueError("Invalid provider identifier")
        return self


class Totals(Input):
    games: int = Field(ge=0)
    starts: int = Field(ge=0)
    minutes: float = Field(ge=0, allow_inf_nan=False)
    points: int = Field(ge=0)
    rebounds: int = Field(ge=0)
    assists: int = Field(ge=0)
    steals: int = Field(ge=0)
    blocks: int = Field(ge=0)
    turnovers: int = Field(ge=0)
    fouls: int = Field(ge=0)
    fg_made: int = Field(ge=0)
    fg_attempted: int = Field(ge=0)
    three_made: int = Field(ge=0)
    three_attempted: int = Field(ge=0)
    ft_made: int = Field(ge=0)
    ft_attempted: int = Field(ge=0)

    @model_validator(mode="after")
    def valid(self):
        if self.starts > self.games:
            raise ValueError("Starts exceed games")
        for prefix in ("fg", "three", "ft"):
            if getattr(self, prefix + "_made") > getattr(self, prefix + "_attempted"):
                raise ValueError("Made shots exceed attempted shots")
        if self.three_made > self.fg_made or self.three_attempted > self.fg_attempted:
            raise ValueError("Three pointers exceed field goals")
        if self.games == 0 and any(self.model_dump().values()):
            raise ValueError("No-appearance rows must have zero totals")
        return self


class StatRow(Input):
    player_id: UUID
    season: int = Field(ge=1946, le=2100)
    phase: Literal["regular", "playoffs"]
    scope: str = Field(min_length=1, max_length=12)
    totals: Totals


class ImportInput(Input):
    source: str = Field(min_length=1, max_length=200)
    format: Literal["json", "csv"]
    data: str = Field(max_length=5_000_000)


class PoolInput(Input):
    name: str = Field(min_length=1, max_length=120)


class PoolSelection(Input):
    player_ids: list[UUID] = Field(min_length=1, max_length=1000)


class TeamInput(Input):
    code: str = Field(min_length=1, max_length=12, pattern=r"^[A-Z0-9]+$")
    name: str = Field(min_length=1, max_length=120)


def get_or_404(session, model, identity):
    row = session.get(model, identity)
    if row is None:
        raise DomainError("not_found", "Requested record was not found.", 404)
    return row


def player_view(session, player):
    return {
        **{c.name: getattr(player, c.name) for c in Player.__table__.columns},
        "positions": session.scalars(
            select(PlayerPosition.position).where(PlayerPosition.player_id == player.id)
        ).all(),
        "external_ids": dict(
            session.execute(
                select(ExternalPlayerID.provider, ExternalPlayerID.external_id).where(
                    ExternalPlayerID.player_id == player.id
                )
            ).all()
        ),
        "coverage": coverage(session, player),
    }


@router.get("/players")
def players(
    user: UserDep,
    session: SessionDep,
    search: str = "",
    position: Position | None = None,
    tier: int | None = Query(None, ge=1, le=5),
    include_archived: bool = False,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    statement = select(Player)
    if not include_archived:
        statement = statement.where(Player.archived.is_(False))
    if search:
        statement = statement.where(Player.name.icontains(search, autoescape=True))
    if position:
        statement = statement.join(PlayerPosition).where(
            PlayerPosition.position == position
        )
    if tier:
        statement = statement.where(Player.tier == tier)
    rows = session.scalars(
        statement.order_by(Player.priority, Player.id).offset(offset).limit(limit)
    )
    return [player_view(session, p) for p in rows]


@router.get("/players/{player_id}")
def player_detail(player_id: UUID, user: UserDep, session: SessionDep):
    return player_view(session, get_or_404(session, Player, player_id))


@router.get("/players/{player_id}/history")
def history(player_id: UUID, user: UserDep, session: SessionDep):
    player = get_or_404(session, Player, player_id)
    rows = session.scalars(
        select(SeasonStats)
        .where(SeasonStats.player_id == player_id)
        .order_by(SeasonStats.season, SeasonStats.phase, SeasonStats.scope)
    ).all()
    results = []
    for row in rows:
        totals = row.totals
        averages = {
            k: v / totals["games"] if totals["games"] else None
            for k, v in totals.items()
            if k not in ("games", "starts")
        }
        percentages = {
            p: totals[p + "_made"] / totals[p + "_attempted"]
            if totals[p + "_attempted"]
            else None
            for p in ("fg", "three", "ft")
        }
        results.append(
            {
                "season": row.season,
                "phase": row.phase,
                "scope": row.scope,
                "nba_team_id": row.nba_team_id,
                "totals": totals,
                "averages": averages,
                "percentages": percentages,
                "import_run_id": row.import_run_id,
            }
        )
    return {"coverage": coverage(session, player), "seasons": results}


def write_player(session, body, player):
    for key, value in body.model_dump(exclude={"positions", "external_ids"}).items():
        setattr(player, key, value)
    if body.nba_team_id:
        get_or_404(session, NBATeam, body.nba_team_id)
    session.add(player)
    session.flush()
    session.execute(delete(PlayerPosition).where(PlayerPosition.player_id == player.id))
    session.execute(
        delete(ExternalPlayerID).where(ExternalPlayerID.player_id == player.id)
    )
    session.add_all(
        [
            PlayerPosition(player_id=player.id, position=p)
            for p in sorted(set(body.positions))
        ]
    )
    session.add_all(
        [
            ExternalPlayerID(player_id=player.id, provider=k, external_id=v)
            for k, v in body.external_ids.items()
        ]
    )


@router.post("/admin/players", status_code=201)
def create_player(body: PlayerInput, user: AdminDep, session: SessionDep):
    player = Player()
    write_player(session, body, player)
    audit(session, user, "player.create", player.id, body.model_dump(mode="json"))
    session.commit()
    return player_view(session, player)


@router.put("/admin/players/{player_id}")
def edit_player(
    player_id: UUID, body: PlayerInput, user: AdminDep, session: SessionDep
):
    player = get_or_404(session, Player, player_id)
    write_player(session, body, player)
    audit(session, user, "player.update", player.id, body.model_dump(mode="json"))
    session.commit()
    return player_view(session, player)


@router.post("/admin/nba-teams", status_code=201)
def create_nba_team(body: TeamInput, user: AdminDep, session: SessionDep):
    team = NBATeam(**body.model_dump())
    session.add(team)
    session.flush()
    audit(session, user, "nba_team.create", team.id)
    session.commit()
    session.refresh(team)
    return team


@router.get("/nba-teams")
def nba_teams(user: UserDep, session: SessionDep):
    return session.scalars(select(NBATeam).order_by(NBATeam.code)).all()


def parse_rows(body):
    if body.format == "json":
        raw = json.loads(body.data)
        if not isinstance(raw, list):
            raise ValueError("JSON import must be an array")
    else:
        raw = []
        for item in csv.DictReader(io.StringIO(body.data)):
            stats = {key: item.pop(key, None) for key in Totals.model_fields}
            raw.append({**item, "totals": stats})
    if not raw or len(raw) > 10000:
        raise ValueError("Imports require 1 to 10000 rows")
    return raw


@router.post("/admin/imports")
def import_stats(body: ImportInput, user: AdminDep, session: SessionDep):
    run = ImportRun(
        actor_id=user.id, source=body.source, status="validating", errors=[]
    )
    session.add(run)
    session.flush()
    errors, rows, seen = [], [], set()
    try:
        raw = parse_rows(body)
        for index, item in enumerate(raw, 1):
            try:
                row = StatRow.model_validate(item)
                player = session.get(Player, row.player_id)
                if not player:
                    raise ValueError("Unknown player ID")
                if not player.rookie_season <= row.season <= current_season():
                    raise ValueError("Season outside player's career range")
                key = (row.player_id, row.season, row.phase, row.scope)
                if key in seen:
                    raise ValueError("Duplicate season/phase/scope in import")
                seen.add(key)
                team = (
                    None
                    if row.scope == "TOTAL"
                    else session.scalar(
                        select(NBATeam).where(NBATeam.code == row.scope)
                    )
                )
                if row.scope != "TOTAL" and team is None:
                    raise ValueError("Unknown NBA team code")
                rows.append((row, team))
            except (ValueError, ValidationError) as exc:
                errors.append({"row": index, "message": str(exc)})
    except (ValueError, TypeError, csv.Error) as exc:
        errors.append({"row": None, "message": str(exc)})
    if errors:
        record("import_failures")
    run.errors = errors
    run.status = "failed" if errors else "complete"
    run.row_count = len(rows) if not errors else 0
    if not errors:
        for row, team in rows:
            values = row.model_dump(exclude={"totals"})
            values.update(
                totals=row.totals.model_dump(),
                import_run_id=run.id,
                nba_team_id=team.id if team else None,
            )
            statement = insert(SeasonStats).values(**values)
            session.execute(
                statement.on_conflict_do_update(
                    index_elements=["player_id", "season", "phase", "scope"],
                    set_={
                        k: statement.excluded[k]
                        for k in ("totals", "import_run_id", "nba_team_id")
                    },
                )
            )
    audit(session, user, "stats.import", run.id, {"status": run.status})
    session.commit()
    return (
        JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "import_rejected",
                    "message": "No statistics were changed.",
                    "import_id": str(run.id),
                    "details": errors,
                }
            },
        )
        if errors
        else {"id": run.id, "status": run.status, "row_count": run.row_count}
    )


@router.get("/admin/imports")
def imports(user: AdminDep, session: SessionDep):
    return session.scalars(
        select(ImportRun).order_by(ImportRun.created_at.desc()).limit(100)
    ).all()


@router.get("/admin/audit")
def audit_logs(user: AdminDep, session: SessionDep):
    return session.scalars(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(100)
    ).all()


@router.post("/admin/pools", status_code=201)
def create_pool(body: PoolInput, user: AdminDep, session: SessionDep):
    pool = PlayerPool(name=body.name)
    session.add(pool)
    session.flush()
    audit(session, user, "pool.create", pool.id)
    session.commit()
    session.refresh(pool)
    return pool


@router.get("/pools")
def pools(user: UserDep, session: SessionDep):
    return session.scalars(
        select(PlayerPool).order_by(PlayerPool.created_at.desc())
    ).all()


@router.get("/pools/{pool_id}")
def pool_detail(pool_id: UUID, user: UserDep, session: SessionDep):
    pool = get_or_404(session, PlayerPool, pool_id)
    return {
        "id": pool.id,
        "name": pool.name,
        "status": pool.status,
        "players": session.scalars(
            select(PoolPlayer)
            .where(PoolPlayer.pool_id == pool_id)
            .order_by(PoolPlayer.priority, PoolPlayer.id)
        ).all(),
    }


@router.put("/admin/pools/{pool_id}/players")
def select_pool_players(
    pool_id: UUID, body: PoolSelection, user: AdminDep, session: SessionDep
):
    pool = session.scalar(
        select(PlayerPool).where(PlayerPool.id == pool_id).with_for_update()
    )
    if not pool:
        raise DomainError("not_found", "Pool was not found.", 404)
    if pool.status != "draft":
        raise DomainError(
            "pool_immutable", "Create a new pool version to change eligibility."
        )
    session.execute(delete(PoolPlayer).where(PoolPlayer.pool_id == pool_id))
    for player_id in set(body.player_ids):
        player = get_or_404(session, Player, player_id)
        if player.archived:
            raise DomainError(
                "player_archived", "Archived players cannot enter a new pool."
            )
        positions = session.scalars(
            select(PlayerPosition.position).where(PlayerPosition.player_id == player_id)
        ).all()
        session.add(
            PoolPlayer(
                pool_id=pool_id,
                player_id=player_id,
                tier=player.tier,
                positions=positions,
                priority=player.priority,
            )
        )
    audit(session, user, "pool.configure", pool_id)
    session.commit()
    return {"id": pool_id, "status": "draft"}


@router.post("/admin/pools/{pool_id}/publish")
def publish_pool(pool_id: UUID, user: AdminDep, session: SessionDep):
    pool = session.scalar(
        select(PlayerPool).where(PlayerPool.id == pool_id).with_for_update()
    )
    if not pool:
        raise DomainError("not_found", "Pool was not found.", 404)
    if pool.status != "draft":
        raise DomainError("pool_immutable", "This pool is already published.")
    entries = session.scalars(
        select(PoolPlayer).where(PoolPlayer.pool_id == pool_id)
    ).all()
    if not entries:
        raise DomainError("pool_empty", "Select players before publishing.")
    problems = []
    for entry in entries:
        player = session.get(Player, entry.player_id)
        if (
            player.archived
            or not entry.positions
            or not coverage(session, player)["complete"]
        ):
            problems.append(str(player.id))
    if problems:
        raise DomainError(
            "pool_incomplete",
            "Players require active status, positions, and complete history: "
            + ", ".join(problems),
        )
    pool.status = "published"
    audit(session, user, "pool.publish", pool.id)
    session.commit()
    return {"id": pool.id, "status": pool.status}
