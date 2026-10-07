@echo off
rem SikaTrack watchdog: run by Windows Task Scheduler, outside Docker.
rem Emails if Airflow, Postgres or RustFS stop answering, or the pipeline stops running.
cd /d "%~dp0.."
python -m src.monitoring.watchdog
