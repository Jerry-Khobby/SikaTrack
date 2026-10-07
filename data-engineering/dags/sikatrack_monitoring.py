"""
### SikaTrack monitoring

Every morning at 06:00 UTC (06:00 in Ghana), after the midnight pipeline run:

- **Staleness**: has the pipeline run in the last 36 hours? Was every staged backup loaded?
  Is there a backup newer than 14 days?
- **Failures**: did the last warehouse load fail?
- **Quality drift**: parse rate, category coverage, balance continuity and unexplained gaps
  against early-warning limits (tighter than the quality gates), and against the previous load.

Then it emails a digest: "ACTION NEEDED" when something is broken, otherwise the day's numbers.
All limits and email settings are in .env (see .env.example); the logic is in src/monitoring/.
"""

from datetime import timedelta

import pendulum
from airflow.sdk import dag, task

from src.monitoring.callbacks import on_task_failure


@dag(
    dag_id="sikatrack_monitoring",
    schedule="0 6 * * *",
    start_date=pendulum.datetime(2026, 10, 1, tz="UTC"),
    catchup=False,
    max_active_runs=1,
    default_args={
        "owner": "sikatrack",
        "retries": 1,
        "retry_delay": timedelta(minutes=5),
        "execution_timeout": timedelta(minutes=5),
        "on_failure_callback": on_task_failure,
    },
    tags=["sikatrack", "monitoring"],
    doc_md=__doc__,
)
def sikatrack_monitoring():

    @task
    def daily_checks() -> dict:
        from src.monitoring.daily import run

        return run()

    daily_checks()


sikatrack_monitoring()
