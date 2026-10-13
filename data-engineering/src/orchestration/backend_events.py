"""Tell the backend a user's run has finished, so the app moves their uploads from
"processing" to done (and shows the warehouse rows instead of the provisional ones).

Best effort: a run's result never depends on the backend being up. If this call is lost,
the backend puts long-"processing" uploads back in its queue by itself.
"""

import json
import logging
import os
import urllib.request
from datetime import datetime, timezone

log = logging.getLogger(__spec__.name if __spec__ else __name__)


def notify_run_finished(user_id: str | None, run_id: str, status: str, started_at: datetime) -> bool:
    """POST /internal/pipeline-events. Returns whether the backend accepted it."""
    url = os.getenv("BACKEND_INTERNAL_URL")
    token = os.getenv("INTERNAL_API_TOKEN")
    if not (user_id and url and token):
        return False  # the legacy owner before linking, or no backend configured: nothing to tell
    body = json.dumps({
        "run_id": run_id,
        "user_id": user_id,
        "status": status,
        "started_at": started_at.isoformat(),
        "finished_at": datetime.now(timezone.utc).isoformat(),
    }).encode()
    request = urllib.request.Request(
        url.rstrip("/") + "/internal/pipeline-events",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:  # noqa: S310 (our own URL)
            return response.status == 204
    except Exception as exc:
        log.warning("Couldn't tell the backend run %s finished: %s", run_id, type(exc).__name__)
        return False
