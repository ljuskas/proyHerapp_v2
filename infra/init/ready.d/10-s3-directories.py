#!/usr/bin/env python3
"""Recrear directorios de buckets vacíos restaurados por LocalEmu 1.4.0."""
from pathlib import Path

import boto3

s3 = boto3.client(
    "s3", endpoint_url="http://127.0.0.1:4566", region_name="us-east-1",
    aws_access_key_id="test", aws_secret_access_key="test",
)
for bucket in s3.list_buckets()["Buckets"]:
    name = bucket["Name"]
    if "/" in name or name in {".", ".."}:
        raise RuntimeError("Nombre de bucket inesperado")
    Path("/tmp/localemu-s3-storage", name).mkdir(parents=True, exist_ok=True)
