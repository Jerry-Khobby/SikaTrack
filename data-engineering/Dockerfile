# SikaTrack data-engineering image
# Official Airflow image + the pipeline's dependencies. Airflow's LocalExecutor runs
# tasks inside the scheduler container, so this one image runs both Airflow and the jobs.
#
# src/, dags/ and data/ are bind-mounted by docker-compose, so code edits don't need a
# rebuild; rebuild only when requirements.txt or AIRFLOW_VERSION changes.

ARG AIRFLOW_VERSION=3.0.6
ARG PYTHON_VERSION=3.11
FROM apache/airflow:${AIRFLOW_VERSION}-python${PYTHON_VERSION}

# ARGs declared before FROM aren't visible after it; redeclare to use below.
ARG AIRFLOW_VERSION

USER airflow

# Installing apache-airflow alongside the requirements stops pip from silently
# upgrading/downgrading Airflow to satisfy a pipeline dependency.
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir "apache-airflow==${AIRFLOW_VERSION}" -r /tmp/requirements.txt

# Pipeline code lives outside AIRFLOW_HOME, importable as `src.*` (same as locally).
ENV PYTHONPATH=/opt/sikatrack
COPY --chown=airflow:root src /opt/sikatrack/src
COPY --chown=airflow:root sql /opt/sikatrack/sql
