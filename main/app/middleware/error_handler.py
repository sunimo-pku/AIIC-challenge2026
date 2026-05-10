import logging
from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("app")


async def http_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
    )


def register(app):
    app.add_exception_handler(Exception, http_exception_handler)
