from nba_api.stats.static import players

all_players = players.get_active_players()

print(all_players)