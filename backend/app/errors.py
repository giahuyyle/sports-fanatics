from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException

from app.observability import record


class DomainError(Exception):
    def __init__(self, code: str, message: str, status: int = 409):
        self.code, self.message, self.status = code, message, status


def install_error_handlers(app: FastAPI):
    @app.exception_handler(DomainError)
    async def domain_error(request: Request, exc: DomainError):
        if exc.code in ("stale_revision", "player_taken", "idempotency_conflict"):
            record("pick_conflicts")
        return JSONResponse(
            status_code=exc.status,
            content={"error": {"code": exc.code, "message": exc.message}},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "invalid_request",
                    "message": "Request validation failed.",
                    "details": [
                        {"loc": list(e["loc"]), "message": e["msg"]}
                        for e in exc.errors()
                    ],
                }
            },
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error(request: Request, exc: IntegrityError):
        return JSONResponse(
            status_code=409,
            content={
                "error": {
                    "code": "constraint_conflict",
                    "message": "This change conflicts with existing data.",
                }
            },
        )

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": "http_error", "message": str(exc.detail)}},
            headers=exc.headers,
        )
