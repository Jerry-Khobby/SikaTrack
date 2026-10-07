"""
### SikaTrack pipeline

SMS backups → raw zone → extract → parse → transform → processed zone → warehouse.

**Adding data:** drop an SMS Backup & Restore export into `data/inbox/`. The next run stages
it into the raw zone (already-staged files are skipped) and rebuilds from **every** backup.

**Params**
- `force`: run even if no new backup or settings change was detected. Use it after
  changing parser templates or transform rules.
- `load`: load the warehouse (default true).

Each task calls one step from `src/orchestration/pipeline.py`; the logic lives there,
not here, so it stays testable without Airflow.
"""

from datetime import timedelta

import pendulum
from airflow.exceptions import AirflowFailException, AirflowSkipException
from airflow.sdk import Asset, Param, dag, get_current_context, task

from src.monitoring.callbacks import on_task_failure  # light: stdlib only

# Heavy imports (pandas, pyarrow, boto3) happen inside tasks: the DAG processor re-reads this
# file often, and slow top-level imports slow down scheduling for every DAG.

PROCESSED_DATASET = Asset("s3://sikatrack-processed/transactions/transactions.parquet")
WAREHOUSE_FACTS = Asset("postgres://warehouse:5432/sikatrack_dw/dw/fact_transaction")

default_args = {
    "owner": "sikatrack",
    "retries": 2,
    "retry_delay": timedelta(minutes=1),
    "retry_exponential_backoff": True,
    "max_retry_delay": timedelta(minutes=10),
    "execution_timeout": timedelta(minutes=15),
    # Email when a task fails for good (after retries). Settings in .env (EMAIL_USER, ...).
    "on_failure_callback": on_task_failure,
}


def _run(pipeline_run_id: str):
    """Each run works in data/work/<pipeline_run_id>/."""
    from src.orchestration.pipeline import make_run

    return make_run(pipeline_run_id)


def _without_retries(step, run):
    """Quality-gate failures are deterministic: retrying the same data gives the same answer."""
    from src.orchestration.gates import QualityGateError

    try:
        return step(run)
    except QualityGateError as e:
        raise AirflowFailException(str(e)) from e


@dag(
    dag_id="sikatrack_pipeline",
    schedule="@daily",
    start_date=pendulum.datetime(2026, 10, 1, tz="UTC"),
    catchup=False,          # each run rebuilds from all backups; past days add nothing
    max_active_runs=1,      # runs share the lake and warehouse
    default_args=default_args,
    params={
        "force": Param(False, type="boolean", description="Run even if nothing changed."),
        "load": Param(True, type="boolean", description="Load the warehouse."),
    },
    tags=["sikatrack", "etl"],
    doc_md=__doc__,
)
def sikatrack_pipeline():

    @task
    def start() -> str:
        """Deterministic pipeline run ID: a retried DAG run keeps the same one."""
        from src.orchestration.run_id import run_id_for

        context = get_current_context()
        return run_id_for(context["run_id"], context["dag_run"].run_after)

    @task
    def stage(pipeline_run_id: str) -> dict:
        from src.orchestration.pipeline import stage as step

        stats = step(_run(pipeline_run_id))
        return {"inbox_files": len(stats["staged"]), "backups": stats["backups"]}

    @task.short_circuit
    def has_changes(pipeline_run_id: str) -> bool:
        """Skip everything downstream when the backups and settings match the last run."""
        from src.lake.raw_zone import list_backups
        from src.orchestration import state

        run = _run(pipeline_run_id)
        if not list_backups(run.raw):
            raise AirflowFailException("No backups in the raw zone: drop an export into data/inbox/")
        if get_current_context()["params"]["force"]:
            return True
        return state.fingerprint(run.raw, run.owner) != state.last_fingerprint(run.processed)

    @task
    def extract(pipeline_run_id: str) -> dict:
        from src.orchestration.pipeline import extract as step

        return step(_run(pipeline_run_id))

    @task(retries=0)
    def parse(pipeline_run_id: str) -> dict:
        from src.orchestration.pipeline import parse as step

        stats = _without_retries(step, _run(pipeline_run_id))
        return {k: stats[k] for k in ("total", "parsed", "ignored", "unparsed", "parse_success_rate")}

    @task(retries=0)
    def transform(pipeline_run_id: str) -> dict:
        from src.orchestration.pipeline import transform as step

        report = _without_retries(step, _run(pipeline_run_id))
        summary = {k: report[k] for k in ("rows_in", "rows_out", "removed", "balance_gaps", "internal_transfers")}
        return {**summary, "category_coverage": report["categories"]["coverage"],
                "recurring_series": report["recurring"]["series"]}

    @task(outlets=[PROCESSED_DATASET])
    def publish(pipeline_run_id: str) -> dict:
        from src.orchestration.pipeline import publish as step

        return step(_run(pipeline_run_id))

    @task(outlets=[WAREHOUSE_FACTS])
    def load(pipeline_run_id: str) -> dict:
        import json

        from src.orchestration.pipeline import load as step

        if not get_current_context()["params"]["load"]:
            raise AirflowSkipException("load=false")
        run = _run(pipeline_run_id)
        report = json.loads((run.paths.processed / "quality_report.json").read_text(encoding="utf-8"))
        return step(run, report)

    @task(trigger_rule="none_failed")
    def remember(pipeline_run_id: str) -> None:
        """Record what was processed, so the next unchanged run can be skipped."""
        from src.orchestration import state

        run = _run(pipeline_run_id)
        state.save_fingerprint(run.processed, state.fingerprint(run.raw, run.owner))

    @task(trigger_rule="none_failed")
    def cleanup(pipeline_run_id: str) -> None:
        """Delete this run's work files. Not reached after a failure, so they stay for debugging."""
        import shutil

        shutil.rmtree(_run(pipeline_run_id).paths.data_dir, ignore_errors=True)

    # Not called run_id: Airflow reserves that name for its own context value.
    pipeline_run_id = start()
    (
        stage(pipeline_run_id)
        >> has_changes(pipeline_run_id)
        >> extract(pipeline_run_id)
        >> parse(pipeline_run_id)
        >> transform(pipeline_run_id)
        >> publish(pipeline_run_id)
        >> load(pipeline_run_id)
        >> remember(pipeline_run_id)
        >> cleanup(pipeline_run_id)
    )


sikatrack_pipeline()
