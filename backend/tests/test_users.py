import unittest
from concurrent.futures import ThreadPoolExecutor
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from firebase_admin import auth, exceptions

from main import app
from app.api.dependencies import get_db
from app.schema.base import Base
from app.schema.user import User
from app.services.users import synchronize_user


class UserTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        app.dependency_overrides[get_db] = lambda: self.session
        self.client = TestClient(app)
        self.claims = {'uid': 'fan-1', 'email': 'fan@example.com', 'name': 'Fan', 'email_verified': False}
        self.app_patch = patch('app.core.firebase.firebase_app', return_value=object())
        self.app_patch.start()
        self.verifier = patch('app.core.firebase.auth.verify_id_token', return_value=self.claims)
        self.verify = self.verifier.start()
        self.headers = {'Authorization': 'Bearer test-token'}

    def tearDown(self):
        self.verifier.stop()
        self.app_patch.stop()
        app.dependency_overrides.clear()
        self.session.close()
        self.engine.dispose()

    def test_missing_or_malformed_credentials(self):
        for headers in ({}, {'Authorization': 'Basic credentials'}):
            self.assertEqual(self.client.get('/api/v1/users/me', headers=headers).status_code, 401)
        self.verify.assert_not_called()

    def test_rejected_tokens(self):
        for error in (auth.InvalidIdTokenError('invalid'), auth.ExpiredIdTokenError('expired', None), auth.RevokedIdTokenError('revoked'), auth.UserDisabledError('disabled')):
            self.verify.side_effect = error
            self.assertEqual(self.client.post('/api/v1/users/me', headers=self.headers).status_code, 401)

    def test_service_failure(self):
        self.verify.side_effect = exceptions.UnavailableError('unavailable')
        self.assertEqual(self.client.post('/api/v1/users/me', headers=self.headers).status_code, 503)

    def test_sync_updates_and_isolates_users(self):
        self.assertEqual(self.client.get('/api/v1/users/me', headers=self.headers).status_code, 404)
        response = self.client.post('/api/v1/users/me', headers=self.headers)
        self.assertEqual(response.status_code, 200)
        first = response.json()
        self.assertTrue(first['created_at'].endswith('+00:00'))
        self.assertNotIn('firebase_uid', first)
        self.claims.update(name='Updated Fan', email_verified=True)
        second = self.client.post('/api/v1/users/me', headers=self.headers).json()
        self.assertEqual(first['id'], second['id'])
        self.assertEqual(second['display_name'], 'Updated Fan')
        self.assertTrue(second['email_verified'])
        self.assertEqual(self.session.scalar(select(func.count()).select_from(User)), 1)
        self.claims['uid'] = 'fan-2'
        self.assertEqual(self.client.get('/api/v1/users/me', headers=self.headers).status_code, 404)
        other = self.client.post('/api/v1/users/me', headers=self.headers).json()
        self.assertNotEqual(first['id'], other['id'])
        self.assertEqual(self.client.get('/api/v1/users/me', headers=self.headers).json()['id'], other['id'])
        self.verify.assert_called_with('test-token', app=unittest.mock.ANY, check_revoked=True)

    def test_concurrent_sync(self):
        with TemporaryDirectory() as folder:
            engine = create_engine(f'sqlite:///{folder}/users.db', connect_args={'check_same_thread': False})
            Base.metadata.create_all(engine)
            def sync(_):
                with Session(engine) as session:
                    return synchronize_user(session, self.claims).id
            try:
                with ThreadPoolExecutor(max_workers=4) as pool:
                    ids = list(pool.map(sync, range(8)))
                self.assertEqual(len(set(ids)), 1)
                with Session(engine) as session:
                    self.assertEqual(session.scalar(select(func.count()).select_from(User)), 1)
            finally:
                engine.dispose()
