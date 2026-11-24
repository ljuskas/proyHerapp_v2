"""Prueba de infraestructura local: datos persistidos y Lambda Node.js 22 en Docker.

Se ejecuta con el Python de la imagen LocalEmu (incluye boto3). Durante la
migración también permite usar el venv de la instalación Python anterior.
"""
import argparse
import io
import json
import uuid
import zipfile
from pathlib import Path

import boto3
from botocore.config import Config

ENDPOINT = "http://127.0.0.1:4566"
PREFIX = "heraap-infra-check-"


def client(service):
    return boto3.client(
        service,
        endpoint_url=ENDPOINT,
        aws_access_key_id="test",
        aws_secret_access_key="test",
        region_name="us-east-1",
        config=Config(connect_timeout=5, read_timeout=180, retries={"max_attempts": 1}),
    )


def load_probe(path):
    probe = json.loads(path.read_text())
    if not all(probe[key].startswith(PREFIX) for key in ("bucket", "table")):
        raise RuntimeError("El archivo no identifica recursos de prueba de Heraap")
    return probe


def seed(path):
    if path.exists():
        raise RuntimeError("Ya existe una prueba pendiente; leer o limpiar antes de crear otra")
    suffix = uuid.uuid4().hex
    probe = {"bucket": PREFIX + suffix, "table": PREFIX + suffix, "token": uuid.uuid4().hex}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(probe))
    path.chmod(0o600)
    try:
        client("s3").create_bucket(Bucket=probe["bucket"])
        client("s3").put_object(Bucket=probe["bucket"], Key="probe.txt", Body=probe["token"].encode())
        ddb = client("dynamodb")
        ddb.create_table(
            TableName=probe["table"],
            KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "id", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        ddb.get_waiter("table_exists").wait(
            TableName=probe["table"], WaiterConfig={"Delay": 1, "MaxAttempts": 30}
        )
        ddb.put_item(
            TableName=probe["table"],
            Item={"id": {"S": "probe"}, "token": {"S": probe["token"]}},
        )
        print("OK: datos temporales creados en S3 y DynamoDB", flush=True)
    except Exception:
        cleanup(path)
        raise


def read(path):
    probe = load_probe(path)
    body = client("s3").get_object(Bucket=probe["bucket"], Key="probe.txt")["Body"].read().decode()
    if body != probe["token"]:
        raise RuntimeError("El contenido recuperado de S3 cambió")
    item = client("dynamodb").get_item(
        TableName=probe["table"], Key={"id": {"S": "probe"}}, ConsistentRead=True
    ).get("Item", {})
    if item.get("token", {}).get("S") != probe["token"]:
        raise RuntimeError("El registro recuperado de DynamoDB cambió o no existe")
    print("OK: contenido S3 y lectura consistente DynamoDB recuperados", flush=True)


def cleanup(path):
    probe = load_probe(path)
    s3 = client("s3")
    try:
        s3.delete_object(Bucket=probe["bucket"], Key="probe.txt")
        s3.delete_bucket(Bucket=probe["bucket"])
    except s3.exceptions.NoSuchBucket:
        pass
    ddb = client("dynamodb")
    try:
        ddb.delete_table(TableName=probe["table"])
    except ddb.exceptions.ResourceNotFoundException:
        pass
    path.unlink()
    print("OK: recursos temporales de S3 y DynamoDB eliminados", flush=True)


def check_lambda():
    name = PREFIX + uuid.uuid4().hex
    iam, functions = client("iam"), client("lambda")
    role_created = function_created = False
    try:
        role = iam.create_role(
            RoleName=name,
            AssumeRolePolicyDocument=json.dumps({
                "Version": "2012-10-17",
                "Statement": [{"Effect": "Allow", "Principal": {"Service": "lambda.amazonaws.com"},
                               "Action": "sts:AssumeRole"}],
            }),
        )["Role"]
        role_created = True
        source = """
exports.handler = async () => {
  const response = await fetch('http://localemu:4566/_localemu/health', {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`LocalEmu HTTP ${response.status}`);
  const health = await response.json();
  if (health.version !== '1.4.0') throw new Error('Versión de LocalEmu inesperada');
  if (!process.versions.node.startsWith('22.')) throw new Error('Runtime Node inesperado');
  return { ok: true, runtime: process.version, localemu: health.version };
};
"""
        payload = io.BytesIO()
        with zipfile.ZipFile(payload, "w") as archive:
            archive.writestr("index.js", source)
        print("Verificando Lambda Node.js 22 y red heraap-local…", flush=True)
        functions.create_function(
            FunctionName=name, Runtime="nodejs22.x", Role=role["Arn"], Handler="index.handler",
            Code={"ZipFile": payload.getvalue()}, Timeout=20, MemorySize=128,
        )
        function_created = True
        functions.get_waiter("function_active_v2").wait(
            FunctionName=name, WaiterConfig={"Delay": 2, "MaxAttempts": 120}
        )
        result = functions.invoke(FunctionName=name, Payload=b"{}")
        response = json.loads(result["Payload"].read())
        if result.get("FunctionError") or response.get("ok") is not True:
            raise RuntimeError(f"Falló la prueba Lambda: {response}")
        print(f"OK: Lambda {response['runtime']} accede a LocalEmu {response['localemu']} por DNS Docker", flush=True)
    finally:
        try:
            if function_created:
                functions.delete_function(FunctionName=name)
        finally:
            if role_created:
                iam.delete_role(RoleName=name)
            logs = client("logs")
            try:
                logs.delete_log_group(logGroupName=f"/aws/lambda/{name}")
            except logs.exceptions.ResourceNotFoundException:
                pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["seed", "read", "cleanup", "lambda", "all"])
    parser.add_argument("--state", type=Path, required=True)
    args = parser.parse_args()
    if args.mode == "all":
        seed(args.state)
        try:
            read(args.state)
            check_lambda()
        finally:
            cleanup(args.state)
    elif args.mode == "lambda":
        check_lambda()
    else:
        {"seed": seed, "read": read, "cleanup": cleanup}[args.mode](args.state)


if __name__ == "__main__":
    main()
