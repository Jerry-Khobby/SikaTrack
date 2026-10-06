"""Object storage for the data lake: a local folder, or any S3-compatible server (RustFS in Docker).

Pick the backend with LAKE_BACKEND=local|s3. Both expose the same small interface,
so nothing else in the pipeline knows which one is in use.
"""

import os
import shutil
from pathlib import Path
from typing import BinaryIO, Protocol

from src.utils.fileio import atomic_path

BASE_DIR = Path(__file__).resolve().parents[2]


class ObjectStore(Protocol):
    name: str

    def put_file(self, key: str, path: Path) -> None: ...
    def open(self, key: str) -> BinaryIO: ...
    def exists(self, key: str) -> bool: ...
    def list(self, prefix: str = "") -> list[str]: ...


class LocalObjectStore:
    """A bucket as a folder: <root>/<bucket>/<key>."""

    def __init__(self, root: Path, bucket: str):
        self.name = bucket
        self.root = Path(root) / bucket

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root.resolve() not in path.parents:
            raise ValueError(f"Key escapes the bucket: {key}")
        return path

    def put_file(self, key: str, path: Path) -> None:
        with atomic_path(self._path(key)) as tmp:
            shutil.copyfile(path, tmp)

    def open(self, key: str) -> BinaryIO:
        return open(self._path(key), "rb")

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def list(self, prefix: str = "") -> list[str]:
        if not self.root.exists():
            return []
        keys = (p.relative_to(self.root).as_posix() for p in self.root.rglob("*") if p.is_file())
        return sorted(k for k in keys if k.startswith(prefix) and not k.endswith(".tmp"))


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
        endpoint_url=os.getenv("S3_ENDPOINT", "http://localhost:9000"),
        aws_access_key_id=os.getenv("S3_ACCESS_KEY"),
        aws_secret_access_key=os.getenv("S3_SECRET_KEY"),
        region_name="us-east-1",
    )


def get_store(bucket_env: str) -> ObjectStore:
    """bucket_env: RAW_BUCKET or PROCESSED_BUCKET (env var holding the bucket name)."""
    defaults = {"RAW_BUCKET": "sikatrack-raw", "PROCESSED_BUCKET": "sikatrack-processed"}
    bucket = os.getenv(bucket_env, defaults[bucket_env])
    backend = os.getenv("LAKE_BACKEND", "local").lower()

    if backend == "local":
        root = Path(os.getenv("LAKE_LOCAL_ROOT") or BASE_DIR / "data" / "lake")
        return LocalObjectStore(root, bucket)
    if backend == "s3":
        return S3ObjectStore(bucket, s3_client())
    raise ValueError(f"LAKE_BACKEND must be 'local' or 's3', got {backend!r}")
