"""Object storage for the data lake: buckets on an S3-compatible server (RustFS in Docker).

The ObjectStore interface keeps the rest of the pipeline independent of the S3 client.
"""

import os
from pathlib import Path
from typing import BinaryIO, Protocol


class ObjectStore(Protocol):
    name: str

    def put_file(self, key: str, path: Path) -> None: ...
    def open(self, key: str) -> BinaryIO: ...
    def exists(self, key: str) -> bool: ...
    def list(self, prefix: str = "") -> list[str]: ...


class S3ObjectStore:
    """A bucket on an S3-compatible server. Uploads are atomic: an object appears only when complete."""

    def __init__(self, bucket: str, client):
        self.name = bucket
        self.client = client

    def put_file(self, key: str, path: Path) -> None:
        self.client.upload_file(str(path), self.name, key)

    def open(self, key: str) -> BinaryIO:
        return self.client.get_object(Bucket=self.name, Key=key)["Body"]

    def exists(self, key: str) -> bool:
        from botocore.exceptions import ClientError
        try:
            self.client.head_object(Bucket=self.name, Key=key)
            return True
        except ClientError as e:
            if e.response["Error"]["Code"] in ("404", "NoSuchKey", "NotFound"):
                return False
            raise

    def list(self, prefix: str = "") -> list[str]:
        paginator = self.client.get_paginator("list_objects_v2")
        keys = [
            obj["Key"]
            for page in paginator.paginate(Bucket=self.name, Prefix=prefix)
            for obj in page.get("Contents", [])
        ]
        return sorted(keys)


def s3_client():
    import boto3
    return boto3.client(
        "s3",
        endpoint_url=os.getenv("S3_ENDPOINT"),
        aws_access_key_id=os.getenv("S3_ACCESS_KEY"),
        aws_secret_access_key=os.getenv("S3_SECRET_KEY"),
        region_name="us-east-1",
    )


def get_store(bucket_env: str) -> ObjectStore:
    """bucket_env: RAW_BUCKET or PROCESSED_BUCKET (env var holding the bucket name)."""
    defaults = {"RAW_BUCKET": "sikatrack-raw", "PROCESSED_BUCKET": "sikatrack-processed"}
    return S3ObjectStore(os.getenv(bucket_env, defaults[bucket_env]), s3_client())
