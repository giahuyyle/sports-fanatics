from concurrent.futures import ThreadPoolExecutor

from conftest import headers


def test_identity_and_permissions(db_app):
    _, client = db_app
    assert client.get("/api/v1/me").status_code == 401
    assert client.get("/api/v1/me", headers=headers("invalid")).status_code == 401
    result = client.post(
        "/api/v1/me/team", headers=headers("alice"), json={"name": "  Ｈoops  CLUB "}
    )
    assert result.status_code == 201
    assert result.json()["name"] == "Hoops CLUB"
    assert (
        client.post(
            "/api/v1/me/team", headers=headers("bob"), json={"name": "hoops club"}
        ).status_code
        == 409
    )
    assert (
        client.patch(
            "/api/v1/me/team", headers=headers("bob"), json={"name": "Bob"}
        ).status_code
        == 404
    )
    assert (
        client.patch(
            "/api/v1/me/team",
            headers=headers("alice"),
            json={"name": "New", "user_id": "bob"},
        ).status_code
        == 422
    )
    assert not client.get("/api/v1/me", headers=headers("alice")).json()["is_admin"]


def test_global_name_race(db_app):
    _, client = db_app

    def claim(uid):
        return client.post(
            "/api/v1/me/team", headers=headers(uid), json={"name": "Same name"}
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        assert sorted(executor.map(claim, ["alice", "bob"])) == [201, 409]


def test_expanding_unicode_name_is_rejected(db_app):
    _, client = db_app
    response = client.post(
        "/api/v1/me/team", headers=headers("alice"), json={"name": "ﷺ" * 20}
    )
    assert response.status_code == 422
