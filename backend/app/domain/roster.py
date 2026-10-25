"""Exact league completion and independent witness/lineup validation."""

import logging
import time
from collections import Counter
from dataclasses import dataclass

from ortools.sat.python import cp_model

from app.domain.catalog import POSITIONS
from app.errors import DomainError
from app.observability import record

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Candidate:
    id: str
    tier: int
    positions: tuple[str, ...]
    priority: int = 0


def validate_completion(players, managers, selected, completion):
    """Validate cached solver output without trusting its original solver execution."""
    catalog = {p.id: p for p in players}
    if set(completion) != set(managers):
        return False
    seen = set()
    for manager, assignments in completion.items():
        if len(assignments) != 10:
            return False
        tiers, positions = Counter(), Counter()
        for player_id, position in assignments.items():
            player = catalog.get(player_id)
            if not player or player_id in seen or position not in player.positions:
                return False
            if player_id in selected and selected[player_id] != manager:
                return False
            seen.add(player_id)
            tiers[player.tier] += 1
            positions[position] += 1
        if positions != Counter({p: 2 for p in POSITIONS}):
            return False
        if tiers != Counter({t: 2 for t in range(1, 6)}):
            return False
    return all(p in completion.get(m, {}) for p, m in selected.items())


def solve_completion(players, managers, selected, timeout=2.0):
    if not managers or not set(selected).issubset({p.id for p in players}):
        raise DomainError("roster_infeasible", "Invalid draft assignments.")
    if not set(selected.values()).issubset(set(managers)):
        raise DomainError("roster_infeasible", "Unknown manager in draft assignments.")
    for manager in managers:
        owned = [p for p in players if selected.get(p.id) == manager]
        if len(owned) > 10 or any(
            n > 2 for n in Counter(p.tier for p in owned).values()
        ):
            raise DomainError(
                "tier_quota", "This squad already has two players from that tier."
            )
    model = cp_model.CpModel()
    variables = {}
    for player in players:
        for manager in managers:
            if player.id in selected and selected[player.id] != manager:
                continue
            for position in player.positions:
                variables[manager, player.id, position] = model.new_bool_var(
                    f"{manager}:{player.id}:{position}"
                )
    for player in players:
        choices = [v for (m, p, pos), v in variables.items() if p == player.id]
        if player.id in selected:
            model.add(sum(choices) == 1)
        else:
            model.add(sum(choices) <= 1)
    for manager in managers:
        for position in POSITIONS:
            model.add(
                sum(
                    v
                    for (m, p, pos), v in variables.items()
                    if m == manager and pos == position
                )
                == 2
            )
        for tier in range(1, 6):
            ids = {p.id for p in players if p.tier == tier}
            model.add(
                sum(
                    v
                    for (m, p, pos), v in variables.items()
                    if m == manager and p in ids
                )
                == 2
            )
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = timeout
    solver.parameters.num_search_workers = 1
    started = time.monotonic()
    status = solver.solve(model)
    record("solver_calls")
    record("solver_seconds_total", time.monotonic() - started)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE, cp_model.INFEASIBLE):
        record("solver_timeouts")
    logger.info(
        "roster_solver",
        extra={
            "duration_seconds": time.monotonic() - started,
            "solver_status": solver.status_name(status),
        },
    )
    if status == cp_model.INFEASIBLE:
        raise DomainError(
            "roster_infeasible",
            "This selection leaves no valid completion for all squads.",
        )
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise DomainError(
            "validation_unavailable",
            "Roster validation timed out. Retry this selection.",
            503,
        )
    completion = {m: {} for m in managers}
    for (manager, player, position), variable in variables.items():
        if solver.value(variable):
            completion[manager][player] = position
    if not validate_completion(players, managers, selected, completion):
        raise DomainError(
            "validation_unavailable", "Roster validation could not be verified.", 503
        )
    return completion


def validate_lineup(players, owned_ids, slots):
    catalog = {p.id: p for p in players}
    expected = {(role, pos) for role in ("starter", "bench") for pos in POSITIONS}
    if len(slots) != 10 or {(s["role"], s["position"]) for s in slots} != expected:
        raise DomainError(
            "invalid_lineup", "Fill one of every position on starters and bench.", 422
        )
    ids = [s["player_id"] for s in slots]
    if len(set(ids)) != 10 or set(ids) != set(owned_ids):
        raise DomainError(
            "invalid_lineup", "Use all ten drafted players exactly once.", 422
        )
    if any(s["position"] not in catalog[s["player_id"]].positions for s in slots):
        raise DomainError(
            "invalid_lineup", "A player is assigned to an ineligible position.", 422
        )
    if Counter(catalog[p].tier for p in ids) != Counter({t: 2 for t in range(1, 6)}):
        raise DomainError("invalid_lineup", "Use two players from every tier.", 422)
