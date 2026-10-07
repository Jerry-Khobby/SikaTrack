"""DAG integrity: both DAGs load, have the right shape, and follow the pipeline's rules.

Needs Airflow, so it runs in CI's DAG job and is skipped where Airflow isn't installed
(e.g. on Windows, where Airflow doesn't run natively).
"""

from pathlib import Path

import pytest

pytest.importorskip("airflow")
from airflow.models.dagbag import DagBag  # noqa: E402

DAGS = Path(__file__).parents[1] / "dags"
PIPELINE = ["start", "stage", "has_changes", "extract", "parse", "transform", "publish", "load", "remember", "cleanup"]


@pytest.fixture(scope="module")
def dagbag():
    return DagBag(str(DAGS), include_examples=False)


def test_dags_load_without_errors(dagbag):
    assert dagbag.import_errors == {}
    assert set(dagbag.dag_ids) == {"sikatrack_pipeline", "sikatrack_monitoring"}


def test_pipeline_runs_every_step_in_order(dagbag):
    dag = dagbag.get_dag("sikatrack_pipeline")
    assert [t.task_id for t in dag.topological_sort()] == PIPELINE


def test_pipeline_schedule_and_concurrency(dagbag):
    dag = dagbag.get_dag("sikatrack_pipeline")
    assert (str(dag.schedule), dag.catchup, dag.max_active_runs) == ("@daily", False, 1)


def test_monitoring_runs_every_morning(dagbag):
    dag = dagbag.get_dag("sikatrack_monitoring")
    assert (str(dag.schedule), dag.catchup) == ("0 6 * * *", False)
    assert [t.task_id for t in dag.tasks] == ["daily_checks"]


@pytest.mark.parametrize("dag_id", ["sikatrack_pipeline", "sikatrack_monitoring"])
def test_every_task_emails_on_failure(dagbag, dag_id):
    tasks = dagbag.get_dag(dag_id).tasks
    missing = [t.task_id for t in tasks if not t.on_failure_callback]
    assert missing == []


def test_quality_gates_fail_fast_and_io_retries(dagbag):
    retries = {t.task_id: t.retries for t in dagbag.get_dag("sikatrack_pipeline").tasks}
    assert retries["parse"] == 0 and retries["transform"] == 0  # same data, same answer: no retry
    assert all(retries[t] == 2 for t in ("stage", "extract", "publish", "load"))


def test_cleanup_and_state_run_even_when_load_is_skipped(dagbag):
    dag = dagbag.get_dag("sikatrack_pipeline")
    assert dag.get_task("remember").trigger_rule == "none_failed"
    assert dag.get_task("cleanup").trigger_rule == "none_failed"
