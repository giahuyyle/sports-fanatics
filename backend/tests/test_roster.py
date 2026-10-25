import pytest

from app.domain.roster import Candidate, solve_completion, validate_completion
from app.errors import DomainError


def pool(teams):
    return [
        Candidate(f"{tier}-{i}", tier, ("PG", "SG", "SF", "PF", "C"))
        for tier in range(1, 6)
        for i in range(2 * teams)
    ]


@pytest.mark.parametrize("count", [2, 4, 6])
def test_complete_leagues(count):
    players, managers = pool(count), [str(i) for i in range(count)]
    witness = solve_completion(players, managers, {})
    assert validate_completion(players, managers, {}, witness)
    witness[managers[0]].pop(next(iter(witness[managers[0]])))
    assert not validate_completion(players, managers, {}, witness)


def test_locally_valid_pick_can_block_opponent():
    players = [
        Candidate(str(i), 1 + i // 4, ("PG", "SG", "SF", "PF", "C")) for i in range(20)
    ]
    # A already owns two tier-one players. The sole four centers are tier one.
    players = [
        Candidate(p.id, p.tier, ("C",) if p.tier == 1 else ("PG", "SG", "SF", "PF"))
        for p in players
    ]
    witness = solve_completion(players, ["A", "B"], {"0": "A", "1": "A"})
    assert validate_completion(players, ["A", "B"], {"0": "A", "1": "A"}, witness)
    with pytest.raises(DomainError) as error:
        solve_completion(players, ["A", "B"], {"0": "A", "1": "A", "2": "A"})
    assert error.value.code == "tier_quota"


def test_pick_blocks_another_manager_despite_own_completion():
    non_centers = ("PG", "SG", "SF", "PF")
    players = [
        Candidate(f"{t}-{i}", t, non_centers) for t in range(1, 6) for i in range(6)
    ]
    players += [
        Candidate("c1", 1, ("C",)),
        Candidate("c2", 1, ("C",)),
        Candidate("c3", 2, ("C",)),
        Candidate("c4", 3, ("C",)),
    ]
    picked = {"1-0": "B", "1-1": "B"}
    solve_completion(players, ["A", "B"], picked)
    with pytest.raises(DomainError) as error:
        solve_completion(players, ["A", "B"], {**picked, "c3": "A"})
    assert error.value.code == "roster_infeasible"
    available_to_a = [p for p in players if p.id not in picked]
    assert solve_completion(available_to_a, ["A"], {"c3": "A"})


def test_solver_timeout_is_not_infeasible():
    with pytest.raises(DomainError) as error:
        solve_completion(pool(6), list("ABCDEF"), {}, timeout=0.000001)
    assert error.value.code == "validation_unavailable"
