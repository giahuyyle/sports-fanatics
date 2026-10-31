import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from main import app
from app.api.dependencies import get_db
from app.api.v1.games import DATA
from app.schema.base import Base
from app.schema.player import Player
from app.schema.team import Team
from app.schema.season import Season


class GameTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.session.add_all([Player(id=i+1, first_name='First', last_name='Last', full_name=p['name']) for i,p in enumerate(DATA['players'])])
        self.session.add_all([Team(id=i+1, abbreviation=a, nick_name=a, full_name=a, city='City', state='State', year_founded=1970) for i,a in enumerate(['CLE','OKC','BOS','LAL','MIA','BKN'])])
        self.session.commit()
        app.dependency_overrides[get_db] = lambda: self.session
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        self.session.close()
        self.engine.dispose()

    def season(self, player, team, league='00', gp=10):
        values = {c.name: 0 for c in Season.__table__.columns if c.name != 'id'}
        values.update(player_id=player, team_id=team, league_id=league, season_id='2024-25', team_abbreviation='XXX', gp=gp)
        self.session.add(Season(**values))
        self.session.commit()

    def test_catalog_has_enrichment_but_no_answers(self):
        response = self.client.get('/api/v1/games/catalog')
        self.assertEqual(response.status_code,200)
        data=response.json()
        self.assertEqual(len(data['players']),48)
        self.assertEqual(len(data['puzzles']),3)
        self.assertEqual(data['unavailable'],[])
        self.assertEqual(set(data['puzzles'][0]),{'id','clues'})
        self.assertEqual(data['rankingLabel'],'Demo rankings')

    def test_missing_enrichment_is_reported(self):
        player=self.session.get(Player,1)
        self.session.delete(player)
        self.session.commit()
        data=self.client.get('/api/v1/games/catalog').json()
        self.assertEqual(len(data['players']),47)
        self.assertIn('Nikola Jokić',data['unavailable'])
        self.assertEqual(len(data['puzzles']),2)

    def test_grid_requires_two_real_nba_appearances(self):
        self.season(1,1)
        self.season(1,0)
        payload={'player_id':1,'team_ids':[1,4]}
        self.assertFalse(self.client.post('/api/v1/games/grid/validate',json=payload).json()['match'])
        self.season(1,4,league='10')
        self.season(1,4,gp=0)
        self.assertFalse(self.client.post('/api/v1/games/grid/validate',json=payload).json()['match'])
        self.season(1,4)
        self.assertTrue(self.client.post('/api/v1/games/grid/validate',json=payload).json()['match'])
        for ids,status in [([1,1],422),([0,1],422),([1,999],404)]:
            self.assertEqual(self.client.post('/api/v1/games/grid/validate',json={**payload,'team_ids':ids}).status_code,status)

    def test_random_grid_has_six_teams_and_nine_distinct_answers(self):
        from app.services.games import distinct_answers
        for player in range(1, 10):
            for team in range(1, 7):
                self.season(player, team)
        previous = ''
        for _ in range(5):
            response = self.client.get('/api/v1/games/grid', params={'previous': previous})
            self.assertEqual(response.status_code, 200)
            layout = response.json()
            self.assertEqual(set(layout), {'rows', 'columns'})
            ids = [team['id'] for team in layout['rows'] + layout['columns']]
            self.assertEqual(len(ids), 6)
            self.assertEqual(len(set(ids)), 6)
            signature = ','.join(map(str, ids))
            self.assertNotEqual(signature, previous)
            previous = signature
            cells = []
            for row in layout['rows']:
                for column in layout['columns']:
                    answers = set()
                    for player in range(1, 10):
                        data = self.client.post('/api/v1/games/grid/validate', json={
                            'player_id': player, 'team_ids': [row['id'], column['id']]}).json()
                        if data['match']:
                            answers.add(player)
                    cells.append(answers)
            self.assertTrue(distinct_answers(cells))

    def test_random_grid_reports_insufficient_history(self):
        self.assertEqual(self.client.get('/api/v1/games/grid').status_code, 503)
        # A shared player in every cell is insufficient for the no-reuse rule.
        for team in range(1, 7):
            self.season(1, team)
        self.assertEqual(self.client.get('/api/v1/games/grid').status_code, 503)

    def test_matching_rejects_reused_answers(self):
        from app.services.games import distinct_answers
        self.assertFalse(distinct_answers([{1}, {1}, {2, 3}]))
        self.assertTrue(distinct_answers([{1, 2}, {1}, {2, 3}]))

    def test_request_validation_rejects_extra_fields(self):
        response = self.client.post('/api/v1/games/grid/validate', json={
            'player_id': 1, 'team_ids': [1,4], 'trusted': True})
        self.assertEqual(response.status_code, 422)
        response = self.client.post('/api/v1/games/guess/validate', json={
            'puzzle_id': '0', 'answer': 'x' * 121})
        self.assertEqual(response.status_code, 422)

    def test_guess_normalization_and_reveal(self):
        for answer in ['Nikola Jokic','NIKOLA JOKIĆ',' Nikola-Jokić ']:
            data=self.client.post('/api/v1/games/guess/validate',json={'puzzle_id':'2','answer':answer}).json()
            self.assertTrue(data['match'])
        data=self.client.post('/api/v1/games/guess/validate',json={'puzzle_id':'2','answer':'wrong'}).json()
        self.assertFalse(data['match'])
        self.assertIsNone(data['name'])
        self.assertEqual(self.client.post('/api/v1/games/guess/2/reveal').json()['name'],'Nikola Jokić')
        self.assertEqual(self.client.post('/api/v1/games/guess/999/reveal').status_code,404)


if __name__ == '__main__':
    unittest.main()
