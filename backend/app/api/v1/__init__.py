from fastapi import APIRouter

from app.api.v1.player import router as player_router
from app.api.v1.team import router as team_router

api_router = APIRouter()
api_router.include_router(player_router)
api_router.include_router(team_router)
