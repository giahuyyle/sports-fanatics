import json
import logging
from collections import defaultdict
from threading import Lock

_values = defaultdict(float)
_lock = Lock()


def record(name, value=1):
    with _lock:
        _values[name] += value


def metrics():
    with _lock:
        return dict(_values)


class JSONFormatter(logging.Formatter):
    def format(self, record):
        data = {
            "level": record.levelname,
            "event": record.getMessage(),
            "logger": record.name,
        }
        for key in (
            "duration_seconds",
            "solver_status",
            "draft_id",
            "lag_seconds",
            "metrics",
        ):
            if hasattr(record, key):
                data[key] = getattr(record, key)
        if record.exc_info:
            data["exception"] = self.formatException(record.exc_info)
        return json.dumps(data)


def configure_logging():
    logger = logging.getLogger("app")
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JSONFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
