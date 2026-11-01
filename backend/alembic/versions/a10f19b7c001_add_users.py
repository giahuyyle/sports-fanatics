"""Add Firebase-linked application users."""
from alembic import op
import sqlalchemy as sa

revision = "a10f19b7c001"
down_revision = "88d9d7b5a8f2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("firebase_uid", sa.String(128), nullable=False, unique=True),
        sa.Column("email", sa.String(320)),
        sa.Column("display_name", sa.String(256)),
        sa.Column("photo_url", sa.String(2048)),
        sa.Column("email_verified", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table("users")
