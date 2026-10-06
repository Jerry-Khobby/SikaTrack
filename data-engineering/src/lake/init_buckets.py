"""Create the lake buckets on the S3 server (RustFS in Docker). Idempotent: safe to re-run.

Run:  python -m src.lake.init_buckets
"""

import logging
import os

from botocore.exceptions import ClientError

from src.lake.store import s3_client
from src.utils.logging_config import setup_logging

log = logging.getLogger(__spec__.name if __spec__ else __name__)


def ensure_bucket(client, bucket: str, versioned: bool = False) -> None:
    try:
        client.head_bucket(Bucket=bucket)
        log.info("Bucket %s already exists", bucket)
    except ClientError as e:
        if e.response["Error"]["Code"] not in ("404", "NoSuchBucket", "NotFound"):
            raise
        client.create_bucket(Bucket=bucket)
        log.info("Created bucket %s", bucket)
    if versioned:
        # Raw backups are the source of truth: keep every version of every object.
        client.put_bucket_versioning(Bucket=bucket, VersioningConfiguration={"Status": "Enabled"})


def main() -> None:
    setup_logging()
    client = s3_client()
    ensure_bucket(client, os.getenv("RAW_BUCKET", "sikatrack-raw"), versioned=True)
    ensure_bucket(client, os.getenv("PROCESSED_BUCKET", "sikatrack-processed"))
    log.info("Buckets ready")


if __name__ == "__main__":
    main()
