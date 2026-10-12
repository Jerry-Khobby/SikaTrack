"""The S3 client for the RustFS data lake."""

from typing import TYPE_CHECKING

import boto3
from botocore.config import Config

from sikatrack_api.config import Settings

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client


def create_s3_client(settings: Settings) -> "S3Client":
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key.get_secret_value(),
        aws_secret_access_key=settings.s3_secret_key.get_secret_value(),
        region_name=settings.s3_region,
        config=Config(
            connect_timeout=settings.readiness_timeout,
            read_timeout=10,
            retries={"max_attempts": 2, "mode": "standard"},
            s3={"addressing_style": "path"},  # RustFS, like MinIO, serves buckets as paths
        ),
    )
