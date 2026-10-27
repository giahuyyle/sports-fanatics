from app.models.base import ORMResponseModel, RequestModel


class SeasonStatResponse(ORMResponseModel):
    id: int

    player_id: int
    season_id: str
    league_id: str

    # team_id can be 0, 0 means total stats for a player
    # that has been traded mid-season, i.e. played for 2+ teams
    team_id: int
    team_abbreviation: str
    player_age: float

    gp: int
    gs: int
    min: float

    fgm: int
    fga: int
    fg_pct: float
    fg3m: int
    fg3a: int
    fg3_pct: float
    ftm: int
    fta: int
    ft_pct: float

    oreb: int
    dreb: int
    reb: int
    ast: int
    stl: int
    blk: int
    tov: int
    pf: int
    pts: int

    # per-game averages
    ppg: float
    apg: float
    rpg: float
    orpg: float
    drpg: float


class SeasonStatsUpdate(RequestModel):
    id: int
    
    player_id: int
    season_id: str
    league_id: str

    # team_id can be 0, 0 means total stats for a player
    # that has been traded mid-season, i.e. played for 2+ teams
    team_id: int
    team_abbreviation: str
    player_age: float

    gp: int
    gs: int
    min: float

    fgm: int
    fga: int
    fg_pct: float
    fg3m: int
    fg3a: int
    fg3_pct: float
    ftm: int
    fta: int
    ft_pct: float

    oreb: int
    dreb: int
    reb: int
    ast: int
    stl: int
    blk: int
    tov: int
    pf: int
    pts: int

    # per-game averages
    ppg: float
    apg: float
    rpg: float
    orpg: float
    drpg: float
