"""create basic schema: players, teams, season

Revision ID: fc584d22f8dd
Revises: 2bbc9bfdb3c8
Create Date: 2026-10-27 13:08:49.620992

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fc584d22f8dd'
down_revision: Union[str, None] = '2bbc9bfdb3c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
